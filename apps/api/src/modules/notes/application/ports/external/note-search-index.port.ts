export const NOTE_SEARCH_INDEX_PORT = Symbol('NOTE_SEARCH_INDEX_PORT');

/**
 * A note document as it is stored in the search index.
 *
 * This is the canonical write contract for the search projection.
 * Infrastructure adapters translate this to whatever the search engine expects.
 *
 * Kept minimal — only fields that drive search, filtering, or sorting.
 * Raw body content (bodyText) is optional and populated separately after
 * the CRDT snapshot pipeline materialises it.
 */
export interface NoteSearchDocument {
  /** Composite index document ID: `{userId}:{noteId}` */
  readonly noteId: string;
  /** The user this document is indexed for (owner or sharee). */
  readonly userId: string;
  readonly accessMode: 'owner' | 'shared';
  readonly title: string;
  /**
   * Plaintext extracted from the ProseMirror XML / Yjs document.
   * Absent until a snapshot is materialised by the snapshot pipeline.
   */
  readonly bodyText?: string;
  readonly labels: string[];
  readonly isPinned: boolean;
  readonly isProtected: boolean;
  readonly isShared: boolean;
  /** Only present when accessMode is 'shared'. */
  readonly sharedPermission?: 'READ' | 'EDIT';
  readonly updatedAt: Date;
  readonly createdAt: Date;
}

/**
 * Outbound port for writing to the search index.
 *
 * All methods are idempotent — callers may re-deliver the same event
 * safely (e.g. on Kafka consumer retry).
 *
 * This port lives in the application layer; it has no knowledge of
 * OpenSearch, Elasticsearch, or any other search technology.
 */
export interface INoteSearchIndexPort {
  /**
   * Creates or fully replaces a document in the search index.
   * Used on NoteCreated and NoteShared (new sharee document).
   */
  upsert(doc: NoteSearchDocument): Promise<void>;

  /**
   * Deletes all search documents for a note across all users.
   * Used on NoteDeleted — owner and all sharee documents are removed.
   */
  deleteAllForNote(noteId: string): Promise<void>;

  /**
   * Updates the title field on all search documents that belong to a
   * given note (owner + all sharees).
   * Used on NoteTitleUpdated.
   */
  updateTitle(noteId: string, title: string, updatedAt: Date): Promise<void>;

  /**
   * Sets or clears the isProtected flag on all documents for a note.
   * Used on NoteProtectionSet / NoteProtectionRemoved.
   */
  updateProtection(noteId: string, isProtected: boolean): Promise<void>;

  /**
   * Updates the sharedPermission on a specific sharee's document.
   * Used on ShareUpdated — direct by-ID operation because recipientId
   * is now carried in the integration event payload.
   */
  updateSharePermission(
    noteId: string,
    recipientId: string,
    permission: 'READ' | 'EDIT',
  ): Promise<void>;

  /**
   * Deletes the search document for a specific sharee.
   * Used on ShareRevoked — direct by-ID operation.
   */
  deleteShareeDocument(noteId: string, recipientId: string): Promise<void>;

  /**
   * Updates isPinned for a specific user's document.
   * Used on NotePinned — direct by-ID because userId is in the event payload.
   */
  updatePinStatus(noteId: string, userId: string, isPinned: boolean): Promise<void>;

  /**
   * Updates labels for a specific user's document.
   * Used on NoteLabelsUpdated — direct by-ID because userId is in the event payload.
   */
  updateLabels(noteId: string, userId: string, labels: string[]): Promise<void>;

  /**
   * Replaces the bodyText field on all documents for a note.
   * Called after the CRDT snapshot pipeline materialises plaintext content.
   */
  updateBodyText(noteId: string, bodyText: string): Promise<void>;

  /**
   * Bulk-upserts multiple documents.
   * Used by the index rebuild / backfill service.
   */
  bulkUpsert(docs: NoteSearchDocument[]): Promise<void>;
}
