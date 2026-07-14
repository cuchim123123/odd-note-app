import {
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit } from '@nestjs/websockets';
import { Logger, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createAdapter } from '@socket.io/redis-adapter';
import { JwtConfigService } from '../../../../config';
import { RedisService } from '../../../../redis/redis.service';
import { Server, Socket } from 'socket.io';
import type Redis from 'ioredis';
import { COLLABORATION_NAMESPACE, REDIS_EVENT_TYPES } from '../../collaboration.constants';
import { COLLABORATION_STATE_PORT } from '../../application/ports/collaboration-state.port';
import type { ICollaborationStatePort } from '../../application/ports/collaboration-state.port';

@WebSocketGateway({
  namespace: COLLABORATION_NAMESPACE,
})
export class CollaborationConnectionGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(CollaborationConnectionGateway.name);
  private pubClient: Redis | null = null;
  private subClient: Redis | null = null;
  private internalSubClient: Redis | null = null;

  constructor(
    private readonly jwtService: JwtService,
    private readonly jwtConfig: JwtConfigService,
    private readonly redis: RedisService,
    @Inject(COLLABORATION_STATE_PORT)
    private readonly statePort: ICollaborationStatePort,
  ) {}

  afterInit(server: Server): void {
    void this.initializeRedisAdapter(server).catch((err) => {
      this.logger.error('Failed to initialize Redis adapter for collaboration', err as Error);
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
        this.internalSubClient = this.redis.createClient();

        await Promise.all([
          this.redis.getClient().ping(),
          this.pubClient!.ping(),
          this.subClient!.ping(),
          this.internalSubClient!.ping(),
        ]);

        socketServer.adapter(createAdapter(this.pubClient!, this.subClient!));
        
        await this.internalSubClient!.subscribe('collaboration:events');
        this.internalSubClient!.on('message', (channel, message) => {
          if (channel === 'collaboration:events') {
            try {
              const event = JSON.parse(message) as { type: string; noteId?: string };
              if (event.type === 'permissions_updated' && event.noteId) {
                this.server.emit('note:permissions_updated', { noteId: event.noteId });
              } else if (event.type === 'note_deleted' && event.noteId) {
                this.server.emit('note:deleted', { noteId: event.noteId });
              } else if (event.type === REDIS_EVENT_TYPES.NOTIFICATION_CREATED) {
                const notifEvent = JSON.parse(message) as { userId: string; notification: unknown };
                this.server.to(`user:${notifEvent.userId}`).emit('notification:new', notifEvent.notification);
              }
            } catch (err) {
              this.logger.error('Failed to process internal collaboration event', err as Error);
            }
          }
        });

        this.logger.log('Collaboration connection gateway initialized with Redis adapter');
        return;
      } catch (error) {
        this.logger.warn(`Redis initialization attempt ${attempt} failed: ${String(error)}`);
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

  private extractToken(client: Socket): string | null {
    return (client.handshake.auth?.token as string) ?? (client.handshake.query?.token as string) ?? null;
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      if (!token) {
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

      (client as Socket & { data: { userId: string; displayName: string } }).data = {
        userId: payload.sub,
        displayName: payload.displayName ?? 'Anonymous',
      };

      void client.join(`user:${payload.sub}`);
      this.logger.log(`Client ${client.id} authenticated as user ${payload.sub}`);
    } catch (error) {
      this.logger.warn(`Client ${client.id} failed auth: ${error}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    try {
      const entry = await this.statePort.getSocketRoom(client.id);
      if (entry) {
        await this.statePort.removeParticipant(entry.noteId, client.id);
        await this.statePort.removeTyping(entry.noteId, entry.user.userId);
        
        client.to(entry.noteId).emit('collaborator:left', { userId: entry.user.userId });
        
        const [collaborators, typing] = await Promise.all([
          this.statePort.getParticipants(entry.noteId),
          this.statePort.getTyping(entry.noteId)
        ]);
        
        this.server.to(entry.noteId).emit('collaborators:list', collaborators);
        this.server.to(entry.noteId).emit('presence:list', collaborators);
        this.server.to(entry.noteId).emit('typing:list', typing);
      }

      await this.statePort.clearSocketRoom(client.id);
      this.logger.log(`Client ${client.id} disconnected`);
    } catch (error) {
      this.logger.error(`Error in handleDisconnect for ${client.id}`, error as Error);
    }
  }
}
