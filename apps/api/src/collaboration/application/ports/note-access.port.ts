export const NOTE_ACCESS_PORT = Symbol('NOTE_ACCESS_PORT');

export interface INoteAccessPort {
  /**
   * Validates if a user has access to a note (owner or shared).
   * @param userId The ID of the user trying to access
   * @param noteId The ID of the note
   * @param unlockToken Optional unlock token if the note is password-protected
   * @returns true if access is granted, false otherwise
   */
  canAccessNote(userId: string, noteId: string, unlockToken?: string): Promise<boolean>;

  /**
   * Retrieves access mode / permissions for the current user on the note.
   */
  getAccessPermissions(userId: string, noteId: string): Promise<{
    isOwner: boolean;
    canEdit: boolean;
  } | null>;
}
