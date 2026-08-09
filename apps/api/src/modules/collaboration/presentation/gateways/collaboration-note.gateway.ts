import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, Inject } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Server, Socket } from 'socket.io';
import { COLLABORATION_NAMESPACE } from '@modules/collaboration/collaboration.constants';
import { COLLABORATION_STATE_PORT } from '@modules/collaboration/application/ports/collaboration-state.port';
import type { ICollaborationStatePort } from '@modules/collaboration/application/ports/collaboration-state.port';
import { NOTE_ACCESS_PORT } from '@modules/collaboration/application/ports/note-access.port';
import type { INoteAccessPort } from '@modules/collaboration/application/ports/note-access.port';
import { RedisService } from '@shared/infrastructure/redis/redis.service';
import type { EnvConfig } from '@config/env.validation';
import { DeleteNoteCommand } from '@modules/notes/application/commands/delete-note/delete-note.command';

@WebSocketGateway({
  namespace: COLLABORATION_NAMESPACE,
})
export class CollaborationNoteGateway {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(CollaborationNoteGateway.name);

  constructor(
    @Inject(COLLABORATION_STATE_PORT)
    private readonly statePort: ICollaborationStatePort,
    @Inject(NOTE_ACCESS_PORT)
    private readonly accessPort: INoteAccessPort,
    private readonly redis: RedisService,
    @Inject('ENV_CONFIG') private readonly env: EnvConfig,
    private readonly commandBus: CommandBus,
  ) {}

  @SubscribeMessage('note:update')
  async handleNoteUpdate(
    @ConnectedSocket() client: Socket & { data: { userId: string; displayName: string } },
    @MessageBody() data: { noteId: string; content?: string; title?: string; isPinned?: boolean; isProtected?: boolean },
  ): Promise<void> {
    const entry = await this.statePort.getSocketRoom(client.id);
    if (!entry || entry.noteId !== data.noteId) return;

    // ─── Authorization: only EDIT-permission users may update note content ───
    const permissions = await this.accessPort.getAccessPermissions(client.data.userId, data.noteId);
    if (!permissions?.canEdit) {
      this.logger.warn(
        `User ${client.data.userId} attempted note:update on ${data.noteId} without EDIT permission — rejected`,
      );
      client.emit('error', { message: 'You do not have permission to edit this note' });
      return;
    }

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

    await this.redis.getClient().set(key, JSON.stringify(snapshot), 'EX', this.env.CACHE_TTL_COLLAB_SNAPSHOT_SECONDS);

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

    // ─── Authorization: only the note OWNER may delete ───
    const permissions = await this.accessPort.getAccessPermissions(client.data.userId, data.noteId);
    if (!permissions?.isOwner) {
      this.logger.warn(
        `User ${client.data.userId} attempted note:delete on ${data.noteId} without ownership — rejected`,
      );
      client.emit('error', { message: 'Only the note owner can delete this note' });
      return;
    }

    try {
      await this.commandBus.execute(new DeleteNoteCommand(client.data.userId, data.noteId));
    } catch (error) {
      this.logger.warn(
        `Failed to delete note ${data.noteId} for user ${client.data.userId}: ${String(error)}`,
      );
      client.emit('error', { message: 'Failed to delete note' });
    }
  }

  @SubscribeMessage('note:typing')
  async handleTypingUpdate(
    @ConnectedSocket() client: Socket & { data: { userId: string; displayName: string } },
    @MessageBody() data: { noteId: string; isTyping: boolean },
  ): Promise<void> {
    const entry = await this.statePort.getSocketRoom(client.id);
    if (!entry || entry.noteId !== data.noteId) return;

    // ─── S-2 fix: re-validate access each event — catches post-revoke stale sessions ─
    const permissions = await this.accessPort.getAccessPermissions(client.data.userId, data.noteId);
    if (!permissions) {
      this.logger.warn(
        `User ${client.data.userId} typing event rejected — access revoked for note ${data.noteId}`,
      );
      client.disconnect();
      return;
    }

    if (data.isTyping) {
      await this.statePort.setTyping(data.noteId, entry.user);
    } else {
      await this.statePort.removeTyping(data.noteId, entry.user.userId);
    }

    const typingUsers = await this.statePort.getTyping(data.noteId);
    this.server.to(data.noteId).emit('typing:list', typingUsers);
  }
}
