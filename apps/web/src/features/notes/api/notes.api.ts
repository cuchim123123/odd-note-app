import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import type { Note, CreateNoteInput, UpdateNoteInput } from '@odd-note-app/validation';

// Using a unique key for notes queries
export const NOTES_KEYS = {
  all: ['notes'] as const,
  detail: (id: string) => ['notes', id] as const,
};

export const useNotes = () => {
  return useQuery({
    queryKey: NOTES_KEYS.all,
    queryFn: async () => {
      // TODO: Replace with actual backend call
      // const response = await api.get<Note[]>('/notes');
      // return response.data;
      
      // MOCK DATA for frontend development
      return new Promise<Note[]>((resolve) => {
        setTimeout(() => {
          resolve([
            { 
              id: '550e8400-e29b-41d4-a716-446655440000', 
              title: 'Getting Started', 
              content: '<p>Welcome to odd note!</p>', 
              isPinned: true,
              isProtected: false,
              isShared: false,
              labels: ['tutorial'],
              createdAt: new Date().toISOString(), 
              updatedAt: new Date().toISOString() 
            },
            { 
              id: '550e8400-e29b-41d4-a716-446655440001', 
              title: 'Meeting Notes', 
              content: '<ul><li>Discuss frontend architecture</li><li>Review mock APIs</li></ul>', 
              isPinned: false,
              isProtected: false,
              isShared: true,
              labels: ['work', 'meeting'],
              createdAt: new Date().toISOString(), 
              updatedAt: new Date().toISOString() 
            },
          ]);
        }, 500);
      });
    },
  });
};

export const useNote = (id: string | null) => {
  return useQuery({
    queryKey: NOTES_KEYS.detail(id!),
    enabled: !!id,
    queryFn: async () => {
      // TODO: Replace with actual backend call
      // const response = await api.get<Note>(`/notes/${id}`);
      // return response.data;
      
      // MOCK DATA
      return new Promise<Note>((resolve) => {
        setTimeout(() => {
          resolve({ 
            id: id!, 
            title: 'Mock Note', 
            content: '<p>This is a mock note.</p>', 
            isPinned: false,
            isProtected: false,
            isShared: false,
            labels: [],
            createdAt: new Date().toISOString(), 
            updatedAt: new Date().toISOString() 
          });
        }, 300);
      });
    },
  });
};

export const useCreateNote = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateNoteInput) => {
      // const response = await api.post<Note>('/notes', data);
      // return response.data;
      
      // MOCK DATA
      return new Promise<Note>((resolve) => {
        setTimeout(() => {
          const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
          resolve({ 
            id: uuid, 
            title: data.title, 
            content: data.content || '', 
            isPinned: false,
            isProtected: false,
            isShared: false,
            labels: data.labels || [],
            createdAt: new Date().toISOString(), 
            updatedAt: new Date().toISOString() 
          });
        }, 500);
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTES_KEYS.all });
    },
  });
};

export const useUpdateNote = (id: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateNoteInput) => {
      // const response = await api.patch<Note>(`/notes/${id}`, data);
      // return response.data;
      
      // MOCK DATA
      return new Promise<Note>((resolve) => {
        setTimeout(() => {
          resolve({ 
            id, 
            title: data.title || 'Updated Title', 
            content: data.content || '', 
            isPinned: data.isPinned ?? false,
            isProtected: data.isProtected ?? false,
            isShared: false,
            labels: data.labels || [],
            createdAt: new Date().toISOString(), 
            updatedAt: new Date().toISOString() 
          });
        }, 500);
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTES_KEYS.all });
      queryClient.invalidateQueries({ queryKey: NOTES_KEYS.detail(id) });
    },
  });
};

export const useDeleteNote = (id: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // await api.delete(`/notes/${id}`);
      
      // MOCK DATA
      return new Promise<void>((resolve) => setTimeout(resolve, 500));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTES_KEYS.all });
      queryClient.invalidateQueries({ queryKey: NOTES_KEYS.detail(id) });
    },
  });
};
