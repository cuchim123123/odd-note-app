import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { SearchNotesQuery } from './search-notes.query';
import { NOTE_SEARCH_DAO } from '@modules/notes/application/ports/dao/note-search.dao.port';
import type { INoteSearchDao, NoteSearchResult } from '@modules/notes/application/ports/dao/note-search.dao.port';

@QueryHandler(SearchNotesQuery)
export class SearchNotesQueryHandler implements IQueryHandler<SearchNotesQuery> {
  constructor(
    @Inject(NOTE_SEARCH_DAO)
    private readonly searchDao: INoteSearchDao,
  ) {}

  async execute(query: SearchNotesQuery): Promise<NoteSearchResult> {
    return this.searchDao.search({
      userId: query.userId,
      ...(query.queryText !== undefined && { query: query.queryText }),
      ...(query.labels !== undefined && { labels: query.labels }),
      ...(query.accessMode !== undefined && { accessMode: query.accessMode }),
      ...(query.from !== undefined && { from: query.from }),
      ...(query.size !== undefined && { size: query.size }),
    });
  }
}
