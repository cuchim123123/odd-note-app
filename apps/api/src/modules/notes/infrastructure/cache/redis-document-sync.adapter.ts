import { Injectable } from '@nestjs/common';
import type { IDocumentSyncPort } from '@modules/notes/application/ports/services/document-sync.port';
import { NotesCrdtService } from '@modules/notes/infrastructure/crdt/notes-crdt.service';

@Injectable()
export class RedisDocumentSyncAdapter implements IDocumentSyncPort {
  constructor(private readonly notesCrdtService: NotesCrdtService) {}

  async readContent(noteId: string): Promise<string | null> {
    return this.notesCrdtService.readYDocContent(noteId);
  }

  async persistSnapshot(noteId: string, title: string, content: string | null, isPinned: boolean, updatedAt: Date): Promise<void> {
    await this.notesCrdtService.persistCollaborationSnapshot(noteId, title, content, isPinned, updatedAt);
  }

  async clearState(noteId: string): Promise<void> {
    await this.notesCrdtService.clearYDocState(noteId);
    await this.notesCrdtService.clearCollaborationSnapshot(noteId);
  }
}
