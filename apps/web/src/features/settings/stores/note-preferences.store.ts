import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type NoteFontSize = 'sm' | 'base' | 'lg';
export type NoteColor = 'default' | 'yellow' | 'green' | 'blue' | 'pink' | 'purple';

export const noteColorClasses: Record<NoteColor, { card: string; hover: string; selected: string; editor: string }> = {
  default: {
    card: 'bg-card text-foreground border-border/30',
    hover: 'hover:bg-card/90 hover:border-primary/30',
    selected: 'border-primary bg-primary/10',
    editor: 'bg-card',
  },
  yellow: {
    card: 'bg-amber-50/80 dark:bg-amber-950/20 text-amber-900 dark:text-amber-100 border-amber-200/60 dark:border-amber-800/20',
    hover: 'hover:bg-amber-100/60 dark:hover:bg-amber-950/30 hover:border-amber-300 dark:hover:border-amber-700/30',
    selected: 'border-amber-500 bg-amber-200/40 dark:bg-amber-900/40 ring-1 ring-amber-400/25',
    editor: 'bg-amber-50/40 dark:bg-amber-950/10',
  },
  green: {
    card: 'bg-emerald-50/80 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-100 border-emerald-200/60 dark:border-emerald-800/20',
    hover: 'hover:bg-emerald-100/60 dark:hover:bg-emerald-950/30 hover:border-emerald-300 dark:hover:border-emerald-700/30',
    selected: 'border-emerald-500 bg-emerald-200/40 dark:bg-emerald-900/40 ring-1 ring-emerald-400/25',
    editor: 'bg-emerald-50/40 dark:bg-emerald-950/10',
  },
  blue: {
    card: 'bg-sky-50/80 dark:bg-sky-950/20 text-sky-900 dark:text-sky-100 border-sky-200/60 dark:border-sky-800/20',
    hover: 'hover:bg-sky-100/60 dark:hover:bg-sky-950/30 hover:border-sky-300 dark:hover:border-sky-700/30',
    selected: 'border-sky-500 bg-sky-200/40 dark:bg-sky-900/40 ring-1 ring-sky-400/25',
    editor: 'bg-sky-50/40 dark:bg-sky-950/10',
  },
  pink: {
    card: 'bg-rose-50/80 dark:bg-rose-950/20 text-rose-900 dark:text-rose-100 border-rose-200/60 dark:border-rose-800/20',
    hover: 'hover:bg-rose-100/60 dark:hover:bg-rose-950/30 hover:border-rose-300 dark:hover:border-rose-700/30',
    selected: 'border-rose-500 bg-rose-200/40 dark:bg-rose-900/40 ring-1 ring-rose-400/25',
    editor: 'bg-rose-50/40 dark:bg-rose-950/10',
  },
  purple: {
    card: 'bg-violet-50/80 dark:bg-violet-950/20 text-violet-900 dark:text-violet-100 border-violet-200/60 dark:border-violet-800/20',
    hover: 'hover:bg-violet-100/60 dark:hover:bg-violet-950/30 hover:border-violet-300 dark:hover:border-violet-700/30',
    selected: 'border-violet-500 bg-violet-200/40 dark:bg-violet-900/40 ring-1 ring-violet-400/25',
    editor: 'bg-violet-50/40 dark:bg-violet-950/10',
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
