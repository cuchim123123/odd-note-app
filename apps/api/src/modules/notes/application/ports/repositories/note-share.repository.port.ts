export const NOTE_SHARE_REPOSITORY = Symbol('NoteShareRepository');

export interface NoteShareCreateData {
  noteId: string;
  ownerId: string;
  recipientId: string;
  recipientEmail: string;
  permission: string;
}

export interface NoteShareRecord {
  id: string;
}

export interface INoteShareRepository {
  create(data: NoteShareCreateData): Promise<NoteShareRecord>;
  updatePermission(shareId: string, permission: string): Promise<NoteShareRecord>;
  delete(shareId: string): Promise<void>;
}
