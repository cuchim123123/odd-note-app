import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type NoteFontSize = 'sm' | 'base' | 'lg';
export type NoteColor = 'default' | 'yellow' | 'green' | 'blue' | 'pink' | 'purple';

type NotePreferencesState = {
  noteFontSize: NoteFontSize;
  noteColor: NoteColor;
  setNoteFontSize: (noteFontSize: NoteFontSize) => void;
  setNoteColor: (noteColor: NoteColor) => void;
};

export const useNotePreferencesStore = create<NotePreferencesState>()(
  persist(
    (set) => ({
      noteFontSize: 'base',
      noteColor: 'default',
      setNoteFontSize: (noteFontSize) => set({ noteFontSize }),
      setNoteColor: (noteColor) => set({ noteColor }),
    }),
    {
      name: 'odd-note-preferences',
    },
  ),
);
