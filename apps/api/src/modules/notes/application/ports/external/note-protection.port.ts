export const NOTE_PROTECTION_PORT = Symbol('NOTE_PROTECTION_PORT');

export interface INoteProtectionPort {
  /** Hash is done by the adapter — callers pass raw password */
  setPassword(userId: string, noteId: string, password: string): Promise<void>;
  verifyPassword(ownerId: string, noteId: string, password: string): Promise<boolean>;
  removePassword(userId: string, noteId: string): Promise<void>;
}
