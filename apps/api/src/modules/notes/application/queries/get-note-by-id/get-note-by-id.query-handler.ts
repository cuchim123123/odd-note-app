import { QueryHandler } from '@nestjs/cqrs';
import type { IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { NoteNotFoundError } from '@modules/notes/domain/errors/note.errors';
import { GetNoteByIdQuery } from '@modules/notes/application/queries/get-note-by-id/get-note-by-id.query';
import { DOCUMENT_SYNC_PORT, type IDocumentSyncPort } from '@modules/notes/application/ports/document-sync.port';
import { NOTE_PROTECTION_PORT, type INoteProtectionPort } from '@modules/notes/application/ports/note-protection.port';
import type { NoteResponseDto } from '@modules/notes/presentation/http/dto/note.response.dto';
import { NOTE_QUERY_DAO, type INoteQueryDao } from '@modules/notes/application/ports/note-query.dao.port';

@QueryHandler(GetNoteByIdQuery)
export class GetNoteByIdQueryHandler implements IQueryHandler<GetNoteByIdQuery> {
  constructor(
    @Inject(NOTE_QUERY_DAO)
    private readonly noteQueryDao: INoteQueryDao,
    @Inject(DOCUMENT_SYNC_PORT)
    private readonly documentSyncPort: IDocumentSyncPort,
    @Inject(NOTE_PROTECTION_PORT)
    private readonly protectionPort: INoteProtectionPort,
  ) {}

  async execute(query: GetNoteByIdQuery): Promise<NoteResponseDto> {
    const { userId, noteId, unlockToken } = query;

    const note = await this.noteQueryDao.findNoteById(noteId, userId);
    if (!note) throw new NoteNotFoundError(noteId);

    const isProtected = note.isProtected;
    let content = await this.documentSyncPort.readContent(noteId) ?? note.content ?? '';

    // Server-side content gate: blank content if protected and unlockToken is invalid
    if (isProtected) {
      const isUnlocked = await this.protectionPort.verifyUnlockToken(userId, noteId, unlockToken);
      if (!isUnlocked) content = '';
    }

    return {
      ...note,
      content,
    };
  }
}
