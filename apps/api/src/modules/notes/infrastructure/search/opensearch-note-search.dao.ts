import { Injectable, Logger } from '@nestjs/common';
import type {
  INoteSearchDao,
  NoteAutocompleteSuggestion,
  NoteSearchHit,
  NoteSearchParams,
  NoteSearchResult,
} from '@modules/notes/application/ports/dao/note-search.dao.port';
import { OpenSearchService } from '@shared/infrastructure/search/opensearch.service';

/** Shape of a raw document returned from the search index. */
interface RawNoteDoc {
  noteId: string;
  userId: string;
  accessMode: 'owner' | 'shared';
  title: string;
  bodyText?: string;
  embedding?: number[];
  aiTags?: string[];
  labels: string[];
  isPinned: boolean;
  isProtected: boolean;
  isShared: boolean;
  sharedPermission?: 'READ' | 'EDIT';
  updatedAt: string;
}

/**
 * OpenSearch-backed implementation of INoteSearchDao.
 *
 * This is the ONLY place in the codebase that knows about OpenSearch
 * query DSL for reads.
 *
 * Security contract: every query MUST include a mandatory `term` filter
 * on `userId`. This is search-result scoping — not authorization enforcement.
 * Authorization enforcement remains exclusively in INoteAccessPort (PostgreSQL).
 */
@Injectable()
export class OpenSearchNoteSearchDao implements INoteSearchDao {
  private readonly logger = new Logger(OpenSearchNoteSearchDao.name);

  constructor(private readonly openSearch: OpenSearchService) {}

  private get index(): string {
    return this.openSearch.indexName('notes');
  }

  async search(params: NoteSearchParams): Promise<NoteSearchResult> {
    const { userId, query, queryVector, labels, tags, accessMode = 'all', from = 0, size = 20 } = params;
    const clampedSize = Math.min(size, 100);

    // ── Mandatory scoping filter — always applied, never optional ────────────
    const filters: unknown[] = [{ term: { userId } }];

    if (accessMode !== 'all') {
      filters.push({ term: { accessMode } });
    }

    if (labels && labels.length > 0) {
      filters.push(...labels.map((label) => ({ term: { labels: label } })));
    }
    
    if (tags && tags.length > 0) {
      filters.push(...tags.map((tag) => ({ term: { aiTags: tag } })));
    }

    const searchBody: Record<string, unknown> = {
      from,
      size: clampedSize,
      sort: query
        ? [{ _score: 'desc' }, { updatedAt: 'desc' }]
        : [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
      highlight: {
        fields: { bodyText: { fragment_size: 200, number_of_fragments: 1 } },
        pre_tags: ['<mark>'],
        post_tags: ['</mark>'],
      },
    };

    if (queryVector && query) {
      // Hybrid search: knn + boolean match
      searchBody.query = {
        hybrid: {
          queries: [
            {
              multi_match: {
                query,
                fields: ['title^3', 'bodyText'],
                type: 'best_fields',
                fuzziness: 'AUTO',
              },
            },
            {
              knn: {
                embedding: {
                  vector: queryVector,
                  k: clampedSize,
                },
              },
            },
          ],
        },
      };
      // We must apply the security filters inside a post_filter when using hybrid
      searchBody.post_filter = { bool: { filter: filters } };
    } else {
      // Standard boolean query
      const shouldClauses: unknown[] = query
        ? [
            {
              multi_match: {
                query,
                fields: ['title^3', 'bodyText'],
                type: 'best_fields',
                fuzziness: 'AUTO',
              },
            },
          ]
        : [];

      searchBody.query = {
        bool: {
          filter: filters,
          ...(shouldClauses.length > 0 && {
            should: shouldClauses,
            minimum_should_match: 1,
          }),
        },
      };
    }

    try {
      const { body: result } = await this.openSearch.getClient().search({ index: this.index, body: searchBody });

      const hits = (result.hits.hits as unknown) as Array<{
        _source: RawNoteDoc;
        _score: number | null;
        highlight?: { bodyText?: string[] };
      }>;

      return {
        total: typeof result.hits.total === 'object'
          ? result.hits.total.value
          : (result.hits.total as number),
        took: result.took as number,
        hits: hits.map((hit) => this.mapHit(hit)),
      };
    } catch (error) {
      this.logger.error('search query failed', error);
      // Return empty result with degraded flag rather than crashing the query handler
      return { hits: [], total: 0, took: 0, isDegraded: true };
    }
  }

  async autocomplete(userId: string, prefix: string): Promise<NoteAutocompleteSuggestion[]> {
    if (!prefix.trim()) return [];

    const body = {
      size: 10,
      _source: ['noteId', 'title', 'accessMode'],
      query: {
        bool: {
          filter: [{ term: { userId } }],
          must: [
            {
              multi_match: {
                query: prefix,
                // 'bool_prefix' enables search_as_you_type prefix matching
                type: 'bool_prefix' as 'phrase_prefix',
                fields: ['title', 'title._2gram', 'title._3gram'],
              },
            },
          ],
        },
      },
    };

    try {
      const { body: result } = await this.openSearch.getClient().search({ index: this.index, body });

      const hits = (result.hits.hits as unknown) as Array<{ _source: RawNoteDoc }>;
      return hits.map((hit) => ({
        noteId: hit._source.noteId,
        title: hit._source.title,
        accessMode: hit._source.accessMode,
      }));
    } catch (error) {
      this.logger.warn('autocomplete query failed', error);
      return [];
    }
  }

  // ─── Mapping ──────────────────────────────────────────────────────────────

  private mapHit(hit: {
    _source: RawNoteDoc;
    _score: number | null;
    highlight?: { bodyText?: string[] };
  }): NoteSearchHit {
    const src = hit._source;

    const result: NoteSearchHit = {
      noteId: src.noteId,
      title: src.title,
      labels: src.labels,
      ...(src.aiTags !== undefined && { aiTags: src.aiTags }),
      isPinned: src.isPinned,
      isProtected: src.isProtected,
      isShared: src.isShared,
      accessMode: src.accessMode,
      updatedAt: new Date(src.updatedAt),
      score: hit._score ?? 0,
    };

    // Suppress body excerpts for protected notes — content gate is on the client
    if (!src.isProtected && hit.highlight?.bodyText?.[0]) {
      (result as { bodyExcerpt?: string }).bodyExcerpt = hit.highlight.bodyText[0];
    }

    if (src.sharedPermission) {
      (result as { sharedPermission?: 'READ' | 'EDIT' }).sharedPermission = src.sharedPermission;
    }

    return result;
  }
}
