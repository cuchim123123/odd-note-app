import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, Inject } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { COLLABORATION_NAMESPACE, COLLABORATOR_COLORS } from '@modules/collaboration/collaboration.constants';
import { COLLABORATION_STATE_PORT } from '@modules/collaboration/application/ports/collaboration-state.port';
import type { ICollaborationStatePort } from '@modules/collaboration/application/ports/collaboration-state.port';
import { NOTE_ACCESS_PORT } from '@modules/collaboration/application/ports/note-access.port';
import type { INoteAccessPort } from '@modules/collaboration/application/ports/note-access.port';
import { CollaborationSessionEntity } from '@modules/collaboration/domain/entities/collaboration-session.entity';

@WebSocketGateway({
  namespace: COLLABORATION_NAMESPACE,
})
export class CollaborationPresenceGateway {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(CollaborationPresenceGateway.name);

  constructor(
    @Inject(COLLABORATION_STATE_PORT)
    private readonly statePort: ICollaborationStatePort,
    @Inject(NOTE_ACCESS_PORT)
    private readonly accessPort: INoteAccessPort,
  ) {}

  @SubscribeMessage('note:join')
  async handleJoinNote(
    @ConnectedSocket() client: Socket & { data: { userId: string; displayName: string } },
    @MessageBody() data: { noteId: string; unlockToken?: string },
  ): Promise<void> {
    try {
      const { noteId, unlockToken } = data;
      const { userId, displayName } = client.data;

      const hasAccess = await this.accessPort.canAccessNote(userId, noteId, unlockToken);
      if (!hasAccess) {
        this.logger.warn(`User ${userId} attempted to join unauthorized/locked note ${noteId} — disconnecting`);
        client.disconnect();
        return;
      }

      // Leave any previous room
      const prevEntry = await this.statePort.getSocketRoom(client.id);
      if (prevEntry) {
        void client.leave(prevEntry.noteId);
        await this.statePort.removeParticipant(prevEntry.noteId, client.id);
        await this.statePort.removeTyping(prevEntry.noteId, prevEntry.user.userId);
        
        client.to(prevEntry.noteId).emit('collaborator:left', { userId: prevEntry.user.userId });
        
        const [prevCollab, prevTyping] = await Promise.all([
          this.statePort.getParticipants(prevEntry.noteId),
          this.statePort.getTyping(prevEntry.noteId)
        ]);
        
        this.server.to(prevEntry.noteId).emit('collaborators:list', prevCollab);
        this.server.to(prevEntry.noteId).emit('presence:list', prevCollab);
        this.server.to(prevEntry.noteId).emit('typing:list', prevTyping);
      }

      const roomSockets = await this.statePort.getParticipants(noteId);
      const colorIndex = roomSockets.length % COLLABORATOR_COLORS.length;

      const session = new CollaborationSessionEntity(
        client.id,
        noteId,
        userId,
        displayName,
        COLLABORATOR_COLORS[colorIndex] ?? '#ef4444',
        new Date()
      );

      const collaborator = {
        userId: session.userId,
        displayName: session.displayName,
        color: session.color,
      };

      void client.join(noteId);
      await this.statePort.saveSocketRoom(client.id, noteId, collaborator);
      await this.statePort.addParticipant(noteId, client.id, collaborator);

      client.to(noteId).emit('collaborator:joined', collaborator);

      const [collaborators, typing] = await Promise.all([
        this.statePort.getParticipants(noteId),
        this.statePort.getTyping(noteId)
      ]);
      
      client.emit('collaborators:list', collaborators);
      client.emit('presence:list', collaborators);
      client.emit('typing:list', typing);
      this.server.to(noteId).emit('presence:list', collaborators);

      this.logger.log(`User ${userId} joined note ${noteId}`);
    } catch (error) {
      this.logger.error(`Error handling note:join: ${String(error)}`, error as Error);
    }
  }

  @SubscribeMessage('note:leave')
  async handleLeaveNote(
    @ConnectedSocket() client: Socket & { data: { userId: string; displayName: string } },
  ): Promise<void> {
    const entry = await this.statePort.getSocketRoom(client.id);
    if (entry) {
      void client.leave(entry.noteId);
      await this.statePort.removeParticipant(entry.noteId, client.id);
      await this.statePort.removeTyping(entry.noteId, entry.user.userId);
      await this.statePort.clearSocketRoom(client.id);
      
      client.to(entry.noteId).emit('collaborator:left', { userId: entry.user.userId });
      
      const [collaborators, typing] = await Promise.all([
        this.statePort.getParticipants(entry.noteId),
        this.statePort.getTyping(entry.noteId)
      ]);
      
      this.server.to(entry.noteId).emit('collaborators:list', collaborators);
      this.server.to(entry.noteId).emit('presence:list', collaborators);
      this.server.to(entry.noteId).emit('typing:list', typing);
    }
  }
}
