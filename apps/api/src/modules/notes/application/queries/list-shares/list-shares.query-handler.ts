 
import { QueryHandler } from '@nestjs/cqrs';
import type { IQueryHandler } from '@nestjs/cqrs';
import { NotePermissionDeniedError } from '@modules/notes/domain/errors/note.errors';
import { ListSharesQuery } from '@modules/notes/application/queries/list-shares/list-shares.query';
import type { NoteShareResponseDto } from '@modules/notes/presentation/http/dto/note.response.dto';
import { NOTE_QUERY_DAO, type INoteQueryDao } from '@modules/notes/application/ports/dao/note-query.dao.port';
import { Inject } from '@nestjs/common';

@QueryHandler(ListSharesQuery)
export class ListSharesQueryHandler implements IQueryHandler<ListSharesQuery> {
  constructor(
    @Inject(NOTE_QUERY_DAO)
    private readonly noteQueryDao: INoteQueryDao,
  ) {}

  async execute(query: ListSharesQuery): Promise<NoteShareResponseDto[]> {
    const { userId, noteId } = query;

    const shares = await this.noteQueryDao.findNoteShares(noteId, userId);
    if (!shares) throw new NotePermissionDeniedError('Note not found or you do not have permission to view its shares');

    return shares;
  }
}
