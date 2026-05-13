import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/axios';
import { useAuthStore } from '../../auth/stores/auth.store';
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
        return getSortedNotes();
      }

      return await fetchNotesFromApi();
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
        return getNoteById(id!) as NoteDetailItem;
      }

      return await fetchNoteFromApi(id!);
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
        return await new Promise<Note>((resolve) => {
          setTimeout(() => resolve(createNote(data)), 500);
        });
      }

      return await createNoteInApi(data);
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
        return await new Promise<Note>((resolve) => {
          setTimeout(() => resolve(updateNote(id, data)), 500);
        });
      }

      return await updateNoteInApi(id, data);
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
    },
  });
};

export const useDeleteNote = (id: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!backendNotesAvailable()) {
        return await new Promise<void>((resolve) => {
          setTimeout(() => {
            deleteNote(id);
            resolve();
          }, 500);
        });
      }

      await deleteNoteInApi(id);
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
        return { ...share, recipientDisplayName: share.recipientDisplayName } satisfies NoteShareRecord;
      }

      return await createNoteShareInApi(noteId, input);
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

      return await updateNoteShareInApi(noteId, shareId, input);
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
        return;
      }

      await deleteNoteShareInApi(noteId, shareId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTES_KEYS.shares(noteId) });
      queryClient.invalidateQueries({ queryKey: NOTES_KEYS.shared });
      queryClient.invalidateQueries({ queryKey: NOTES_KEYS.detail(noteId) });
      queryClient.invalidateQueries({ queryKey: NOTES_KEYS.all });
    },
  });
};
