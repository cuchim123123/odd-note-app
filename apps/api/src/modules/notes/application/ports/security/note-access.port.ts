export const NOTE_ACCESS_PORT = Symbol('NOTE_ACCESS_PORT');

export interface NoteAccessView {
  hasAccess: boolean;
  isOwner: boolean;
  permission?: 'READ' | 'EDIT';
  ownerId: string;
}

/**
 * Security-critical access port — always backed by PostgreSQL/Prisma.
 * Must NEVER be swapped to an eventually-consistent store (e.g. MongoDB projection)
 * because stale reads here = authorization bypass.
 */
export interface INoteAccessPort {
  /**
   * Checks if userId has any access to noteId.
   * Returns null when the note does not exist OR the user has no access.
   * Reads directly from PostgreSQL Note + NoteShare — strongly consistent.
   */
  checkAccess(noteId: string, userId: string): Promise<NoteAccessView | null>;

  /**
   * Returns true if the note has an active password protection row.
   * Reads NoteProtection from PostgreSQL — must be consistent (security gate).
   */
  isProtected(noteId: string, ownerId: string): Promise<boolean>;
}
