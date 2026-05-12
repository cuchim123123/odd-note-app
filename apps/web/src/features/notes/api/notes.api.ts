import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import type { Note, CreateNoteInput, UpdateNoteInput } from '@odd-note-app/validation';

const createId = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
  const random = Math.random() * 16 | 0;
  const value = character === 'x' ? random : (random & 0x3 | 0x8);
  return value.toString(16);
});

const now = () => new Date().toISOString();

const cloneNote = (note: Note): Note => ({ ...note, labels: [...note.labels] });

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

function getSortedNotes(): Note[] {
  return [...mockNotes]
    .sort((left, right) => {
      if (left.isPinned !== right.isPinned) {
        return Number(right.isPinned) - Number(left.isPinned);
      }

      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    })
    .map(cloneNote);
}

function getNoteById(id: string): Note {
  const note = mockNotes.find((entry) => entry.id === id);

  if (!note) {
    throw new Error('Note not found');
  }

  return cloneNote(note);
}

function createNote(input: CreateNoteInput): Note {
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

function updateNote(id: string, input: UpdateNoteInput): Note {
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

function deleteNote(id: string): void {
  mockNotes = mockNotes.filter((entry) => entry.id !== id);
}

// Using a unique key for notes queries
export const NOTES_KEYS = {
  all: ['notes'] as const,
  detail: (id: string) => ['notes', id] as const,
};

export const useNotes = () => {
  return useQuery({
    queryKey: NOTES_KEYS.all,
    queryFn: async () => {
      return new Promise<Note[]>((resolve) => {
        setTimeout(() => {
          resolve(getSortedNotes());
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
      return new Promise<Note>((resolve) => {
        setTimeout(() => {
          resolve(getNoteById(id!));
        }, 300);
      });
    },
  });
};

export const useCreateNote = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateNoteInput) => {
      return new Promise<Note>((resolve) => {
        setTimeout(() => {
          resolve(createNote(data));
        }, 500);
      });
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
    mutationFn: async (data: UpdateNoteInput) => {
      return new Promise<Note>((resolve) => {
        setTimeout(() => {
          resolve(updateNote(id, data));
        }, 500);
      });
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
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          deleteNote(id);
          resolve();
        }, 500);
      });
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
