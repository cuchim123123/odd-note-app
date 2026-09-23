import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { SearchNotesQuery } from './search-notes.query';
import { NOTE_SEARCH_DAO } from '@modules/notes/application/ports/dao/note-search.dao.port';
import type { INoteSearchDao, NoteSearchResult } from '@modules/notes/application/ports/dao/note-search.dao.port';
import { NOTE_QUERY_DAO } from '@modules/notes/application/ports/dao/note-query.dao.port';
import type { INoteQueryDao } from '@modules/notes/application/ports/dao/note-query.dao.port';
import { EMBEDDING_PROVIDER_PORT, type IEmbeddingProviderPort } from '@modules/notes/application/ports/external/embedding-provider.port';
import { Logger } from '@nestjs/common';

@QueryHandler(SearchNotesQuery)
export class SearchNotesQueryHandler implements IQueryHandler<SearchNotesQuery> {
  private readonly logger = new Logger(SearchNotesQueryHandler.name);

  constructor(
    @Inject(NOTE_SEARCH_DAO)
    private readonly searchDao: INoteSearchDao,
    @Inject(NOTE_QUERY_DAO)
    private readonly queryDao: INoteQueryDao,
    @Inject(EMBEDDING_PROVIDER_PORT)
    private readonly embeddingProvider: IEmbeddingProviderPort,
  ) {}

  async execute(query: SearchNotesQuery): Promise<NoteSearchResult> {
    let queryVector: number[] | undefined;

    if (query.queryText) {
      try {
        queryVector = await this.embeddingProvider.generateEmbedding(query.queryText);
      } catch (error) {
        this.logger.warn(`Failed to generate query vector for semantic search: ${String(error)}`);
        // Fall back to lexical search if embedding generation fails
      }
    }
    const result = await this.searchDao.search({
      userId: query.userId,
      ...(query.queryText !== undefined && { query: query.queryText }),
      ...(queryVector !== undefined && { queryVector }),
      ...(query.labels !== undefined && { labels: query.labels }),
      ...(query.accessMode !== undefined && { accessMode: query.accessMode }),
      ...(query.from !== undefined && { from: query.from }),
      ...(query.size !== undefined && { size: query.size }),
    });

    if (result.isDegraded) {
      this.logger.warn(`Search index is degraded. Falling back to MongoDB for user ${query.userId}`);
      
      // Fallback: Fetch all notes and shared notes for the user from projection database
      const ownerNotes = await this.queryDao.findUserNotes(query.userId);
      const sharedNotes = await this.queryDao.findSharedWithMe(query.userId);

      // Cast shared notes to match NoteView interface closely enough for fallback filtering
      let fallbackNotes = [
        ...ownerNotes, 
        ...sharedNotes,
      ];
      
      if (query.accessMode === 'owner') fallbackNotes = ownerNotes;
      if (query.accessMode === 'shared') fallbackNotes = sharedNotes;

      if (query.queryText) {
        const q = query.queryText.toLowerCase();
        fallbackNotes = fallbackNotes.filter(n => n.title.toLowerCase().includes(q));
      }
      
      if (query.labels && query.labels.length > 0) {
        fallbackNotes = fallbackNotes.filter(n => query.labels!.every(l => n.labels.includes(l)));
      }

      const from = query.from ?? 0;
      const size = query.size ?? 20;
      const paginated = fallbackNotes.slice(from, from + size);

      return {
        hits: paginated.map(n => {
          const sharedPerm = (n as { sharedPermission?: 'READ' | 'EDIT' }).sharedPermission;
          return {
            noteId: n.id,
            title: n.title,
            labels: n.labels,
            isPinned: n.isPinned,
            isProtected: n.isProtected,
            isShared: n.isShared,
            accessMode: n.accessMode as 'owner' | 'shared',
            ...(sharedPerm ? { sharedPermission: sharedPerm } : {}),
            updatedAt: n.updatedAt,
            score: 1, // Fallback score
          };
        }),
        total: fallbackNotes.length,
        took: 0,
        isDegraded: true,
      };
    }

    return result;
  }
}
