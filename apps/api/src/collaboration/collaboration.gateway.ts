import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtConfigService } from '../config';
import { Server, Socket } from 'socket.io';

type CollaboratorInfo = {
  userId: string;
  displayName: string;
  color: string;
};

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
export class CollaborationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(CollaborationGateway.name);

  /**
   * Maps a socket ID to the note room it joined plus user metadata.
   */
  private readonly socketRooms = new Map<string, { noteId: string; user: CollaboratorInfo }>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly jwtConfig: JwtConfigService,
  ) {}

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

  handleDisconnect(client: Socket): void {
    const entry = this.socketRooms.get(client.id);
    if (entry) {
      // Notify others in the room that this collaborator left
      client.to(entry.noteId).emit('collaborator:left', { userId: entry.user.userId });
      this.socketRooms.delete(client.id);

      // Broadcast updated collaborator list
      this.broadcastCollaborators(entry.noteId);
    }
    this.logger.log(`Client ${client.id} disconnected`);
  }

  @SubscribeMessage('note:join')
  handleJoinNote(
    @ConnectedSocket() client: Socket & { data: { userId: string; displayName: string } },
    @MessageBody() data: { noteId: string },
  ): void {
    const { noteId } = data;
    const { userId, displayName } = client.data;

    // Leave any previous room
    const prevEntry = this.socketRooms.get(client.id);
    if (prevEntry) {
      void client.leave(prevEntry.noteId);
      client.to(prevEntry.noteId).emit('collaborator:left', { userId: prevEntry.user.userId });
      this.broadcastCollaborators(prevEntry.noteId);
    }

    // Assign a color based on how many collaborators are in the room
    const roomSockets = this.getCollaboratorsInRoom(noteId);
    const colorIndex = roomSockets.length % COLLABORATOR_COLORS.length;

    const collaborator: CollaboratorInfo = {
      userId,
      displayName,
      color: COLLABORATOR_COLORS[colorIndex] ?? COLLABORATOR_COLORS[0] ?? '#ef4444',
    };

    void client.join(noteId);
    this.socketRooms.set(client.id, { noteId, user: collaborator });

    // Notify the room about the new collaborator
    client.to(noteId).emit('collaborator:joined', collaborator);

    // Send the joining client the current list of collaborators
    const collaborators = this.getCollaboratorsInRoom(noteId);
    client.emit('collaborators:list', collaborators);

    this.logger.log(`User ${userId} joined note ${noteId}`);
  }

  @SubscribeMessage('note:leave')
  handleLeaveNote(
    @ConnectedSocket() client: Socket & { data: { userId: string; displayName: string } },
  ): void {
    const entry = this.socketRooms.get(client.id);
    if (entry) {
      void client.leave(entry.noteId);
      client.to(entry.noteId).emit('collaborator:left', { userId: entry.user.userId });
      this.socketRooms.delete(client.id);
      this.broadcastCollaborators(entry.noteId);
    }
  }

  @SubscribeMessage('note:update')
  handleNoteUpdate(
    @ConnectedSocket() client: Socket & { data: { userId: string; displayName: string } },
    @MessageBody() data: { noteId: string; content: string; title?: string },
  ): void {
    const entry = this.socketRooms.get(client.id);
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
  handleCursorUpdate(
    @ConnectedSocket() client: Socket & { data: { userId: string; displayName: string } },
    @MessageBody() data: { noteId: string; position: number },
  ): void {
    const entry = this.socketRooms.get(client.id);
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

  private extractToken(client: Socket): string | null {
    // Try auth.token first, then query param
    const authToken = client.handshake.auth?.token as string | undefined;
    if (authToken) return authToken;

    const queryToken = client.handshake.query?.token as string | undefined;
    return queryToken ?? null;
  }

  private getCollaboratorsInRoom(noteId: string): CollaboratorInfo[] {
    const collaborators: CollaboratorInfo[] = [];
    for (const [, entry] of this.socketRooms) {
      if (entry.noteId === noteId) {
        collaborators.push(entry.user);
      }
    }
    return collaborators;
  }

  private broadcastCollaborators(noteId: string): void {
    const collaborators = this.getCollaboratorsInRoom(noteId);
    this.server.to(noteId).emit('collaborators:list', collaborators);
  }
}
