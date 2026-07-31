import type { VersionHistory } from '@modules/notes/domain/entities/version-history.entity';

export const VERSION_HISTORY_REPOSITORY = Symbol('VERSION_HISTORY_REPOSITORY');

export interface IVersionHistoryRepository {
  /**
   * Fetches the version history for a note.
   * If none exists in DB, it should return a new empty VersionHistory instance.
   */
  findByNoteId(noteId: string): Promise<VersionHistory>;

  /**
   * Persists the version history aggregate.
   */
  save(history: VersionHistory): Promise<void>;
}
