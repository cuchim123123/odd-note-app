import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import type { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit } from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createAdapter } from '@socket.io/redis-adapter';
import { JwtConfigService } from '../config';
import { RedisService } from '../redis/redis.service';
import { Server, Socket } from 'socket.io';
import type Redis from 'ioredis';

type CollaboratorInfo = {
  userId: string;
  displayName: string;
  color: string;
};

type TypingInfo = {
  userId: string;
  displayName: string;
  color: string;
  updatedAt: number;
};

const TYPING_STALE_AFTER_MS = 5000;

const COLLABORATOR_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
];

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/collaboration',
})
export class CollaborationGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(CollaborationGateway.name);
  private pubClient: Redis | null = null;
  private subClient: Redis | null = null;
  private redisEnabled = false;
  private redisWarningLogged = false;

  constructor(
    private readonly jwtService: JwtService,
    private readonly jwtConfig: JwtConfigService,
    private readonly redis: RedisService,
  ) {}

  afterInit(server: Server): void {
    void this.initializeRedisAdapter(server).catch((err) => {
      // Fail fast: if Redis cannot be initialized after retries, throw so the
      // application does not silently run without Redis. This makes the
      // deployment immediately visible and forces Redis to be fixed.
      this.logger.error('Failed to initialize Redis adapter for collaboration', err as Error);
      // Throwing here will surface the error; Nest will log and shutdown.
      throw err;
    });
  }

  private async initializeRedisAdapter(server: Server): Promise<void> {
    const maxAttempts = 8;
    let attempt = 0;
    const baseDelayMs = 250;

    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        this.pubClient = this.redis.createClient();
        this.subClient = this.redis.createClient();

        // Ensure the underlying client (shared) is reachable and pub/sub clients respond.
        await Promise.all([
          this.redis.getClient().ping(),
          this.pubClient.ping(),
          this.subClient.ping(),
        ]);

        server.adapter(createAdapter(this.pubClient, this.subClient));
        this.redisEnabled = true;
        this.logger.log('Collaboration gateway initialized with Redis adapter');
        return;
      } catch (error) {
        this.logger.warn(`Redis initialization attempt ${attempt} failed: ${String(error)}`);
        // Clean up created clients before retrying
        try { await this.pubClient?.quit(); } catch {}
        try { await this.subClient?.quit(); } catch {}
        this.pubClient = null;
        this.subClient = null;

        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        await new Promise((res) => setTimeout(res, delay));
      }
    }

    throw new Error(`Unable to connect to Redis after ${maxAttempts} attempts`);
  }

  private markRedisUnavailable(error: unknown): void {
    // Redis is required for collaboration. Surface the error to fail fast so
    // operators notice and fix infrastructure rather than silently falling back.
    this.logger.error(`Redis unavailable for collaboration: ${String(error)}`);
    // Throw to stop processing and make the failure visible at runtime.
    throw new Error(String(error));
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token — disconnecting`);
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify<{ sub: string; displayName?: string }>(token, {
        secret: this.jwtConfig.getAccessTokenSecret(),
      });

      if (!payload.sub) {
        client.disconnect();
        return;
      }

      // Store user info on the socket data for later use
      (client as Socket & { data: { userId: string; displayName: string } }).data = {
        userId: payload.sub,
        displayName: payload.displayName ?? 'Anonymous',
      };

      this.logger.log(`Client ${client.id} authenticated as user ${payload.sub}`);
    } catch (error) {
      this.logger.warn(`Client ${client.id} failed auth: ${error}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const entry = await this.getSocketRoom(client.id);
    if (entry) {
      await this.removeParticipant(entry.noteId, client.id);
      await this.removeTyping(entry.noteId, entry.user.userId);
      client.to(entry.noteId).emit('collaborator:left', { userId: entry.user.userId });
      await this.broadcastCollaborators(entry.noteId);
      await this.broadcastPresence(entry.noteId);
      await this.broadcastTyping(entry.noteId);
    }

    await this.clearSocketRoom(client.id);
    this.logger.log(`Client ${client.id} disconnected`);
  }

  @SubscribeMessage('note:join')
  async handleJoinNote(
    @ConnectedSocket() client: Socket & { data: { userId: string; displayName: string } },
    @MessageBody() data: { noteId: string },
  ): Promise<void> {
    const { noteId } = data;
    const { userId, displayName } = client.data;

    // Leave any previous room
    const prevEntry = await this.getSocketRoom(client.id);
    if (prevEntry) {
      void client.leave(prevEntry.noteId);
      await this.removeParticipant(prevEntry.noteId, client.id);
      await this.removeTyping(prevEntry.noteId, prevEntry.user.userId);
      client.to(prevEntry.noteId).emit('collaborator:left', { userId: prevEntry.user.userId });
      await this.broadcastCollaborators(prevEntry.noteId);
      await this.broadcastPresence(prevEntry.noteId);
      await this.broadcastTyping(prevEntry.noteId);
    }

    // Assign a color based on how many collaborators are in the room
    const roomSockets = await this.getCollaboratorsInRoom(noteId);
    const colorIndex = roomSockets.length % COLLABORATOR_COLORS.length;

    const collaborator: CollaboratorInfo = {
      userId,
      displayName,
      color: COLLABORATOR_COLORS[colorIndex] ?? COLLABORATOR_COLORS[0] ?? '#ef4444',
    };

    void client.join(noteId);
    await this.setSocketRoom(client.id, noteId, collaborator);
    await this.addParticipant(noteId, client.id, collaborator);

    // Notify the room about the new collaborator
    client.to(noteId).emit('collaborator:joined', collaborator);

    // Send the joining client the current list of collaborators
    const collaborators = await this.getCollaboratorsInRoom(noteId);
    client.emit('collaborators:list', collaborators);
    client.emit('presence:list', collaborators);
    client.emit('typing:list', await this.getTypingInRoom(noteId));
    await this.broadcastPresence(noteId);

    this.logger.log(`User ${userId} joined note ${noteId}`);
  }

  @SubscribeMessage('note:leave')
  async handleLeaveNote(
    @ConnectedSocket() client: Socket & { data: { userId: string; displayName: string } },
  ): Promise<void> {
    const entry = await this.getSocketRoom(client.id);
    if (entry) {
      void client.leave(entry.noteId);
      await this.removeParticipant(entry.noteId, client.id);
      await this.removeTyping(entry.noteId, entry.user.userId);
      client.to(entry.noteId).emit('collaborator:left', { userId: entry.user.userId });
      await this.clearSocketRoom(client.id);
      await this.broadcastCollaborators(entry.noteId);
      await this.broadcastPresence(entry.noteId);
      await this.broadcastTyping(entry.noteId);
    }
  }

  @SubscribeMessage('note:update')
  async handleNoteUpdate(
    @ConnectedSocket() client: Socket & { data: { userId: string; displayName: string } },
    @MessageBody() data: { noteId: string; content: string; title?: string },
  ): Promise<void> {
    const entry = await this.getSocketRoom(client.id);
    if (!entry || entry.noteId !== data.noteId) {
      return;
    }

    // Broadcast the content change to all OTHER clients in the room
    client.to(data.noteId).emit('note:updated', {
      userId: client.data.userId,
      content: data.content,
      title: data.title,
      timestamp: Date.now(),
    });
  }

  @SubscribeMessage('note:cursor')
  async handleCursorUpdate(
    @ConnectedSocket() client: Socket & { data: { userId: string; displayName: string } },
    @MessageBody() data: { noteId: string; position: number },
  ): Promise<void> {
    const entry = await this.getSocketRoom(client.id);
    if (!entry || entry.noteId !== data.noteId) {
      return;
    }

    client.to(data.noteId).emit('note:cursor', {
      userId: client.data.userId,
      displayName: client.data.displayName,
      position: data.position,
      color: entry.user.color,
    });
  }

  @SubscribeMessage('note:typing')
  async handleTypingUpdate(
    @ConnectedSocket() client: Socket & { data: { userId: string; displayName: string } },
    @MessageBody() data: { noteId: string; isTyping: boolean },
  ): Promise<void> {
    const entry = await this.getSocketRoom(client.id);
    if (!entry || entry.noteId !== data.noteId) {
      return;
    }

    if (data.isTyping) {
      await this.setTyping(data.noteId, {
        userId: entry.user.userId,
        displayName: entry.user.displayName,
        color: entry.user.color,
        updatedAt: Date.now(),
      });
    } else {
      await this.removeTyping(data.noteId, entry.user.userId);
    }

    await this.broadcastTyping(data.noteId);
  }

  private extractToken(client: Socket): string | null {
    // Try auth.token first, then query param
    const authToken = client.handshake.auth?.token as string | undefined;
    if (authToken) return authToken;

    const queryToken = client.handshake.query?.token as string | undefined;
    return queryToken ?? null;
  }

  private socketKey(socketId: string): string {
    return `collab:socket:${socketId}`;
  }

  private participantsKey(noteId: string): string {
    return `collab:note:${noteId}:participants`;
  }

  private typingKey(noteId: string): string {
    return `collab:note:${noteId}:typing`;
  }

  private async setSocketRoom(socketId: string, noteId: string, user: CollaboratorInfo): Promise<void> {
    if (!this.redisEnabled) {
      this.logger.error('Redis adapter not initialized when setting socket room');
      throw new Error('Redis adapter not initialized');
    }

    try {
      await this.redis.getClient().set(this.socketKey(socketId), JSON.stringify({ noteId, user }));
    } catch (error) {
      this.markRedisUnavailable(error);
    }
  }

  private async getSocketRoom(socketId: string): Promise<{ noteId: string; user: CollaboratorInfo } | null> {
    if (!this.redisEnabled) {
      this.logger.error('Redis adapter not initialized when reading socket room');
      throw new Error('Redis adapter not initialized');
    }

    try {
      const value = await this.redis.getClient().get(this.socketKey(socketId));
      if (!value) return null;
      return JSON.parse(value) as { noteId: string; user: CollaboratorInfo };
    } catch (error) {
      this.markRedisUnavailable(error);
      return null;
    }
  }

  private async clearSocketRoom(socketId: string): Promise<void> {
    if (!this.redisEnabled) {
      this.logger.error('Redis adapter not initialized when clearing socket room');
      throw new Error('Redis adapter not initialized');
    }

    try {
      await this.redis.getClient().del(this.socketKey(socketId));
    } catch (error) {
      this.markRedisUnavailable(error);
    }
  }

  private async addParticipant(noteId: string, socketId: string, user: CollaboratorInfo): Promise<void> {
    if (!this.redisEnabled) {
      this.logger.error('Redis adapter not initialized when adding participant');
      throw new Error('Redis adapter not initialized');
    }

    try {
      await this.redis.getClient().hset(this.participantsKey(noteId), socketId, JSON.stringify(user));
    } catch (error) {
      this.markRedisUnavailable(error);
    }
  }

  private async removeParticipant(noteId: string, socketId: string): Promise<void> {
    if (!this.redisEnabled) {
      this.logger.error('Redis adapter not initialized when removing participant');
      throw new Error('Redis adapter not initialized');
    }

    try {
      await this.redis.getClient().hdel(this.participantsKey(noteId), socketId);
    } catch (error) {
      this.markRedisUnavailable(error);
    }
  }

  private async getCollaboratorsInRoom(noteId: string): Promise<CollaboratorInfo[]> {
    if (!this.redisEnabled) {
      this.logger.error('Redis adapter not initialized when listing collaborators');
      throw new Error('Redis adapter not initialized');
    }

    try {
      const values = await this.redis.getClient().hvals(this.participantsKey(noteId));
      return values
        .map((value) => {
          try {
            return JSON.parse(value) as CollaboratorInfo;
          } catch {
            return null;
          }
        })
        .filter((value): value is CollaboratorInfo => Boolean(value));
    } catch (error) {
      this.markRedisUnavailable(error);
    }
    return [];
  }

  private async setTyping(noteId: string, typing: TypingInfo): Promise<void> {
    if (!this.redisEnabled) {
      this.logger.error('Redis adapter not initialized when setting typing');
      throw new Error('Redis adapter not initialized');
    }

    try {
      await this.redis.getClient().hset(this.typingKey(noteId), typing.userId, JSON.stringify(typing));
      await this.redis.getClient().expire(this.typingKey(noteId), 30);
    } catch (error) {
      this.markRedisUnavailable(error);
    }
  }

  private async removeTyping(noteId: string, userId: string): Promise<void> {
    if (!this.redisEnabled) {
      this.logger.error('Redis adapter not initialized when removing typing');
      throw new Error('Redis adapter not initialized');
    }

    try {
      await this.redis.getClient().hdel(this.typingKey(noteId), userId);
    } catch (error) {
      this.markRedisUnavailable(error);
    }
  }

  private async getTypingInRoom(noteId: string): Promise<TypingInfo[]> {
    const now = Date.now();
    if (!this.redisEnabled) {
      this.logger.error('Redis adapter not initialized when listing typing');
      throw new Error('Redis adapter not initialized');
    }

    try {
      const values = await this.redis.getClient().hvals(this.typingKey(noteId));
      const parsed = values
        .map((value) => {
          try {
            return JSON.parse(value) as TypingInfo;
          } catch {
            return null;
          }
        })
        .filter((value): value is TypingInfo => Boolean(value))
        .filter((value) => now - value.updatedAt <= TYPING_STALE_AFTER_MS);

      if (parsed.length !== values.length) {
        const staleEntries = values
          .map((value) => {
            try {
              return JSON.parse(value) as TypingInfo;
            } catch {
              return null;
            }
          })
          .filter((value): value is TypingInfo => Boolean(value))
          .filter((value) => now - value.updatedAt > TYPING_STALE_AFTER_MS)
          .map((value) => value.userId);

        if (staleEntries.length > 0) {
          await this.redis.getClient().hdel(this.typingKey(noteId), ...staleEntries);
        }
      }

      return parsed;
    } catch (error) {
      this.markRedisUnavailable(error);
    }
    return [];
  }

  private async broadcastCollaborators(noteId: string): Promise<void> {
    const collaborators = await this.getCollaboratorsInRoom(noteId);
    this.server.to(noteId).emit('collaborators:list', collaborators);
  }

  private async broadcastPresence(noteId: string): Promise<void> {
    const viewers = await this.getCollaboratorsInRoom(noteId);
    this.server.to(noteId).emit('presence:list', viewers);
  }

  private async broadcastTyping(noteId: string): Promise<void> {
    const typing = await this.getTypingInRoom(noteId);
    this.server.to(noteId).emit('typing:list', typing);
  }
}
