import type { NoteUpdateLog } from '@modules/notes/domain/entities/note-update.entity';

export const NOTE_UPDATE_REPOSITORY = Symbol('NOTE_UPDATE_REPOSITORY');

export interface INoteUpdateRepository {
  /**
   * Appends a new update to the log and returns the assigned sequence number.
   * This provides the atomic `RETURNING seq` guarantee.
   */
  append(update: Omit<NoteUpdateLog, 'seq'>): Promise<NoteUpdateLog>;

  /**
   * Fetches a range of updates for a note.
   * Useful for rebuilding state from a snapshot to a target sequence.
   */
  getUpdatesInRange(noteId: string, fromSeqExclusive: bigint, toSeqInclusive: bigint): Promise<NoteUpdateLog[]>;

  /**
   * Fetches updates since a specific sequence.
   */
  getUpdatesSince(noteId: string, fromSeqExclusive: bigint): Promise<NoteUpdateLog[]>;
}
