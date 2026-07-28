import type { NoteRevisionEntity } from '@modules/notes/domain/entities/note-revision.entity';

export const NOTE_REVISION_REPOSITORY = Symbol('NOTE_REVISION_REPOSITORY');

export interface INoteRevisionRepository {
  /**
   * Persists a new revision snapshot pointer.
   */
  save(revision: NoteRevisionEntity): Promise<void>;

  /**
   * Finds a single revision by its ID to get its targetSeq.
   */
  findById(revisionId: string): Promise<NoteRevisionEntity | null>;

  /**
   * Finds a revision by noteId and targetSeq (idempotency guard).
   */
  findByTargetSeq(noteId: string, targetSeq: bigint): Promise<NoteRevisionEntity | null>;

  /**
   * Lists revisions for a specific note (ordered by date desc).
   */
  findManyByNoteId(noteId: string, limit?: number): Promise<NoteRevisionEntity[]>;
}
