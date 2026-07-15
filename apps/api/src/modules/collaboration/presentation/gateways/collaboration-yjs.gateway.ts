import {
  WebSocketGateway,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, Inject } from '@nestjs/common';
import { Socket } from 'socket.io';
import { COLLABORATION_NAMESPACE } from '@modules/collaboration/collaboration.constants';
import { COLLABORATION_STATE_PORT } from '@modules/collaboration/application/ports/collaboration-state.port';
import type { ICollaborationStatePort } from '@modules/collaboration/application/ports/collaboration-state.port';
import { YJS_DOCUMENT_PORT } from '@modules/collaboration/application/ports/yjs-document.port';
import type { IYjsDocumentPort } from '@modules/collaboration/application/ports/yjs-document.port';
import { NOTE_ACCESS_PORT } from '@modules/collaboration/application/ports/note-access.port';
import type { INoteAccessPort } from '@modules/collaboration/application/ports/note-access.port';

@WebSocketGateway({
  namespace: COLLABORATION_NAMESPACE,
})
export class CollaborationYjsGateway {
  private readonly logger = new Logger(CollaborationYjsGateway.name);

  constructor(
    @Inject(COLLABORATION_STATE_PORT)
    private readonly statePort: ICollaborationStatePort,
    @Inject(YJS_DOCUMENT_PORT)
    private readonly yjsPort: IYjsDocumentPort,
    @Inject(NOTE_ACCESS_PORT)
    private readonly accessPort: INoteAccessPort,
  ) {}

  @SubscribeMessage('yjs:sync-step-1')
  async handleYjsSyncStep1(
    @ConnectedSocket() client: Socket & { data: { userId: string; displayName: string } },
    @MessageBody() data: { noteId: string; stateVector: number[] },
  ): Promise<void> {
    try {
      this.logger.log(`Received yjs:sync-step-1 from ${client.data.userId} for note ${data.noteId}`);
      const entry = await this.statePort.getSocketRoom(client.id);
      if (!entry || entry.noteId !== data.noteId) return;

      const update = await this.yjsPort.encodeStateAsUpdate(data.noteId, new Uint8Array(data.stateVector));
      const stateVector = await this.yjsPort.getStateVector(data.noteId);

      if (update && stateVector) {
        client.emit('yjs:sync-step-2', {
          noteId: data.noteId,
          update: Array.from(update),
          stateVector: Array.from(stateVector),
        });
      }
    } catch (error) {
      this.logger.error(`Error handling yjs:sync-step-1: ${String(error)}`, error as Error);
    }
  }

  /**
   * yjs:sync-step-3 — client pushes its full document state to the server.
   * ─── Authorization: requires EDIT permission ─────────────────────────────
   * READ-only collaborators may receive Yjs updates but must NOT be able to
   * write document state. Without this check a READ user can silently corrupt
   * the document by sending a stale or malicious state vector.
   */
  @SubscribeMessage('yjs:sync-step-3')
  async handleYjsSyncStep3(
    @ConnectedSocket() client: Socket & { data: { userId: string; displayName: string } },
    @MessageBody() data: { noteId: string; update: number[] },
  ): Promise<void> {
    const entry = await this.statePort.getSocketRoom(client.id);
    if (!entry || entry.noteId !== data.noteId) return;

    // ─── S-3 fix: enforce EDIT permission on all CRDT write events ───────────
    const permissions = await this.accessPort.getAccessPermissions(client.data.userId, data.noteId);
    if (!permissions?.canEdit) {
      this.logger.warn(
        `User ${client.data.userId} attempted yjs:sync-step-3 on ${data.noteId} without EDIT permission — rejected`,
      );
      client.emit('error', { message: 'You do not have permission to edit this note' });
      return;
    }

    this.logger.log(`[Yjs] recv yjs:sync-step-3 note=${data.noteId} from=${client.data.userId} bytes=${data.update?.length ?? 0}`);

    await this.yjsPort.applyUpdate(data.noteId, new Uint8Array(data.update));

    client.to(data.noteId).emit('yjs:update', {
      noteId: data.noteId,
      update: data.update,
    });
  }

  /**
   * yjs:update — incremental CRDT delta broadcast.
   * ─── Authorization: requires EDIT permission ─────────────────────────────
   */
  @SubscribeMessage('yjs:update')
  async handleYjsUpdate(
    @ConnectedSocket() client: Socket & { data: { userId: string; displayName: string } },
    @MessageBody() data: { noteId: string; update: number[] },
  ): Promise<void> {
    const entry = await this.statePort.getSocketRoom(client.id);
    if (!entry || entry.noteId !== data.noteId) return;

    // ─── S-3 fix: enforce EDIT permission on all CRDT write events ───────────
    const permissions = await this.accessPort.getAccessPermissions(client.data.userId, data.noteId);
    if (!permissions?.canEdit) {
      this.logger.warn(
        `User ${client.data.userId} attempted yjs:update on ${data.noteId} without EDIT permission — rejected`,
      );
      client.emit('error', { message: 'You do not have permission to edit this note' });
      return;
    }

    await this.yjsPort.applyUpdate(data.noteId, new Uint8Array(data.update));

    client.to(data.noteId).emit('yjs:update', {
      noteId: data.noteId,
      update: data.update,
    });
  }
}
