export const USER_PREFERENCES_REPOSITORY = Symbol('UserPreferencesRepository');

export interface IUserPreferencesRepository {
  /** Upsert pin status for a user/note pair */
  upsertPin(userId: string, noteId: string, isPinned: boolean): Promise<{ isPinned: boolean }>;
  /** Get pin status, returns false if no record exists */
  getPin(userId: string, noteId: string): Promise<boolean>;
  /** Upsert label set for a user/note pair */
  upsertLabel(userId: string, noteId: string, labels: string[]): Promise<void>;
  /** Create initial label record for a new note */
  createLabel(userId: string, noteId: string, labels: string[]): Promise<void>;
  /** Bulk-rename a label across all notes for a user */
  renameLabel(userId: string, oldName: string, newName: string): Promise<number>;
  /** Bulk-remove a label from all notes for a user */
  deleteLabel(userId: string, labelName: string): Promise<number>;
}
