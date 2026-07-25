import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { NOTE_REVISION_QUERY_DAO, type INoteRevisionQueryDao } from '@modules/notes/application/ports/dao/note-revision-query.dao.port';
import { GetNoteHistoryQuery } from '@modules/notes/application/queries/get-note-history/get-note-history.query';
import { NotePermissionDeniedError, NoteNotFoundError } from '@modules/notes/domain/errors/note.errors';
import { NOTE_ACCESS_PORT, type INoteAccessPort } from '@modules/notes/application/ports/security/note-access.port';
import type { NoteRevisionSummaryDto } from '@modules/notes/presentation/http/dto/note-revision-summary.dto';

export type { NoteRevisionSummaryDto };

@QueryHandler(GetNoteHistoryQuery)
export class GetNoteHistoryQueryHandler implements IQueryHandler<GetNoteHistoryQuery> {
  constructor(
    @Inject(NOTE_ACCESS_PORT)
    private readonly noteAccessPort: INoteAccessPort,
    @Inject(NOTE_REVISION_QUERY_DAO)
    private readonly revisionQueryDao: INoteRevisionQueryDao,
  ) {}

  async execute(query: GetNoteHistoryQuery): Promise<NoteRevisionSummaryDto[]> {
    const { userId, noteId } = query;

    // Access check on PostgreSQL — strongly consistent, never from projection
    const access = await this.noteAccessPort.checkAccess(noteId, userId);

    if (!access) throw new NoteNotFoundError(noteId);
    if (!access.isOwner) {
      throw new NotePermissionDeniedError('Only the note owner can view version history');
    }

    return this.revisionQueryDao.findByNoteId(noteId);
  }
}
