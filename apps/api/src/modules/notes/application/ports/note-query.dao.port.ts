import type { NoteShareResponseDto, SharedNoteResponseDto, NoteResponseDto } from '@modules/notes/presentation/http/dto/note.response.dto';

export const NOTE_QUERY_DAO = Symbol('NOTE_QUERY_DAO');

export interface NoteView extends Omit<NoteResponseDto, 'content'> {
  content: string | null;
}

export interface SharedNoteView extends Omit<SharedNoteResponseDto, 'content'> {
  content: string | null;
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
  findNoteShares(noteId: string, userId: string): Promise<NoteShareResponseDto[] | null>;

  /** check access for draft, protection status, history */
  checkAccess(noteId: string, userId: string): Promise<NoteAccessView | null>;

  /** get protection status */
  isProtected(noteId: string, ownerId: string): Promise<boolean>;
}
