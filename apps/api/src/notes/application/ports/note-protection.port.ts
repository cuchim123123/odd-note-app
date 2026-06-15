export const NOTE_PROTECTION_PORT = Symbol('NOTE_PROTECTION_PORT');

export interface INoteProtectionPort {
  setPassword(userId: string, noteId: string, passwordHash: string): Promise<void>;
  verifyPassword(userId: string, noteId: string, passwordHash: string): Promise<boolean>;
  removePassword(userId: string, noteId: string): Promise<void>;
  verifyUnlockToken(userId: string, noteId: string, unlockToken?: string): Promise<boolean>;
}
