export const NOTE_QUERY_DAO = Symbol('NOTE_QUERY_DAO');

export interface NoteView {
  id: string;
  title: string;
  content: string | null;
  isPinned: boolean;
  isProtected: boolean;
  isShared: boolean;
  labels: string[];
  createdAt: Date;
  updatedAt: Date;
  accessMode: 'owner' | 'shared';
  sharedPermission?: 'READ' | 'EDIT';
  sharedBy?: { id: string; email: string; displayName: string };
  sharedAt?: Date;
}

export interface SharedNoteView extends NoteView {
  accessMode: 'shared';
  sharedPermission: 'READ' | 'EDIT';
  sharedBy: { id: string; email: string; displayName: string };
  sharedAt: Date;
}

export interface NoteShareView {
  id: string;
  recipientEmail: string;
  recipientDisplayName?: string;
  permission: 'READ' | 'EDIT';
  createdAt: Date;
  updatedAt: Date;
}

export interface NoteAccessView {
  hasAccess: boolean;
  isOwner: boolean;
  permission?: 'READ' | 'EDIT';
  ownerId: string;
}

export interface INoteQueryDao {
  /** list-notes */
  findUserNotes(userId: string): Promise<NoteView[]>;
  
  /** get-note-by-id */
  findNoteById(noteId: string, userId: string): Promise<NoteView | null>;

  /** list-shared-with-me */
  findSharedWithMe(userId: string): Promise<SharedNoteView[]>;

  /** list-shares */
  findNoteShares(noteId: string, userId: string): Promise<NoteShareView[] | null>;

  /** check access for draft, protection status, history */
  checkAccess(noteId: string, userId: string): Promise<NoteAccessView | null>;

  /** get protection status */
  isProtected(noteId: string, ownerId: string): Promise<boolean>;
}
