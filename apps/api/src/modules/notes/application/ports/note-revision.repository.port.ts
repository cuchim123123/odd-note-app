import type { NoteRevisionEntity } from '@modules/notes/domain/entities/note-revision.entity';

export const NOTE_REVISION_REPOSITORY = Symbol('NOTE_REVISION_REPOSITORY');

export interface INoteRevisionRepository {
  /**
   * Returns the next revision number for a note (MAX + 1).
   * Returns 1 if no revisions exist yet.
   */
  nextRevisionNumber(noteId: string): Promise<number>;

  /**
   * Persists a new revision snapshot.
   */
  save(revision: NoteRevisionEntity): Promise<void>;

  /**
   * Finds a single revision by its ID (including content for restore).
   */
  findById(revisionId: string): Promise<NoteRevisionEntity | null>;

  /**
   * Returns the most recent revision for a note (full content included).
   * Used by the dedup guard to skip creating identical snapshots.
   * Returns null if no revisions exist yet.
   */
  findLatest(noteId: string): Promise<NoteRevisionEntity | null>;

  /**
   * Deletes the oldest revisions for a note, keeping only `keepCount`.
   * Called after every successful save to enforce the retention cap.
   */
  pruneOldest(noteId: string, keepCount: number): Promise<void>;
}
