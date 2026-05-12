import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type NoteProtectionState = {
  passwordsByNoteId: Record<string, string>;
  unlockedNoteIds: string[];
  lockNote: (noteId: string, password: string) => boolean;
  unlockNote: (noteId: string, password: string) => boolean;
  removeProtection: (noteId: string, password: string) => boolean;
  isUnlocked: (noteId: string) => boolean;
  resetProtectionState: () => void;
};

const normalizePassword = (password: string) => password.trim();

export const useNoteProtectionStore = create<NoteProtectionState>()(
  persist(
    (set, get) => ({
      passwordsByNoteId: {},
      unlockedNoteIds: [],
      lockNote: (noteId, password) => {
        const normalizedPassword = normalizePassword(password);

        if (!normalizedPassword) {
          return false;
        }

        set((state) => ({
          passwordsByNoteId: {
            ...state.passwordsByNoteId,
            [noteId]: normalizedPassword,
          },
          unlockedNoteIds: state.unlockedNoteIds.filter((id) => id !== noteId),
        }));

        return true;
      },
      unlockNote: (noteId, password) => {
        const normalizedPassword = normalizePassword(password);

        if (get().passwordsByNoteId[noteId] !== normalizedPassword) {
          return false;
        }

        set((state) => ({
          unlockedNoteIds: state.unlockedNoteIds.includes(noteId)
            ? state.unlockedNoteIds
            : [...state.unlockedNoteIds, noteId],
        }));

        return true;
      },
      removeProtection: (noteId, password) => {
        const normalizedPassword = normalizePassword(password);

        if (get().passwordsByNoteId[noteId] !== normalizedPassword) {
          return false;
        }

        set((state) => {
          const nextPasswords = { ...state.passwordsByNoteId };
          delete nextPasswords[noteId];

          return {
            passwordsByNoteId: nextPasswords,
            unlockedNoteIds: state.unlockedNoteIds.filter((id) => id !== noteId),
          };
        });

        return true;
      },
      isUnlocked: (noteId) => get().unlockedNoteIds.includes(noteId),
      resetProtectionState: () => set({ passwordsByNoteId: {}, unlockedNoteIds: [] }),
    }),
    {
      name: 'odd-note-protection',
      partialize: (state) => ({
        passwordsByNoteId: state.passwordsByNoteId,
      }),
    },
  ),
);
