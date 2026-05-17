import { create } from 'zustand';

type NoteProtectionState = {
  unlockedNoteIds: string[];
  markUnlocked: (noteId: string) => void;
  markLocked: (noteId: string) => void;
  isUnlocked: (noteId: string) => boolean;
  resetProtectionState: () => void;
};

export const useNoteProtectionStore = create<NoteProtectionState>((set, get) => ({
  unlockedNoteIds: [],
  markUnlocked: (noteId) => {
    set((state) => ({
      unlockedNoteIds: state.unlockedNoteIds.includes(noteId)
        ? state.unlockedNoteIds
        : [...state.unlockedNoteIds, noteId],
    }));
  },
  markLocked: (noteId) => {
    set((state) => ({
      unlockedNoteIds: state.unlockedNoteIds.filter((id) => id !== noteId),
    }));
  },
  isUnlocked: (noteId) => get().unlockedNoteIds.includes(noteId),
  resetProtectionState: () => set({ unlockedNoteIds: [] }),
}));
