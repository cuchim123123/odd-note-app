import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type NoteFontSize = 'sm' | 'base' | 'lg';
export type NoteColor = 'default' | 'yellow' | 'green' | 'blue' | 'pink' | 'purple';

export const noteColorClasses: Record<NoteColor, { card: string; cardSelected: string; editor: string; editorContent: string }> = {
  default: {
    card: 'border-border/30 bg-card hover:bg-card/90 hover:border-primary/30',
    cardSelected: 'border-primary bg-primary/10 ring-1 ring-primary/20',
    editor: 'bg-card border-border/30 shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.5)]',
    editorContent: 'bg-[hsl(var(--editor-surface))]',
  },
  yellow: {
    card: 'border-amber-200/60 bg-amber-100/45 dark:bg-amber-950/35 text-amber-950 dark:text-amber-50 hover:bg-amber-100/60 dark:hover:bg-amber-950/45 hover:border-amber-400/50',
    cardSelected: 'border-amber-400 bg-amber-200/50 dark:bg-amber-900/40 ring-1 ring-amber-400/30',
    editor: 'bg-amber-100/30 dark:bg-amber-950/25 border-amber-200/50 dark:border-amber-900/35 shadow-[0_20px_60px_rgba(15,23,42,0.08)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)]',
    editorContent: 'bg-amber-100/15 dark:bg-amber-950/15',
  },
  green: {
    card: 'border-emerald-200/60 bg-emerald-100/45 dark:bg-emerald-950/35 text-emerald-950 dark:text-emerald-50 hover:bg-emerald-100/60 dark:hover:bg-emerald-950/45 hover:border-emerald-400/50',
    cardSelected: 'border-emerald-400 bg-emerald-200/50 dark:bg-emerald-900/40 ring-1 ring-emerald-400/30',
    editor: 'bg-emerald-100/30 dark:bg-emerald-950/25 border-emerald-200/50 dark:border-emerald-900/35 shadow-[0_20px_60px_rgba(15,23,42,0.08)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)]',
    editorContent: 'bg-emerald-100/15 dark:bg-emerald-950/15',
  },
  blue: {
    card: 'border-sky-200/60 bg-sky-100/45 dark:bg-sky-950/35 text-sky-950 dark:text-sky-50 hover:bg-sky-100/60 dark:hover:bg-sky-950/45 hover:border-sky-400/50',
    cardSelected: 'border-sky-400 bg-sky-200/50 dark:bg-sky-900/40 ring-1 ring-sky-400/30',
    editor: 'bg-sky-100/30 dark:bg-sky-950/25 border-sky-200/50 dark:border-sky-900/35 shadow-[0_20px_60px_rgba(15,23,42,0.08)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)]',
    editorContent: 'bg-sky-100/15 dark:bg-sky-950/15',
  },
  pink: {
    card: 'border-rose-200/60 bg-rose-100/45 dark:bg-rose-950/35 text-rose-950 dark:text-rose-50 hover:bg-rose-100/60 dark:hover:bg-rose-950/45 hover:border-rose-400/50',
    cardSelected: 'border-rose-400 bg-rose-200/50 dark:bg-rose-900/40 ring-1 ring-rose-400/30',
    editor: 'bg-rose-100/30 dark:bg-rose-950/25 border-rose-200/50 dark:border-rose-900/35 shadow-[0_20px_60px_rgba(15,23,42,0.08)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)]',
    editorContent: 'bg-rose-100/15 dark:bg-rose-950/15',
  },
  purple: {
    card: 'border-violet-200/60 bg-violet-100/45 dark:bg-violet-950/35 text-violet-950 dark:text-violet-50 hover:bg-violet-100/60 dark:hover:bg-violet-950/45 hover:border-violet-400/50',
    cardSelected: 'border-violet-400 bg-violet-200/50 dark:bg-violet-900/40 ring-1 ring-violet-400/30',
    editor: 'bg-violet-100/30 dark:bg-violet-950/25 border-violet-200/50 dark:border-violet-900/35 shadow-[0_20px_60px_rgba(15,23,42,0.08)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)]',
    editorContent: 'bg-violet-100/15 dark:bg-violet-950/15',
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
