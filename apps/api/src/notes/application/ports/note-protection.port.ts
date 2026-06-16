export const NOTE_PROTECTION_PORT = Symbol('NOTE_PROTECTION_PORT');

export interface INoteProtectionPort {
  /** Hash is done by the adapter — callers pass raw password */
  setPassword(userId: string, noteId: string, password: string): Promise<void>;
  verifyPassword(userId: string, noteId: string, password: string): Promise<boolean>;
  removePassword(userId: string, noteId: string): Promise<void>;
  verifyUnlockToken(userId: string, noteId: string, unlockToken?: string): Promise<boolean>;
  /** Issues a time-limited JWT unlock token after successful verify */
  issueUnlockToken(userId: string, noteId: string): Promise<string>;
}

