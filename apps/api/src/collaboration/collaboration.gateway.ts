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
import * as Y from 'yjs';

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

type CollaborationSnapshot = {
  title: string;
  content: string;
  isPinned: boolean;
  updatedAt: string;
};

type YDocState = {
  stateVector: number[];
  updates: Array<number[]>;
};

type AwarenessState = {
  userId: string;
  displayName: string;
  color: string;
  position: number;
  selection?: { anchor: number; head: number };
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

  // Yjs document store: maps noteId -> Y.Doc
  private yDocs = new Map<string, Y.Doc>();
  private yDocAwareness = new Map<string, Map<string, AwarenessState>>();
  private yDocCleanupTimers = new Map<string, NodeJS.Timeout>();

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
    const socketServer = this.getSocketServer(server);

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

        socketServer.adapter(createAdapter(this.pubClient, this.subClient));
        this.redisEnabled = true;
        this.logger.log('Collaboration gateway initialized with Redis adapter');
        return;
      } catch (error) {
        this.logger.warn(`Redis initialization attempt ${attempt} failed: ${String(error)}`);
        // Clean up created clients before retrying
        try { await this.pubClient?.quit(); } catch { void 0; }
        try { await this.subClient?.quit(); } catch { void 0; }
        this.pubClient = null;
        this.subClient = null;

        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        await new Promise((res) => setTimeout(res, delay));
      }
    }

    throw new Error(`Unable to connect to Redis after ${maxAttempts} attempts`);
  }

  private getSocketServer(server: Server): Server {
    const candidate = server as Server & { server?: Server };
    return typeof candidate.adapter === 'function' ? candidate : candidate.server ?? candidate;
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
      client.onAny((event, ...args) => {
        this.logger.log(`Socket ${client.id} event ${event} payload=${JSON.stringify(args[0] ?? null)}`);
      });

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
      await this.removeAwareness(entry.noteId, client.id);
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
    try {
      const { noteId } = data;
      const { userId, displayName } = client.data;

      // Leave any previous room
      const prevEntry = await this.getSocketRoom(client.id);
      if (prevEntry) {
        void client.leave(prevEntry.noteId);
        await this.removeAwareness(prevEntry.noteId, client.id);
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
      client.emit('yjs:awareness:list', {
        noteId,
        states: await this.getAwarenessStates(noteId, client.id),
      });
      await this.broadcastPresence(noteId);

      this.logger.log(`User ${userId} joined note ${noteId}`);
    } catch (error) {
      this.logger.error(`Error handling note:join: ${String(error)}`, error as Error);
      throw error;
    }
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
    @MessageBody() data: { noteId: string; content?: string; title?: string; isPinned?: boolean; isProtected?: boolean },
  ): Promise<void> {
    const entry = await this.getSocketRoom(client.id);
    if (!entry || entry.noteId !== data.noteId) {
      return;
    }

    const previousSnapshot = await this.readSnapshot(data.noteId);
    const nextContent = data.content ?? previousSnapshot?.content ?? '';

    await this.persistSnapshot(data.noteId, {
      title: data.title ?? previousSnapshot?.title ?? '',
      content: nextContent,
      isPinned: data.isPinned ?? previousSnapshot?.isPinned ?? false,
      updatedAt: new Date().toISOString(),
    });

    // Broadcast the content change to all OTHER clients in the room
    client.to(data.noteId).emit('note:updated', {
      userId: client.data.userId,
      content: nextContent,
      title: data.title,
      isPinned: data.isPinned,
      isProtected: data.isProtected,
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

  // ============ Yjs CRDT Message Handlers ============

  @SubscribeMessage('yjs:sync-step-1')
  async handleYjsSyncStep1(
    @ConnectedSocket() client: Socket & { data: { userId: string; displayName: string } },
    @MessageBody() data: { noteId: string; stateVector: number[] },
  ): Promise<void> {
    try {
      this.logger.log(`Received yjs:sync-step-1 from ${client.data.userId} for note ${data.noteId}`);
      const entry = await this.getSocketRoom(client.id);
      if (!entry || entry.noteId !== data.noteId) {
        this.logger.warn(`yjs:sync-step-1: Socket room entry not found or noteId mismatch`);
        return;
      }

      const yDoc = await this.getOrCreateYDoc(data.noteId);
      const update = Y.encodeStateAsUpdate(yDoc, new Uint8Array(data.stateVector));
      this.logger.log(`Sending yjs:sync-step-2 with ${update.length} bytes to ${client.data.userId}`);
      client.emit('yjs:sync-step-2', {
        noteId: data.noteId,
        update: Array.from(update),
      });
    } catch (error) {
      this.logger.error(`Error handling yjs:sync-step-1: ${String(error)}`, error as Error);
      throw error;
    }
  }

  @SubscribeMessage('yjs:sync-step-3')
  async handleYjsSyncStep3(
    @ConnectedSocket() client: Socket & { data: { userId: string; displayName: string } },
    @MessageBody() data: { noteId: string; update: number[] },
  ): Promise<void> {
    const entry = await this.getSocketRoom(client.id);
    if (!entry || entry.noteId !== data.noteId) {
      return;
    }

    const yDoc = await this.getOrCreateYDoc(data.noteId);
    Y.applyUpdate(yDoc, new Uint8Array(data.update));

    // Broadcast to other clients
    client.to(data.noteId).emit('yjs:update', {
      noteId: data.noteId,
      update: data.update,
    });

    // Persist to Redis
    await this.persistYDoc(data.noteId, yDoc);
  }

  @SubscribeMessage('yjs:update')
  async handleYjsUpdate(
    @ConnectedSocket() client: Socket & { data: { userId: string; displayName: string } },
    @MessageBody() data: { noteId: string; update: number[] },
  ): Promise<void> {
    const entry = await this.getSocketRoom(client.id);
    if (!entry || entry.noteId !== data.noteId) {
      return;
    }

    const yDoc = await this.getOrCreateYDoc(data.noteId);
    Y.applyUpdate(yDoc, new Uint8Array(data.update));

    // Broadcast to other clients
    client.to(data.noteId).emit('yjs:update', {
      noteId: data.noteId,
      update: data.update,
    });

    // Persist to Redis
    await this.persistYDoc(data.noteId, yDoc);
  }

  @SubscribeMessage('yjs:awareness')
  async handleYjsAwareness(
    @ConnectedSocket() client: Socket & { data: { userId: string; displayName: string } },
    @MessageBody() data: { noteId: string; awareness: AwarenessState },
  ): Promise<void> {
    const entry = await this.getSocketRoom(client.id);
    if (!entry || entry.noteId !== data.noteId) {
      return;
    }

    await this.setAwarenessState(data.noteId, client.id, {
      ...data.awareness,
      userId: client.data.userId,
      displayName: client.data.displayName,
      color: entry.user.color,
    });

    // Broadcast awareness to other clients
    client.to(data.noteId).emit('yjs:awareness:update', {
      noteId: data.noteId,
      states: await this.getAwarenessStates(data.noteId, client.id),
    });
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

  private snapshotKey(noteId: string): string {
    return `collab:note:${noteId}:snapshot`;
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

  private awarenessKey(noteId: string): string {
    return `collab:note:${noteId}:awareness`;
  }

  private async setAwarenessState(noteId: string, socketId: string, awareness: AwarenessState): Promise<void> {
    const current = this.yDocAwareness.get(noteId) ?? new Map<string, AwarenessState>();
    current.set(socketId, awareness);
    this.yDocAwareness.set(noteId, current);

    if (!this.redisEnabled) {
      return;
    }

    try {
      await this.redis.getClient().set(this.awarenessKey(noteId), JSON.stringify(Array.from(current.entries())));
    } catch (error) {
      this.markRedisUnavailable(error);
    }
  }

  private async removeAwareness(noteId: string, socketId: string): Promise<void> {
    const current = this.yDocAwareness.get(noteId);
    if (!current) {
      return;
    }

    current.delete(socketId);
    if (current.size === 0) {
      this.yDocAwareness.delete(noteId);
    } else {
      this.yDocAwareness.set(noteId, current);
    }

    if (!this.redisEnabled) {
      return;
    }

    try {
      if (current.size === 0) {
        await this.redis.getClient().del(this.awarenessKey(noteId));
      } else {
        await this.redis.getClient().set(this.awarenessKey(noteId), JSON.stringify(Array.from(current.entries())));
      }
    } catch (error) {
      this.markRedisUnavailable(error);
    }
  }

  private async getAwarenessStates(noteId: string, excludeSocketId?: string): Promise<AwarenessState[]> {
    const current = this.yDocAwareness.get(noteId);
    if (!current || current.size === 0) {
      return [];
    }

    return Array.from(current.entries())
      .filter(([socketId]) => socketId !== excludeSocketId)
      .map(([, state]) => state);
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

  private async persistSnapshot(noteId: string, snapshot: CollaborationSnapshot): Promise<void> {
    if (!this.redisEnabled) {
      this.logger.error('Redis adapter not initialized when persisting collaboration snapshot');
      throw new Error('Redis adapter not initialized');
    }

    try {
      await this.redis.getClient().set(this.snapshotKey(noteId), JSON.stringify(snapshot));
    } catch (error) {
      this.markRedisUnavailable(error);
    }
  }

  private async readSnapshot(noteId: string): Promise<CollaborationSnapshot | null> {
    if (!this.redisEnabled) {
      this.logger.error('Redis adapter not initialized when reading collaboration snapshot');
      throw new Error('Redis adapter not initialized');
    }

    try {
      const value = await this.redis.getClient().get(this.snapshotKey(noteId));
      if (!value) {
        return null;
      }

      return JSON.parse(value) as CollaborationSnapshot;
    } catch (error) {
      this.markRedisUnavailable(error);
      return null;
    }
  }

  // ============ Yjs Document Helpers ============

  private yDocKey(noteId: string): string {
    return `collab:ydoc:${noteId}`;
  }

  private async getOrCreateYDoc(noteId: string): Promise<Y.Doc> {
    // Return cached instance if available
    if (this.yDocs.has(noteId)) {
      return this.yDocs.get(noteId)!;
    }

    const yDoc = new Y.Doc();

    // Try to load persisted state from Redis
    const persistedState = await this.readYDocState(noteId);
    if (persistedState) {
      try {
        Y.applyUpdate(yDoc, new Uint8Array(persistedState.updates.flat()));
      } catch (error) {
        this.logger.warn(`Failed to apply persisted Yjs state for note ${noteId}: ${String(error)}`);
      }
    }

    this.yDocs.set(noteId, yDoc);

    // Set up cleanup timer: unload doc after 5 minutes of inactivity
    this.resetYDocCleanupTimer(noteId);

    this.logger.log(`Created/loaded Yjs document for note ${noteId}`);
    return yDoc;
  }

  private resetYDocCleanupTimer(noteId: string): void {
    if (this.yDocCleanupTimers.has(noteId)) {
      clearTimeout(this.yDocCleanupTimers.get(noteId));
    }

    const timer = setTimeout(() => {
      const yDoc = this.yDocs.get(noteId);
      if (yDoc) {
        yDoc.destroy();
        this.yDocs.delete(noteId);
        this.yDocAwareness.delete(noteId);
        this.yDocCleanupTimers.delete(noteId);
        this.logger.log(`Unloaded Yjs document for note ${noteId} due to inactivity`);
      }
    }, 5 * 60 * 1000); // 5 minutes

    this.yDocCleanupTimers.set(noteId, timer);
  }

  private async persistYDoc(noteId: string, yDoc: Y.Doc): Promise<void> {
    if (!this.redisEnabled) {
      this.logger.error('Redis adapter not initialized when persisting Yjs document');
      throw new Error('Redis adapter not initialized');
    }

    try {
      const state = Y.encodeStateAsUpdate(yDoc);
      await this.redis.getClient().set(
        this.yDocKey(noteId),
        JSON.stringify({
          stateVector: Array.from(state),
          updates: [Array.from(state)],
          timestamp: Date.now(),
        } as YDocState),
      );
    } catch (error) {
      this.markRedisUnavailable(error);
    }
  }

  private async readYDocState(noteId: string): Promise<YDocState | null> {
    if (!this.redisEnabled) {
      return null;
    }

    try {
      const value = await this.redis.getClient().get(this.yDocKey(noteId));
      if (!value) {
        return null;
      }

      return JSON.parse(value) as YDocState;
    } catch (error) {
      this.logger.warn(`Failed to read Yjs state for note ${noteId}: ${String(error)}`);
      return null;
    }
  }

  private async clearYDocState(noteId: string): Promise<void> {
    if (!this.redisEnabled) {
      return;
    }

    try {
      await this.redis.getClient().del(this.yDocKey(noteId));
    } catch (error) {
      this.logger.warn(`Failed to clear Yjs state for note ${noteId}: ${String(error)}`);
    }
  }
}
