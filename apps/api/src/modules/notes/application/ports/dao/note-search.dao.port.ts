export const NOTE_SEARCH_DAO = Symbol('NOTE_SEARCH_DAO');

/**
 * Parameters for a full-text / filter search.
 * All fields are optional — an empty query returns the caller's notes
 * sorted by relevance.
 */
export interface NoteSearchParams {
  /** The authenticated user performing the search. Mandatory — enforces scoping. */
  readonly userId: string;
  /** Free-text query matched against title and bodyText. */
  readonly query?: string;
  /** Exact-match label filters (AND semantics — all labels must match). */
  readonly labels?: string[];
  /** Restrict results to owned, shared, or all notes. Defaults to 'all'. */
  readonly accessMode?: 'owner' | 'shared' | 'all';
  /** Zero-based offset for pagination. Defaults to 0. */
  readonly from?: number;
  /** Page size. Defaults to 20. Maximum 100. */
  readonly size?: number;
}

/**
 * A single hit returned by the search engine.
 *
 * Distinct from NoteView (used by INoteQueryDao) — NoteSearchHit carries
 * search-specific fields (score, bodyExcerpt) and never carries content
 * that requires an authoritative access check (e.g. full body).
 */
export interface NoteSearchHit {
  readonly noteId: string;
  readonly title: string;
  /**
   * Highlighted plaintext snippet from bodyText.
   * Absent when bodyText has not yet been indexed (snapshot not yet created).
   * Absent when isProtected is true — callers must suppress protected excerpts.
   */
  readonly bodyExcerpt?: string;
  readonly labels: string[];
  readonly isPinned: boolean;
  readonly isProtected: boolean;
  readonly isShared: boolean;
  readonly accessMode: 'owner' | 'shared';
  readonly sharedPermission?: 'READ' | 'EDIT';
  readonly updatedAt: Date;
  /** Relevance score returned by the search engine. */
  readonly score: number;
}

export interface NoteSearchResult {
  readonly hits: NoteSearchHit[];
  /** Total number of matching documents (not just the current page). */
  readonly total: number;
  /** Engine-reported query execution time in milliseconds. */
  readonly took: number;
}

/**
 * A lightweight suggestion entry for typeahead/autocomplete.
 */
export interface NoteAutocompleteSuggestion {
  readonly noteId: string;
  readonly title: string;
  readonly accessMode: 'owner' | 'shared';
}

/**
 * Inbound port for querying the search index.
 *
 * Consumed exclusively by query handlers (read side of CQRS).
 * Must not be used in command handlers or domain services.
 *
 * Every implementation MUST apply a mandatory `userId` filter so that
 * a user can only ever retrieve documents indexed for their own ID.
 * This is search scoping — not authorization enforcement.
 * Authorization enforcement remains in INoteAccessPort (PostgreSQL).
 */
export interface INoteSearchDao {
  /**
   * Full-text and/or label-filtered search scoped to the caller's userId.
   */
  search(params: NoteSearchParams): Promise<NoteSearchResult>;

  /**
   * Returns title suggestions for a given prefix string.
   * Backed by the search_as_you_type field mapping.
   * Returns at most 10 suggestions.
   */
  autocomplete(userId: string, prefix: string): Promise<NoteAutocompleteSuggestion[]>;
}
