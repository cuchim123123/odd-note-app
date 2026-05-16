import { useEffect, useState, useRef } from 'react';
import { getNoteDraft, saveNoteDraft, clearNoteDraft } from '../api/notes.api';
import type { Note } from '@odd-note-app/validation';

interface UseNotePersistenceProps {
  note: Note | undefined;
  canEditContent: boolean;
  updateNote: (data: { title?: string; content?: string }) => Promise<Note>;
}

export function useNotePersistence({ note, canEditContent, updateNote }: UseNotePersistenceProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  const isHydratingFromServerRef = useRef(false);
  const loadedNoteIdRef = useRef<string | null>(null);
  const hydrationTimeoutRef = useRef<number | null>(null);

  const getDraftKey = (noteId: string) => `note-draft:${noteId}`;

  const writeLocalDraft = (noteId: string, nextTitle: string, nextContent: string) => {
    try {
      localStorage.setItem(getDraftKey(noteId), JSON.stringify({
        title: nextTitle,
        content: nextContent,
        updatedAt: new Date().toISOString(),
      }));
    } catch {
      // Ignore quota/private mode failures.
    }
  };

  const readLocalDraft = (noteId: string): { title: string; content: string; updatedAt: string } | null => {
    try {
      const raw = localStorage.getItem(getDraftKey(noteId));
      if (!raw) return null;

      const parsed = JSON.parse(raw) as Partial<{ title: string; content: string; updatedAt: string }>;
      if (typeof parsed.title !== 'string' || typeof parsed.content !== 'string' || typeof parsed.updatedAt !== 'string') {
        return null;
      }

      return { title: parsed.title, content: parsed.content, updatedAt: parsed.updatedAt };
    } catch {
      return null;
    }
  };

  const clearLocalDraft = (noteId: string) => {
    try {
      localStorage.removeItem(getDraftKey(noteId));
    } catch {
      // Ignore cleanup failures.
    }
  };

  // Sync local state when note changes
  useEffect(() => {
    if (note && loadedNoteIdRef.current !== note.id) {
      const noteId = note.id!;
      const noteTitle = note.title ?? '';
      const noteContent = note.content ?? '';
      const noteUpdatedAt = note.updatedAt ?? new Date().toISOString();

      isHydratingFromServerRef.current = true;
      if (hydrationTimeoutRef.current) {
        window.clearTimeout(hydrationTimeoutRef.current);
      }
      loadedNoteIdRef.current = noteId;
      setTitle(noteTitle);
      setContent(noteContent);
      setIsDirty(false);
      setLastSavedAt(noteUpdatedAt);
      setSaveError(null);

      hydrationTimeoutRef.current = window.setTimeout(() => {
        if (loadedNoteIdRef.current === noteId) {
          isHydratingFromServerRef.current = false;
        }
        hydrationTimeoutRef.current = null;
      }, 0);
    }
  }, [note]);

  useEffect(() => {
    return () => {
      if (hydrationTimeoutRef.current) {
        window.clearTimeout(hydrationTimeoutRef.current);
      }
    };
  }, []);

  // Load draft
  useEffect(() => {
    if (!note || !canEditContent) return;

    let isCancelled = false;
    const loadDraft = async () => {
      try {
        const noteId = note.id!;
        const noteTitle = note.title ?? '';
        const noteContent = note.content ?? '';
        const noteUpdatedAt = note.updatedAt ?? new Date().toISOString();

        const localDraft = readLocalDraft(noteId);
        if (localDraft && !isCancelled) {
          const isDraftEmpty = localDraft.title.trim().length === 0 && localDraft.content.trim().length === 0;
          const isServerNoteEmpty = noteTitle.trim().length === 0 && noteContent.trim().length === 0;
          if (!(isDraftEmpty && !isServerNoteEmpty)) {
            const draftUpdatedAt = new Date(localDraft.updatedAt).getTime();
            if (draftUpdatedAt >= new Date(noteUpdatedAt).getTime()) {
              setTitle(localDraft.title);
              setContent(localDraft.content);
              return;
            }
          }
        }

        const draft = await getNoteDraft(noteId);
        if (!draft || isCancelled) return;

        const isDraftEmpty = draft.title.trim().length === 0 && draft.content.trim().length === 0;
        const isServerNoteEmpty = noteTitle.trim().length === 0 && noteContent.trim().length === 0;
        if (isDraftEmpty && !isServerNoteEmpty) return;

        const noteUpdatedAtMs = new Date(noteUpdatedAt).getTime();
        const draftUpdatedAt = new Date(draft.updatedAt).getTime();
        if (draftUpdatedAt >= noteUpdatedAtMs) {
          setTitle(draft.title);
          setContent(draft.content);
        }
      } catch { /* ignore */ }
    };

    void loadDraft();
    return () => { isCancelled = true; };
  }, [canEditContent, note]);

  // Dirty check
  useEffect(() => {
    if (!note || !canEditContent) return;
    const noteTitle = note.title ?? '';
    const noteContent = note.content ?? '';
    const noteId = note.id!;
    const hasChanges = title !== noteTitle || content !== noteContent;
    setIsDirty(hasChanges);

    if (hasChanges) {
      writeLocalDraft(noteId, title, content);
    }
  }, [canEditContent, content, note, title]);

  // Autosave Draft
  useEffect(() => {
    if (!canEditContent || !note || isHydratingFromServerRef.current) return;
    const noteId = note.id!;
    const noteTitle = note.title ?? '';
    const noteContent = note.content ?? '';

    if (noteId !== loadedNoteIdRef.current) return;

    const hasChanges = title !== noteTitle || content !== noteContent;
    if (!hasChanges) return;

    // Keep the synchronous draft updated on every autosave tick as well.
    writeLocalDraft(noteId, title, content);

    const timeoutId = window.setTimeout(() => {
      if (noteId === loadedNoteIdRef.current) {
        void saveNoteDraft(noteId, title, content);
      }
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [canEditContent, content, note, title]);

  // Autosave Server
  useEffect(() => {
    if (!canEditContent || !note || isHydratingFromServerRef.current) return;
    const noteId = note.id!;
    const noteTitle = note.title ?? '';
    const noteContent = note.content ?? '';
    if (noteId !== loadedNoteIdRef.current) return;

    const hasChanges = title !== noteTitle || content !== noteContent;
    if (!hasChanges) return;

    const timeoutId = window.setTimeout(async () => {
      if (noteId !== loadedNoteIdRef.current) return;
      try {
        setSaveError(null);
        const updated = await updateNote({ title, content });
        if (noteId === loadedNoteIdRef.current) {
          setLastSavedAt(updated.updatedAt ?? new Date().toISOString());
          setIsDirty(false);
          await clearNoteDraft(noteId);
          clearLocalDraft(noteId);
        }
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : 'Failed to save note');
      }
    }, 2000);

    return () => window.clearTimeout(timeoutId);
  }, [canEditContent, content, note, title, updateNote]);

  // Ensure localStorage contains latest draft on page unload (synchronous)
  useEffect(() => {
    if (!note || !canEditContent) return;
    const noteId = note.id!;

    const onBeforeUnload = () => {
      writeLocalDraft(noteId, title, content);
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [canEditContent, content, note, title]);

  return {
    title, setTitle,
    content, setContent,
    isDirty,
    lastSavedAt,
    saveError,
    isHydratingFromServer: isHydratingFromServerRef,
  };
}
