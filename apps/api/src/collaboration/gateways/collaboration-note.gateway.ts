import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, Inject } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { COLLABORATION_NAMESPACE } from '../collaboration.constants';
import { COLLABORATION_STATE_PORT } from '../application/ports/collaboration-state.port';
import type { ICollaborationStatePort } from '../application/ports/collaboration-state.port';
import { YJS_DOCUMENT_PORT } from '../application/ports/yjs-document.port';
import type { IYjsDocumentPort } from '../application/ports/yjs-document.port';
import { RedisService } from '../../redis/redis.service';

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: COLLABORATION_NAMESPACE,
})
export class CollaborationNoteGateway {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(CollaborationNoteGateway.name);

  constructor(
    @Inject(COLLABORATION_STATE_PORT)
    private readonly statePort: ICollaborationStatePort,
    @Inject(YJS_DOCUMENT_PORT)
    private readonly yjsPort: IYjsDocumentPort,
    private readonly redis: RedisService,
  ) {}

  @SubscribeMessage('note:update')
  async handleNoteUpdate(
    @ConnectedSocket() client: Socket & { data: { userId: string; displayName: string } },
    @MessageBody() data: { noteId: string; content?: string; title?: string; isPinned?: boolean; isProtected?: boolean },
  ): Promise<void> {
    const entry = await this.statePort.getSocketRoom(client.id);
    if (!entry || entry.noteId !== data.noteId) return;

    // Fallback Redis snapshot for non-Yjs fields
    const key = `collab:note:${data.noteId}:snapshot`;
    const prevRaw = await this.redis.getClient().get(key);
    const prev = prevRaw ? JSON.parse(prevRaw) : null;
    
    const nextContent = data.content ?? prev?.content ?? '';
    const snapshot = {
      title: data.title ?? prev?.title ?? '',
      content: nextContent,
      isPinned: data.isPinned ?? prev?.isPinned ?? false,
      updatedAt: new Date().toISOString(),
    };
    
    await this.redis.getClient().set(key, JSON.stringify(snapshot));

    client.to(data.noteId).emit('note:updated', {
      userId: client.data.userId,
      content: nextContent,
      title: data.title,
      isPinned: data.isPinned,
      isProtected: data.isProtected,
      timestamp: Date.now(),
    });
  }

  @SubscribeMessage('note:delete')
  async handleNoteDelete(
    @ConnectedSocket() client: Socket & { data: { userId: string; displayName: string } },
    @MessageBody() data: { noteId: string },
  ): Promise<void> {
    const entry = await this.statePort.getSocketRoom(client.id);
    if (!entry || entry.noteId !== data.noteId) return;

    this.logger.log(`User ${client.data.userId} deleted note ${data.noteId} - broadcasting globally`);
    this.server.emit('note:deleted', { noteId: data.noteId });

    // Cleanup note presence, snapshot and yjs states
    await Promise.all([
      this.redis.getClient().del(`collab:note:${data.noteId}:participants`),
      this.redis.getClient().del(`collab:note:${data.noteId}:typing`),
      this.redis.getClient().del(`collab:note:${data.noteId}:snapshot`),
      this.yjsPort.destroyDocument(data.noteId)
    ]);
  }

  @SubscribeMessage('note:typing')
  async handleTypingUpdate(
    @ConnectedSocket() client: Socket & { data: { userId: string; displayName: string } },
    @MessageBody() data: { noteId: string; isTyping: boolean },
  ): Promise<void> {
    const entry = await this.statePort.getSocketRoom(client.id);
    if (!entry || entry.noteId !== data.noteId) return;

    if (data.isTyping) {
      await this.statePort.setTyping(data.noteId, entry.user);
    } else {
      await this.statePort.removeTyping(data.noteId, entry.user.userId);
    }

    const typingUsers = await this.statePort.getTyping(data.noteId);
    this.server.to(data.noteId).emit('typing:list', typingUsers);
  }
}
