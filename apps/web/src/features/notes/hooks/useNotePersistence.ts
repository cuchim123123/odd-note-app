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

  // Sync local state when note changes
  useEffect(() => {
    if (note && loadedNoteIdRef.current !== note.id) {
      isHydratingFromServerRef.current = true;
      if (hydrationTimeoutRef.current) {
        window.clearTimeout(hydrationTimeoutRef.current);
      }
      loadedNoteIdRef.current = note.id;
      setTitle(note.title);
      setContent(note.content || '');
      setIsDirty(false);
      setLastSavedAt(note.updatedAt);
      setSaveError(null);

      hydrationTimeoutRef.current = window.setTimeout(() => {
        if (loadedNoteIdRef.current === note.id) {
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
        const draft = await getNoteDraft(note.id);
        if (!draft || isCancelled) return;

        const isDraftEmpty = draft.title.trim().length === 0 && draft.content.trim().length === 0;
        const isServerNoteEmpty = note.title.trim().length === 0 && (note.content || '').trim().length === 0;
        if (isDraftEmpty && !isServerNoteEmpty) return;

        const noteUpdatedAt = new Date(note.updatedAt).getTime();
        const draftUpdatedAt = new Date(draft.updatedAt).getTime();
        if (draftUpdatedAt >= noteUpdatedAt) {
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
    const hasChanges = title !== note.title || content !== (note.content || '');
    setIsDirty(hasChanges);
  }, [canEditContent, content, note, title]);

  // Autosave Draft
  useEffect(() => {
    if (!canEditContent || !note || isHydratingFromServerRef.current) return;
    if (note.id !== loadedNoteIdRef.current) return;

    const hasChanges = title !== note.title || content !== (note.content || '');
    if (!hasChanges) return;

    const timeoutId = window.setTimeout(() => {
      if (note.id === loadedNoteIdRef.current) {
        void saveNoteDraft(note.id, title, content);
      }
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [canEditContent, content, note, title]);

  // Autosave Server
  useEffect(() => {
    if (!canEditContent || !note || isHydratingFromServerRef.current) return;
    if (note.id !== loadedNoteIdRef.current) return;

    const hasChanges = title !== note.title || content !== (note.content || '');
    if (!hasChanges) return;

    const timeoutId = window.setTimeout(async () => {
      if (note.id !== loadedNoteIdRef.current) return;
      try {
        setSaveError(null);
        const updated = await updateNote({ title, content });
        if (note.id === loadedNoteIdRef.current) {
          setLastSavedAt(updated.updatedAt);
          setIsDirty(false);
          await clearNoteDraft(note.id);
        }
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : 'Failed to save note');
      }
    }, 2000);

    return () => window.clearTimeout(timeoutId);
  }, [canEditContent, content, note, title, updateNote]);

  return {
    title, setTitle,
    content, setContent,
    isDirty,
    lastSavedAt,
    saveError,
    isHydratingFromServer: isHydratingFromServerRef,
  };
}
