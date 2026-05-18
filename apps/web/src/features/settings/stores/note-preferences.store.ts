import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type NoteFontSize = 'sm' | 'base' | 'lg';
export type NoteColor = 'default' | 'yellow' | 'green' | 'blue' | 'pink' | 'purple';

export const noteColorClasses: Record<NoteColor, { editor: string }> = {
  default: {
    editor: 'bg-card text-foreground border-border/30',
  },
  yellow: {
    editor: 'bg-amber-50/70 dark:bg-amber-950/20 text-amber-900 dark:text-amber-100 border-amber-200/60 dark:border-amber-900/30',
  },
  green: {
    editor: 'bg-emerald-50/70 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-100 border-emerald-200/60 dark:border-emerald-900/30',
  },
  blue: {
    editor: 'bg-sky-50/70 dark:bg-sky-950/20 text-sky-900 dark:text-sky-100 border-sky-200/60 dark:border-sky-900/30',
  },
  pink: {
    editor: 'bg-rose-50/70 dark:bg-rose-950/20 text-rose-900 dark:text-rose-100 border-rose-200/60 dark:border-rose-900/30',
  },
  purple: {
    editor: 'bg-violet-50/70 dark:bg-violet-950/20 text-violet-900 dark:text-violet-100 border-violet-200/60 dark:border-violet-900/30',
  },
};

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
