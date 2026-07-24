import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { NOTE_QUERY_DAO, type INoteQueryDao } from '@modules/notes/application/ports/dao/note-query.dao.port';
import { NOTE_REVISION_QUERY_DAO, type INoteRevisionQueryDao } from '@modules/notes/application/ports/dao/note-revision-query.dao.port';
import { GetNoteHistoryQuery } from '@modules/notes/application/queries/get-note-history/get-note-history.query';
import { NotePermissionDeniedError, NoteNotFoundError } from '@modules/notes/domain/errors/note.errors';
import type { NoteRevisionSummaryDto } from '@modules/notes/presentation/http/dto/note-revision-summary.dto';

export type { NoteRevisionSummaryDto };

@QueryHandler(GetNoteHistoryQuery)
export class GetNoteHistoryQueryHandler implements IQueryHandler<GetNoteHistoryQuery> {
  constructor(
    @Inject(NOTE_QUERY_DAO)
    private readonly noteQueryDao: INoteQueryDao,
    @Inject(NOTE_REVISION_QUERY_DAO)
    private readonly revisionQueryDao: INoteRevisionQueryDao,
  ) {}

  async execute(query: GetNoteHistoryQuery): Promise<NoteRevisionSummaryDto[]> {
    const { userId, noteId } = query;

    /**
     * P-4 fix: single query that selects userId for the ownership check.
     * Previous implementation made two separate findFirst() calls:
     *  1) existence + access (OR[owner, shared])
     *  2) ownership re-check (where: { userId })
     * Both can be collapsed by projecting userId and comparing in-memory.
     */
    const access = await this.noteQueryDao.checkAccess(noteId, userId);

    if (!access) throw new NoteNotFoundError(noteId);
    if (!access.isOwner) {
      throw new NotePermissionDeniedError('Only the note owner can view version history');
    }

    const revisions = await this.revisionQueryDao.findByNoteId(noteId);

    return revisions;
  }
}
