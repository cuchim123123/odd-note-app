/**
 * Presentation layer response DTOs for the Notes module.
 * These are the output contracts exposed to HTTP clients — completely separate from the domain model.
 */

export type SharePermission = 'READ' | 'EDIT';

export interface SharedByProfile {
  id: string;
  email: string;
  displayName: string;
}

/** Full note response, handles both owner and shared access modes */
export interface NoteResponseDto {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  isProtected: boolean;
  isShared: boolean;
  labels: string[];
  createdAt: string;
  updatedAt: string;
  accessMode: 'owner' | 'shared';
  sharedPermission?: SharePermission | undefined;
  sharedBy?: SharedByProfile | undefined;
  sharedAt?: string | undefined;
}

/** Shared-with-me note response — accessMode is always 'shared' */
export interface SharedNoteResponseDto extends NoteResponseDto {
  accessMode: 'shared';
  sharedPermission: SharePermission;
  sharedBy: SharedByProfile;
  sharedAt: string;
}

/** One entry in the list of people a note is shared with */
export interface NoteShareResponseDto {
  id: string;
  recipientEmail: string;
  recipientDisplayName?: string | undefined;
  permission: SharePermission;
  createdAt: string;
  updatedAt: string;
}


export interface NoteDraftResponseDto {
  title: string;
  content: string;
  updatedAt: string;
}

export interface ProtectionStatusResponseDto {
  isProtected: boolean;
}
