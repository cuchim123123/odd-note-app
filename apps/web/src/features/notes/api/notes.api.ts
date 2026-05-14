import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/axios';
import { useAuthStore } from '../../auth/stores/auth.store';
import { useOfflineSyncStore } from '../../../stores/offline-sync.store';
import type { Note, CreateNoteInput, UpdateNoteInput, CreateNoteShareInput, UpdateNoteShareInput } from '@odd-note-app/validation';

type SharePermission = 'READ' | 'EDIT';

type SharedByProfile = {
  id: string;
  email: string;
  displayName: string;
};

export type SharedNoteItem = Note & {
  accessMode: 'shared';
  sharedPermission: SharePermission;
  sharedBy: SharedByProfile;
  sharedAt: string;
};

export type NoteDetailItem = Note & {
  accessMode?: 'owner' | 'shared';
  sharedPermission?: SharePermission | undefined;
  sharedBy?: SharedByProfile | undefined;
  sharedAt?: string | undefined;
};

export type NoteShareRecord = {
  id: string;
  recipientEmail: string;
  recipientDisplayName?: string | undefined;
  permission: SharePermission;
  createdAt: string;
  updatedAt: string;
};

const createId = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
  const random = Math.random() * 16 | 0;
  const value = character === 'x' ? random : (random & 0x3 | 0x8);
  return value.toString(16);
});

const now = () => new Date().toISOString();

const cloneNote = (note: Note): Note => ({ ...note, labels: [...note.labels] });

const normalizeLabel = (label: string) => label.trim();

const NOTES_DB_NAME = 'odd-note-app';
const NOTES_DB_VERSION = 1;
const NOTES_STORE_NAME = 'notes';

const openNotesDb = async (): Promise<IDBDatabase> => {
  return await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(NOTES_DB_NAME, NOTES_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(NOTES_STORE_NAME)) {
        db.createObjectStore(NOTES_STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const readAllNotesFromDb = async (): Promise<Note[]> => {
  try {
    const db = await openNotesDb();
    const tx = db.transaction(NOTES_STORE_NAME, 'readonly');
    const store = tx.objectStore(NOTES_STORE_NAME);

    const notes = await new Promise<Note[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve((request.result as Note[]).map(cloneNote));
      request.onerror = () => reject(request.error);
    });

    db.close();
    return notes;
  } catch {
    return [];
  }
};

const readNoteFromDb = async (id: string): Promise<Note | null> => {
  try {
    const db = await openNotesDb();
    const tx = db.transaction(NOTES_STORE_NAME, 'readonly');
    const store = tx.objectStore(NOTES_STORE_NAME);

    const note = await new Promise<Note | null>((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result ? cloneNote(request.result as Note) : null);
      request.onerror = () => reject(request.error);
    });

    db.close();
    return note;
  } catch {
    return null;
  }
};

const upsertNoteInDb = async (note: Note): Promise<void> => {
  try {
    const db = await openNotesDb();
    const tx = db.transaction(NOTES_STORE_NAME, 'readwrite');
    const store = tx.objectStore(NOTES_STORE_NAME);

    await new Promise<void>((resolve, reject) => {
      const request = store.put(note);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    db.close();
  } catch {
    // Ignore offline cache write failures.
  }
};

const upsertNotesInDb = async (notes: Note[]): Promise<void> => {
  await Promise.all(notes.map((note) => upsertNoteInDb(note)));
};

const deleteNoteFromDb = async (id: string): Promise<void> => {
  try {
    const db = await openNotesDb();
    const tx = db.transaction(NOTES_STORE_NAME, 'readwrite');
    const store = tx.objectStore(NOTES_STORE_NAME);

    await new Promise<void>((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    db.close();
  } catch {
    // Ignore offline cache write failures.
  }
};

const queueOfflineMutation = (item: { type: 'create' | 'update' | 'delete' | 'share'; noteId?: string; payload: Record<string, unknown> }) => {
  useOfflineSyncStore.getState().addToSyncQueue({
    id: createId(),
    type: item.type,
    ...(item.noteId ? { noteId: item.noteId } : {}),
    payload: item.payload,
    timestamp: Date.now(),
    retries: 0,
  });
};

const getOfflineNotes = async (): Promise<Note[]> => {
  const persistedNotes = await readAllNotesFromDb();
  if (persistedNotes.length > 0) {
    return persistedNotes.sort((left, right) => {
      if (left.isPinned !== right.isPinned) {
        return Number(right.isPinned) - Number(left.isPinned);
      }

      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    });
  }

  return getSortedNotes();
};

const getOfflineNote = async (id: string): Promise<Note> => {
  const persistedNote = await readNoteFromDb(id);
  if (persistedNote) {
    return persistedNote;
  }

  return getNoteById(id);
};

type MockShareRecord = NoteShareRecord & {
  noteId: string;
  owner: SharedByProfile;
};

let mockNotes: Note[] = [
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

let mockNoteShares: MockShareRecord[] = [];

const hasAccessToken = () => Boolean(useAuthStore.getState().accessToken);

const backendNotesAvailable = () => hasAccessToken();

async function fetchNotesFromApi(): Promise<Note[]> {
  const response = await api.get<Note[]>('/notes');
  return response.data;
}

async function fetchNoteFromApi(id: string): Promise<Note> {
  const response = await api.get<Note>(`/notes/${id}`);
  return response.data;
}

async function createNoteInApi(input: CreateNoteInput): Promise<Note> {
  const response = await api.post<Note>('/notes', input);
  return response.data;
}

async function updateNoteInApi(id: string, input: UpdateNoteInput & { isProtected?: boolean }): Promise<Note> {
  const { isProtected, ...payload } = input;
  const response = await api.patch<Note>(`/notes/${id}`, payload);
  return { ...response.data, isProtected: isProtected ?? response.data.isProtected };
}

async function deleteNoteInApi(id: string): Promise<void> {
  await api.delete(`/notes/${id}`);
}

async function fetchSharedNotesFromApi(): Promise<SharedNoteItem[]> {
  const response = await api.get<SharedNoteItem[]>('/notes/shared-with-me');
  return response.data;
}

async function fetchNoteSharesFromApi(noteId: string): Promise<NoteShareRecord[]> {
  const response = await api.get<NoteShareRecord[]>(`/notes/${noteId}/shares`);
  return response.data;
}

async function createNoteShareInApi(noteId: string, input: CreateNoteShareInput): Promise<NoteShareRecord> {
  const response = await api.post<NoteShareRecord>(`/notes/${noteId}/shares`, input);
  return response.data;
}

async function updateNoteShareInApi(noteId: string, shareId: string, input: UpdateNoteShareInput): Promise<NoteShareRecord> {
  const response = await api.patch<NoteShareRecord>(`/notes/${noteId}/shares/${shareId}`, input);
  return response.data;
}

async function deleteNoteShareInApi(noteId: string, shareId: string): Promise<void> {
  await api.delete(`/notes/${noteId}/shares/${shareId}`);
}

const currentUserProfile = (): SharedByProfile | null => {
  const user = useAuthStore.getState().user;
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
  };
};

const syncNoteShareFlag = (noteId: string): void => {
  const isShared = mockNoteShares.some((share) => share.noteId === noteId);
  mockNotes = mockNotes.map((note) => (note.id === noteId ? { ...note, isShared } : note));
};

const toSharedNoteItem = (share: MockShareRecord): SharedNoteItem => {
  const note = getNoteById(share.noteId);

  return {
    ...note,
    isShared: true,
    accessMode: 'shared',
    sharedPermission: share.permission,
    sharedBy: share.owner,
    sharedAt: share.createdAt,
  };
};

export function getSortedNotes(): Note[] {
  return [...mockNotes]
    .sort((left, right) => {
      if (left.isPinned !== right.isPinned) {
        return Number(right.isPinned) - Number(left.isPinned);
      }

      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
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
  };

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
  };

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
    labels: note.labels.map((label) => (label === trimmedOldLabel ? trimmedNewLabel : label)),
  }));
}

export function deleteNote(id: string): void {
  mockNotes = mockNotes.filter((entry) => entry.id !== id);
  mockNoteShares = mockNoteShares.filter((share) => share.noteId !== id);
}

export function resetMockNotes() {
  mockNoteShares = [];
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

export const NOTES_KEYS = {
  all: ['notes'] as const,
  detail: (id: string) => ['notes', id] as const,
  shared: ['notes', 'shared'] as const,
  shares: (id: string) => ['notes', id, 'shares'] as const,
};

export async function getNoteProtectionStatus(noteId: string): Promise<{ isProtected: boolean }> {
  if (!backendNotesAvailable()) {
    return { isProtected: getSortedNotes().some((note) => note.id === noteId && note.isProtected) };
  }

  const response = await api.get<{ isProtected: boolean }>(`/notes/${noteId}/protection-status`);
  return response.data;
}

export async function setNotePassword(noteId: string, password: string): Promise<{ isProtected: true }> {
  if (!backendNotesAvailable()) {
    updateNote(noteId, { isProtected: true });
    return { isProtected: true };
  }

  const response = await api.post<{ isProtected: true }>(`/notes/${noteId}/set-password`, { password });
  return response.data;
}

export async function verifyNotePassword(noteId: string, password: string): Promise<{ verified: boolean }> {
  if (!backendNotesAvailable()) {
    return { verified: password === 'secret123' };
  }

  const response = await api.post<{ verified: boolean }>(`/notes/${noteId}/verify-password`, { password });
  return response.data;
}

export async function removeNotePassword(noteId: string, password: string): Promise<{ removed: true }> {
  if (!backendNotesAvailable()) {
    updateNote(noteId, { isProtected: false });
    return { removed: true };
  }

  const response = await api.delete<{ removed: true }>(`/notes/${noteId}/password`, {
    data: { password },
  });
  return response.data;
}

export const useNotes = () => {
  return useQuery({
    queryKey: NOTES_KEYS.all,
    queryFn: async () => {
      if (!backendNotesAvailable()) {
        return await getOfflineNotes();
      }

      const notes = await fetchNotesFromApi();
      await upsertNotesInDb(notes);
      return notes;
    },
  });
};

export const useSharedNotes = () => {
  return useQuery({
    queryKey: NOTES_KEYS.shared,
    queryFn: async () => {
      if (!backendNotesAvailable()) {
        return mockNoteShares.map((share) => toSharedNoteItem(share));
      }

      return await fetchSharedNotesFromApi();
    },
  });
};

export const useNote = (id: string | null) => {
  return useQuery<NoteDetailItem>({
    queryKey: NOTES_KEYS.detail(id!),
    enabled: !!id,
    queryFn: async () => {
      if (!backendNotesAvailable()) {
        return (await getOfflineNote(id!)) as NoteDetailItem;
      }

      const note = await fetchNoteFromApi(id!);
      await upsertNoteInDb(note);
      return note;
    },
  });
};

export const useNoteShares = (noteId: string | null) => {
  return useQuery({
    queryKey: noteId ? NOTES_KEYS.shares(noteId) : NOTES_KEYS.shared,
    enabled: !!noteId,
    queryFn: async () => {
      if (!noteId) {
        return [];
      }

      if (!backendNotesAvailable()) {
        return mockNoteShares
          .filter((share) => share.noteId === noteId)
          .map((share) => ({
            id: share.id,
            recipientEmail: share.recipientEmail,
            recipientDisplayName: share.recipientDisplayName,
            permission: share.permission,
            createdAt: share.createdAt,
            updatedAt: share.updatedAt,
          }));
      }

      return await fetchNoteSharesFromApi(noteId);
    },
  });
};

type UpdateNoteMutationInput = UpdateNoteInput & { isProtected?: boolean; isShared?: boolean };

export const useCreateNote = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateNoteInput) => {
      if (!backendNotesAvailable()) {
        const createdNote = createNote(data);
        await upsertNoteInDb(createdNote);
        queueOfflineMutation({
          type: 'create',
          noteId: createdNote.id,
          payload: {
            title: data.title,
            content: data.content,
            labels: data.labels,
            noteId: createdNote.id,
          },
        });
        return createdNote;
      }

      const createdNote = await createNoteInApi(data);
      await upsertNoteInDb(createdNote);
      return createdNote;
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: NOTES_KEYS.all });

      const previousNotes = queryClient.getQueryData<Note[]>(NOTES_KEYS.all);
      const optimisticNote: Note = {
        id: createId(),
        title: input.title,
        content: input.content || '',
        isPinned: false,
        isProtected: false,
        isShared: false,
        labels: input.labels || [],
        createdAt: now(),
        updatedAt: now(),
      };

      queryClient.setQueryData<Note[]>(NOTES_KEYS.all, (currentNotes) => [optimisticNote, ...(currentNotes || [])]);
      queryClient.setQueryData<NoteDetailItem>(NOTES_KEYS.detail(optimisticNote.id), optimisticNote);

      return { previousNotes, optimisticId: optimisticNote.id };
    },
    onError: (_error, _input, context) => {
      if (context?.previousNotes) {
        queryClient.setQueryData(NOTES_KEYS.all, context.previousNotes);
      }
    },
    onSuccess: (createdNote, _input, context) => {
      queryClient.setQueryData<Note[]>(NOTES_KEYS.all, (currentNotes = []) =>
        currentNotes.map((note) => (note.id === context?.optimisticId ? createdNote : note)),
      );
      queryClient.setQueryData(NOTES_KEYS.detail(createdNote.id), createdNote);
      void upsertNoteInDb(createdNote);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: NOTES_KEYS.all });
    },
  });
};

export const useUpdateNote = (id: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateNoteMutationInput) => {
      if (!backendNotesAvailable()) {
        const updatedNote = updateNote(id, data);
        await upsertNoteInDb(updatedNote);
        queueOfflineMutation({
          type: 'update',
          noteId: id,
          payload: {
            noteId: id,
            ...data,
          },
        });
        return updatedNote;
      }

      const updatedNote = await updateNoteInApi(id, data);
      await upsertNoteInDb(updatedNote);
      return updatedNote;
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: NOTES_KEYS.all });
      await queryClient.cancelQueries({ queryKey: NOTES_KEYS.detail(id) });

      const previousNotes = queryClient.getQueryData<Note[]>(NOTES_KEYS.all);
      const previousNote = queryClient.getQueryData<Note>(NOTES_KEYS.detail(id));

      queryClient.setQueryData<Note[]>(NOTES_KEYS.all, (currentNotes = []) =>
        currentNotes.map((note) =>
          note.id === id
            ? {
                ...note,
                title: input.title ?? note.title,
                content: input.content ?? note.content,
                isPinned: input.isPinned ?? note.isPinned,
                isProtected: input.isProtected ?? note.isProtected,
                labels: input.labels ?? note.labels,
                updatedAt: now(),
              }
            : note,
        ),
      );

      queryClient.setQueryData<Note>(NOTES_KEYS.detail(id), (currentNote) =>
        currentNote
          ? {
              ...currentNote,
              title: input.title ?? currentNote.title,
              content: input.content ?? currentNote.content,
              isPinned: input.isPinned ?? currentNote.isPinned,
              isProtected: input.isProtected ?? currentNote.isProtected,
              labels: input.labels ?? currentNote.labels,
              updatedAt: now(),
            }
          : currentNote,
      );

      return { previousNotes, previousNote };
    },
    onError: (_error, _input, context) => {
      if (context?.previousNotes) {
        queryClient.setQueryData(NOTES_KEYS.all, context.previousNotes);
      }

      if (context?.previousNote) {
        queryClient.setQueryData(NOTES_KEYS.detail(id), context.previousNote);
      }
    },
    onSuccess: (updatedNote, input) => {
      const normalizedNote = input.isProtected === undefined ? updatedNote : { ...updatedNote, isProtected: input.isProtected };
      queryClient.setQueryData<Note[]>(NOTES_KEYS.all, (currentNotes = []) =>
        currentNotes.map((note) => (note.id === id ? normalizedNote : note)),
      );
      queryClient.setQueryData(NOTES_KEYS.detail(id), normalizedNote);
      void upsertNoteInDb(normalizedNote);
    },
  });
};

export const useDeleteNote = (id: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!backendNotesAvailable()) {
        deleteNote(id);
        await deleteNoteFromDb(id);
        queueOfflineMutation({
          type: 'delete',
          noteId: id,
          payload: { noteId: id },
        });
        return;
      }

      await deleteNoteInApi(id);
      await deleteNoteFromDb(id);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: NOTES_KEYS.all });
      await queryClient.cancelQueries({ queryKey: NOTES_KEYS.detail(id) });

      const previousNotes = queryClient.getQueryData<Note[]>(NOTES_KEYS.all);
      const previousNote = queryClient.getQueryData<Note>(NOTES_KEYS.detail(id));

      queryClient.setQueryData<Note[]>(NOTES_KEYS.all, (currentNotes = []) =>
        currentNotes.filter((note) => note.id !== id),
      );
      queryClient.removeQueries({ queryKey: NOTES_KEYS.detail(id) });

      return { previousNotes, previousNote };
    },
    onError: (_error, _input, context) => {
      if (context?.previousNotes) {
        queryClient.setQueryData(NOTES_KEYS.all, context.previousNotes);
      }

      if (context?.previousNote) {
        queryClient.setQueryData(NOTES_KEYS.detail(id), context.previousNote);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTES_KEYS.all });
      void deleteNoteFromDb(id);
    },
  });
};

export const useCreateNoteShare = (noteId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateNoteShareInput) => {
      if (!backendNotesAvailable()) {
        const owner = currentUserProfile() ?? { id: 'local', email: input.recipientEmail, displayName: 'Local User' };
        const recipient = input.recipientEmail.trim().toLowerCase();
        const share: MockShareRecord = {
          id: createId(),
          noteId,
          recipientEmail: recipient,
          recipientDisplayName: recipient,
          permission: input.permission,
          createdAt: now(),
          updatedAt: now(),
          owner,
        };

        mockNoteShares = [
          ...mockNoteShares.filter((record) => !(record.noteId === noteId && record.recipientEmail === recipient)),
          share,
        ];
        syncNoteShareFlag(noteId);
        await upsertNoteInDb(getNoteById(noteId));
        queueOfflineMutation({
          type: 'share',
          noteId,
          payload: {
            noteId,
            recipientEmail: input.recipientEmail,
            permission: input.permission,
          },
        });
        return { ...share, recipientDisplayName: share.recipientDisplayName } satisfies NoteShareRecord;
      }

      const createdShare = await createNoteShareInApi(noteId, input);
      await upsertNoteInDb(getNoteById(noteId));
      return createdShare;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTES_KEYS.shares(noteId) });
      queryClient.invalidateQueries({ queryKey: NOTES_KEYS.shared });
      queryClient.invalidateQueries({ queryKey: NOTES_KEYS.detail(noteId) });
      queryClient.invalidateQueries({ queryKey: NOTES_KEYS.all });
    },
  });
};

export const useUpdateNoteShare = (noteId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ shareId, input }: { shareId: string; input: UpdateNoteShareInput }) => {
      if (!backendNotesAvailable()) {
        mockNoteShares = mockNoteShares.map((record) =>
          record.noteId === noteId && record.id === shareId
            ? { ...record, permission: input.permission, updatedAt: now() }
            : record,
        );
        syncNoteShareFlag(noteId);
        const updated = mockNoteShares.find((record) => record.noteId === noteId && record.id === shareId);
        if (!updated) {
          throw new Error('Share not found');
        }
        return {
          id: updated.id,
          recipientEmail: updated.recipientEmail,
          recipientDisplayName: updated.recipientDisplayName,
          permission: updated.permission,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
        } satisfies NoteShareRecord;
      }

      const updatedShare = await updateNoteShareInApi(noteId, shareId, input);
      await upsertNoteInDb(getNoteById(noteId));
      return updatedShare;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTES_KEYS.shares(noteId) });
      queryClient.invalidateQueries({ queryKey: NOTES_KEYS.shared });
      queryClient.invalidateQueries({ queryKey: NOTES_KEYS.detail(noteId) });
      queryClient.invalidateQueries({ queryKey: NOTES_KEYS.all });
    },
  });
};

export const useDeleteNoteShare = (noteId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (shareId: string) => {
      if (!backendNotesAvailable()) {
        mockNoteShares = mockNoteShares.filter((record) => !(record.noteId === noteId && record.id === shareId));
        syncNoteShareFlag(noteId);
        await upsertNoteInDb(getNoteById(noteId));
        return;
      }

      await deleteNoteShareInApi(noteId, shareId);
      await upsertNoteInDb(getNoteById(noteId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTES_KEYS.shares(noteId) });
      queryClient.invalidateQueries({ queryKey: NOTES_KEYS.shared });
      queryClient.invalidateQueries({ queryKey: NOTES_KEYS.detail(noteId) });
      queryClient.invalidateQueries({ queryKey: NOTES_KEYS.all });
    },
  });
};
