import { create } from 'zustand';

type NoteProtectionState = {
  unlockedNoteIds: string[];
  unlockTokens: Record<string, string>;
  markUnlocked: (noteId: string, token?: string) => void;
  markLocked: (noteId: string) => void;
  isUnlocked: (noteId: string) => boolean;
  getUnlockToken: (noteId: string) => string | undefined;
  resetProtectionState: () => void;
};

export const useNoteProtectionStore = create<NoteProtectionState>((set, get) => ({
  unlockedNoteIds: [],
  unlockTokens: {},
  markUnlocked: (noteId, token) => {
    set((state) => ({
      unlockedNoteIds: state.unlockedNoteIds.includes(noteId)
        ? state.unlockedNoteIds
        : [...state.unlockedNoteIds, noteId],
      unlockTokens: token
        ? { ...state.unlockTokens, [noteId]: token }
        : state.unlockTokens,
    }));
  },
  markLocked: (noteId) => {
    set((state) => {
      const remainingTokens = { ...state.unlockTokens };
      delete remainingTokens[noteId];
      return {
        unlockedNoteIds: state.unlockedNoteIds.filter((id) => id !== noteId),
        unlockTokens: remainingTokens,
      };
    });
  },
  isUnlocked: (noteId) => get().unlockedNoteIds.includes(noteId),
  getUnlockToken: (noteId) => get().unlockTokens[noteId],
  resetProtectionState: () => set({ unlockedNoteIds: [], unlockTokens: {} }),
}));
