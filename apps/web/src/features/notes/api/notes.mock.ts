import type { Note, CreateNoteInput, UpdateNoteInput } from '@odd-note-app/validation';
import type { NoteShareRecord, NoteDraft, SharedByProfile } from './notes.api';

const createId = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
  const random = Math.random() * 16 | 0;
  const value = character === 'x' ? random : (random & 0x3 | 0x8);
  return value.toString(16);
});

const now = () => new Date().toISOString();

const cloneNote = (note: Note): Note => ({ ...note, labels: [...(note.labels || [])] });

export type MockShareRecord = NoteShareRecord & {
  noteId: string;
  owner: SharedByProfile;
};

export let mockNotes: Note[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440000',
    title: 'Getting Started',
    content: '<p>Welcome to odd note!</p>',
    isPinned: true,
    isProtected: false,
    isShared: false,
    labels: ['tutorial'],
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    title: 'Meeting Notes',
    content: '<ul><li>Discuss frontend architecture</li><li>Review mock APIs</li></ul>',
    isPinned: false,
    isProtected: false,
    isShared: true,
    labels: ['work', 'meeting'],
    createdAt: now(),
    updatedAt: now(),
  },
];

export let mockNoteShares: MockShareRecord[] = [];
export let mockNoteDrafts: Record<string, NoteDraft> = {};

export function getAllMockShares(): MockShareRecord[] {
  return mockNoteShares;
}

export function upsertShare(share: MockShareRecord): void {
  mockNoteShares = [
    ...mockNoteShares.filter((record) => !(record.noteId === share.noteId && record.recipientEmail === share.recipientEmail)),
    share,
  ];
}

export function updateSharePermission(noteId: string, shareId: string, permission: string): MockShareRecord | undefined {
  mockNoteShares = mockNoteShares.map((record) =>
    record.noteId === noteId && record.id === shareId ? ({ ...record, permission: permission as SharePermission, updatedAt: now() } as MockShareRecord) : record,
  );

  return mockNoteShares.find((r) => r.noteId === noteId && r.id === shareId);
}

export function removeShare(noteId: string, shareId: string): void {
  mockNoteShares = mockNoteShares.filter((record) => !(record.noteId === noteId && record.id === shareId));
}

export function getMockDraft(noteId: string): NoteDraft | undefined {
  return mockNoteDrafts[noteId];
}

export function setMockDraft(noteId: string, draft: NoteDraft): void {
  mockNoteDrafts[noteId] = draft;
}

export function clearMockDraft(noteId: string): void {
  delete mockNoteDrafts[noteId];
}

export function getSortedNotes(): Note[] {
  return [...mockNotes]
    .sort((left, right) => {
      if (left.isPinned !== right.isPinned) {
        return Number(right.isPinned) - Number(left.isPinned);
      }

      return new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime();
    })
    .map(cloneNote);
}

export function getNoteById(id: string): Note {
  const note = mockNotes.find((entry) => entry.id === id);

  if (!note) {
    throw new Error('Note not found');
  }

  return cloneNote(note);
}

export function createNote(input: CreateNoteInput): Note {
  const note: Note = {
    id: createId(),
    title: input.title,
    content: input.content || '',
    isPinned: false,
    isProtected: false,
    isShared: false,
    labels: input.labels || [],
    createdAt: now(),
    updatedAt: now(),
  } as Note;

  mockNotes = [note, ...mockNotes];
  return cloneNote(note);
}

export function updateNote(id: string, input: UpdateNoteInput): Note {
  const existing = mockNotes.find((entry) => entry.id === id);

  if (!existing) {
    throw new Error('Note not found');
  }

  const updated: Note = {
    ...existing,
    title: input.title ?? existing.title,
    content: input.content ?? existing.content,
    isPinned: input.isPinned ?? existing.isPinned,
    isProtected: input.isProtected ?? existing.isProtected,
    labels: input.labels ?? existing.labels,
    updatedAt: now(),
  } as Note;

  mockNotes = mockNotes.map((entry) => (entry.id === id ? updated : entry));
  return cloneNote(updated);
}

export function renameLabelInNotes(oldLabel: string, newLabel: string): void {
  const trimmedOldLabel = normalizeLabel(oldLabel);
  const trimmedNewLabel = normalizeLabel(newLabel);

  if (!trimmedOldLabel || !trimmedNewLabel || trimmedOldLabel === trimmedNewLabel) {
    return;
  }

  mockNotes = mockNotes.map((note) => ({
    ...note,
    labels: (note.labels || []).map((label) => (label === trimmedOldLabel ? trimmedNewLabel : label)),
  }));
}

export function deleteNote(id: string): void {
  mockNotes = mockNotes.filter((entry) => entry.id !== id);
  mockNoteShares = mockNoteShares.filter((share) => share.noteId !== id);
}

export function resetMockNotes() {
  mockNoteShares = [];
  mockNoteDrafts = {};
  mockNotes = [
    {
      id: '550e8400-e29b-41d4-a716-446655440000',
      title: 'Getting Started',
      content: '<p>Welcome to odd note!</p>',
      isPinned: true,
      isProtected: false,
      isShared: false,
      labels: ['tutorial'],
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440001',
      title: 'Meeting Notes',
      content: '<ul><li>Discuss frontend architecture</li><li>Review mock APIs</li></ul>',
      isPinned: false,
      isProtected: false,
      isShared: true,
      labels: ['work', 'meeting'],
      createdAt: now(),
      updatedAt: now(),
    },
  ];
}

export function syncNoteShareFlag(noteId: string): void {
  const isShared = mockNoteShares.some((share) => share.noteId === noteId);
  mockNotes = mockNotes.map((note) => (note.id === noteId ? { ...note, isShared } : note));
}

export function toSharedNoteItem(share: MockShareRecord): Note & { accessMode: 'shared'; sharedPermission: string; sharedBy: SharedByProfile; sharedAt: string } {
  const note = getNoteById(share.noteId);

  return {
    ...note,
    isShared: true,
    accessMode: 'shared',
    sharedPermission: share.permission,
    sharedBy: share.owner,
    sharedAt: share.createdAt,
  } as SharedNoteItem;
}
