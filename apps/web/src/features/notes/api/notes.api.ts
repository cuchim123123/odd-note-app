import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/axios';
import { useAuthStore } from '../../auth/stores/auth.store';
import { useOfflineSyncStore } from '../../../stores/offline-sync.store';
import { useNoteProtectionStore } from '../stores/note-protection.store';
import type { Note, CreateNoteInput, UpdateNoteInput, CreateNoteShareInput, UpdateNoteShareInput } from '@odd-note-app/validation';

export type SharePermission = 'READ' | 'EDIT';

export type SharedByProfile = {
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

export type NoteDraft = {
  title: string;
  content: string;
  updatedAt: string;
};

const createId = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
  const random = Math.random() * 16 | 0;
  const value = character === 'x' ? random : (random & 0x3 | 0x8);
  return value.toString(16);
});

const now = () => new Date().toISOString();





import { openNotesDb, readAllNotesFromDb, readNoteFromDb, upsertNoteInDb, upsertNotesInDb, deleteNoteFromDb } from './notes.storage';

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

      return new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime();
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

import {
  fetchNotesFromApi,
  fetchNoteFromApi,
  createNoteInApi,
  updateNoteInApi,
  deleteNoteInApi,
  fetchSharedNotesFromApi,
  fetchNoteSharesFromApi,
  createNoteShareInApi,
  updateNoteShareInApi,
  deleteNoteShareInApi,
  renameLabelInApi,
  deleteLabelInApi,
} from './notes.client';

import {
  mockNotes,
  mockNoteShares,
  mockNoteDrafts,
  getSortedNotes,
  getNoteById,
  createNote,
  updateNote,
  deleteNote,
  renameLabelInNotes,
  resetMockNotes,
  syncNoteShareFlag,
  toSharedNoteItem,
  upsertShare,
  updateSharePermission,
  removeShare,
  getMockDraft,
  setMockDraft,
  clearMockDraft,
  getAllMockShares,
  type MockShareRecord,
} from './notes.mock';

export {
  mockNotes,
  mockNoteShares,
  mockNoteDrafts,
  getSortedNotes,
  getNoteById,
  createNote,
  updateNote,
  deleteNote,
  renameLabelInNotes,
  resetMockNotes,
  syncNoteShareFlag,
  toSharedNoteItem,
  upsertShare,
  updateSharePermission,
  removeShare,
  getMockDraft,
  setMockDraft,
  clearMockDraft,
  getAllMockShares,
};

const hasAccessToken = () => Boolean(useAuthStore.getState().accessToken);

const backendNotesAvailable = () => hasAccessToken();

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

// mock helpers `syncNoteShareFlag` and `toSharedNoteItem` are imported from `notes.mock`.

// Mock implementations and data are provided by `notes.mock`.

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

export async function verifyNotePassword(noteId: string, password: string): Promise<{ verified: boolean; unlockToken?: string }> {
  if (!backendNotesAvailable()) {
    return { verified: password === 'secret123' };
  }

  const response = await api.post<{ verified: boolean; unlockToken?: string }>(`/notes/${noteId}/verify-password`, { password });
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

export async function getNoteDraft(noteId: string, unlockToken?: string): Promise<NoteDraft | null> {
  if (!backendNotesAvailable()) {
    try {
      const db = await openNotesDb();
      const tx = db.transaction('drafts', 'readonly');
      const store = tx.objectStore('drafts');

      const draft = await new Promise<NoteDraft | null>((resolve, reject) => {
        const request = store.get(noteId);
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error);
      });

      db.close();
      return draft ?? null;
    } catch {
      return getMockDraft(noteId) ?? null;
    }
  }

  const headers = unlockToken ? { 'x-note-unlock-token': unlockToken } : {};
  const response = await api.get<NoteDraft | null>(`/notes/${noteId}/draft`, { headers });
  return response.data;
}

export async function saveNoteDraft(noteId: string, title: string, content: string): Promise<{ saved: true; updatedAt: string }> {
  if (!backendNotesAvailable()) {
    const updatedAt = now();
    try {
      const db = await openNotesDb();
      const tx = db.transaction('drafts', 'readwrite');
      const store = tx.objectStore('drafts');

      await new Promise<void>((resolve, reject) => {
        const request = store.put({ id: noteId, title, content, updatedAt });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      db.close();
      return { saved: true, updatedAt };
    } catch {
      setMockDraft(noteId, { title, content, updatedAt });
      return { saved: true, updatedAt };
    }
  }

  const response = await api.post<{ saved: true; updatedAt: string }>(`/notes/${noteId}/draft`, { title, content });
  return response.data;
}

export async function clearNoteDraft(noteId: string): Promise<{ cleared: true }> {
  if (!backendNotesAvailable()) {
    try {
      const db = await openNotesDb();
      const tx = db.transaction('drafts', 'readwrite');
      const store = tx.objectStore('drafts');

      await new Promise<void>((resolve, reject) => {
        const request = store.delete(noteId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      db.close();
      return { cleared: true };
    } catch {
      clearMockDraft(noteId);
      return { cleared: true };
    }
  }

  const response = await api.delete<{ cleared: true }>(`/notes/${noteId}/draft`);
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
        return mockNoteShares.map((share) => toSharedNoteItem(share) as SharedNoteItem);
      }

      return await fetchSharedNotesFromApi();
    },
  });
};

export const useNote = (id: string | null) => {
  const getUnlockToken = useNoteProtectionStore((s) => s.getUnlockToken);
  const unlockToken = id ? getUnlockToken(id) : undefined;

  return useQuery<NoteDetailItem>({
    queryKey: [...NOTES_KEYS.detail(id!), unlockToken],
    enabled: !!id,
    queryFn: async () => {
      if (!backendNotesAvailable()) {
        return (await getOfflineNote(id!)) as NoteDetailItem;
      }

      const note = await fetchNoteFromApi(id!, unlockToken);
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
          noteId: createdNote.id || '',
          payload: {
            title: data.title,
            content: data.content || '',
            labels: data.labels || [],
            noteId: createdNote.id || '',
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
      } as Note;

      queryClient.setQueryData<Note[]>(NOTES_KEYS.all, (currentNotes) => [optimisticNote, ...(currentNotes || [])]);
      queryClient.setQueriesData<NoteDetailItem>({ queryKey: NOTES_KEYS.detail(optimisticNote.id || '') }, optimisticNote);

      return { previousNotes, optimisticId: optimisticNote.id || '' };
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
      queryClient.setQueriesData<NoteDetailItem>({ queryKey: NOTES_KEYS.detail(createdNote.id || '') }, createdNote);
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
        const updatedNote = updateNote(id || '', data);
        await upsertNoteInDb(updatedNote);
        queueOfflineMutation({
          type: 'update',
          noteId: id,
          payload: {
            noteId: id,
            ...data,
          } as Record<string, unknown>,
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
      const previousDetailQueries = queryClient.getQueriesData<NoteDetailItem>({ queryKey: NOTES_KEYS.detail(id) });

      queryClient.setQueryData<Note[]>(NOTES_KEYS.all, (currentNotes = []) =>
        currentNotes.map((note) =>
          note.id === id
            ? ({
                ...note,
                title: input.title ?? note.title,
                content: input.content ?? note.content,
                isPinned: input.isPinned ?? note.isPinned,
                isProtected: input.isProtected ?? note.isProtected,
                labels: input.labels ?? note.labels,
                updatedAt: now(),
              } as Note)
            : note,
        ),
      );

      queryClient.setQueriesData<NoteDetailItem>({ queryKey: NOTES_KEYS.detail(id) }, (currentNote: NoteDetailItem | undefined) =>
        currentNote
          ? ({
              ...currentNote,
              title: input.title ?? currentNote.title,
              content: input.content ?? currentNote.content,
              isPinned: input.isPinned ?? currentNote.isPinned,
              isProtected: input.isProtected ?? currentNote.isProtected,
              labels: input.labels ?? currentNote.labels,
              updatedAt: now(),
            } as NoteDetailItem)
          : currentNote,
      );

      return { previousNotes, previousDetailQueries };
    },
    onError: (_error, _input, context) => {
      if (context?.previousNotes) {
        queryClient.setQueryData(NOTES_KEYS.all, context.previousNotes);
      }

      if (context?.previousDetailQueries) {
        context.previousDetailQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSuccess: (updatedNote) => {
      queryClient.setQueryData<Note[]>(NOTES_KEYS.all, (currentNotes = []) =>
        currentNotes.map((note) =>
          note.id === id ? { ...note, ...updatedNote } : note
        ),
      );
      queryClient.setQueriesData<NoteDetailItem>({ queryKey: NOTES_KEYS.detail(id) }, (current) =>
        current ? { ...current, ...updatedNote } : updatedNote
      );
      void upsertNoteInDb(updatedNote);
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
      const previousDetailQueries = queryClient.getQueriesData<NoteDetailItem>({ queryKey: NOTES_KEYS.detail(id) });

      queryClient.setQueryData<Note[]>(NOTES_KEYS.all, (currentNotes = []) =>
        currentNotes.filter((note) => note.id !== id),
      );
      queryClient.removeQueries({ queryKey: NOTES_KEYS.detail(id) });

      return { previousNotes, previousDetailQueries };
    },
    onError: (_error, _input, context) => {
      if (context?.previousNotes) {
        queryClient.setQueryData(NOTES_KEYS.all, context.previousNotes);
      }

      if (context?.previousDetailQueries) {
        context.previousDetailQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
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
        const owner = currentUserProfile() ?? { id: 'local', email: input.recipientEmail || '', displayName: 'Local User' };
        const recipient = (input.recipientEmail || '').trim().toLowerCase();
        const share = {
          id: createId(),
          noteId,
          recipientEmail: recipient,
          recipientDisplayName: recipient,
          permission: input.permission,
          createdAt: now(),
          updatedAt: now(),
          owner,
        } as MockShareRecord;

        upsertShare(share);
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
        return {
          ...share,
          recipientDisplayName: share.recipientDisplayName || share.recipientEmail
        } as NoteShareRecord;
      }

      const createdShare = await createNoteShareInApi(noteId, {
        recipientEmail: input.recipientEmail || '',
        permission: input.permission || 'READ'
      });
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
        const updated = updateSharePermission(noteId, shareId, input.permission as string);
        syncNoteShareFlag(noteId);
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

      const updatedShare = await updateNoteShareInApi(noteId, shareId, {
        permission: input.permission || 'READ'
      });
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
        removeShare(noteId, shareId);
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

export const useRenameLabel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ oldName, newName }: { oldName: string; newName: string }) => {
      if (!backendNotesAvailable()) {
        renameLabelInNotes(oldName, newName);
        return { updatedCount: 0 };
      }

      return await renameLabelInApi(oldName, newName);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTES_KEYS.all });
    },
  });
};

export const useDeleteLabel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (labelName: string) => {
      if (!backendNotesAvailable()) {
        return { updatedCount: 0 };
      }

      return await deleteLabelInApi(labelName);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTES_KEYS.all });
    },
  });
};

export const useBulkDeleteNotes = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        if (!backendNotesAvailable()) {
          deleteNote(id);
          await deleteNoteFromDb(id);
          queueOfflineMutation({
            type: 'delete',
            noteId: id,
            payload: { noteId: id },
          });
        } else {
          await deleteNoteInApi(id);
          await deleteNoteFromDb(id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTES_KEYS.all });
    },
  });
};

export const useBulkAddLabel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ids, label, notes }: { ids: string[]; label: string; notes: Note[] }) => {
      for (const id of ids) {
        const note = notes.find((n) => n.id === id);
        if (!note) continue;
        const newLabels = Array.from(new Set([...(note.labels || []), label]));

        if (!backendNotesAvailable()) {
          const updatedNote = updateNote(id, { labels: newLabels });
          await upsertNoteInDb(updatedNote);
          queueOfflineMutation({
            type: 'update',
            noteId: id,
            payload: { noteId: id, labels: newLabels } as Record<string, unknown>,
          });
        } else {
          const updatedNote = await updateNoteInApi(id, { labels: newLabels });
          await upsertNoteInDb(updatedNote);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTES_KEYS.all });
    },
  });
};

/**
 * Mutation hook to upload a note image to S3/MinIO.
 */
export const useUploadNoteImage = () => {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post<{ url: string; signedUrl: string; key: string }>('/uploads', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    },
  });
};
