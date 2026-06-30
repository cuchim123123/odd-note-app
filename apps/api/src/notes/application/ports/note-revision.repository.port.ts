import type { NoteRevisionEntity } from '../../domain/entities/note-revision.entity';

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
   * Lists all revisions for a note, newest first.
   * Does NOT include content (use findById to restore).
   */
  findByNoteId(noteId: string): Promise<Omit<NoteRevisionEntity, 'content'>[]>;

  /**
   * Finds a single revision by its ID (including content for restore).
   */
  findById(revisionId: string): Promise<NoteRevisionEntity | null>;
}
