import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type NoteFontSize = 'sm' | 'base' | 'lg';

type NotePreferencesState = {
  noteFontSize: NoteFontSize;
  setNoteFontSize: (noteFontSize: NoteFontSize) => void;
};

export const useNotePreferencesStore = create<NotePreferencesState>()(
  persist(
    (set) => ({
      noteFontSize: 'base',
      setNoteFontSize: (noteFontSize) => set({ noteFontSize }),
    }),
    {
      name: 'odd-note-preferences',
    },
  ),
);
