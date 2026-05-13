import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type NoteProtectionState = {
  unlockedNoteIds: string[];
  markUnlocked: (noteId: string) => void;
  markLocked: (noteId: string) => void;
  isUnlocked: (noteId: string) => boolean;
  resetProtectionState: () => void;
};

export const useNoteProtectionStore = create<NoteProtectionState>()(
  persist(
    (set, get) => ({
      unlockedNoteIds: [],
      markUnlocked: (noteId) => {
        set((state) => ({
          unlockedNoteIds: state.unlockedNoteIds.includes(noteId)
            ? state.unlockedNoteIds
            : [...state.unlockedNoteIds, noteId],
        }));
      },
      markLocked: (noteId) => {
        set((state) => {
          return {
            unlockedNoteIds: state.unlockedNoteIds.filter((id) => id !== noteId),
          };
        });
      },
      isUnlocked: (noteId) => get().unlockedNoteIds.includes(noteId),
      resetProtectionState: () => set({ unlockedNoteIds: [] }),
    }),
    {
      name: 'odd-note-protection',
      partialize: (state) => ({
        unlockedNoteIds: state.unlockedNoteIds,
      }),
    },
  ),
);
