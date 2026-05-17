import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Note } from '@odd-note-app/validation';
import { useNoteProtectionStore } from '../stores/note-protection.store';
import {
  getNoteProtectionStatus,
  getNoteDraft,
  saveNoteDraft,
  clearNoteDraft,
  NOTES_KEYS,
  type NoteDetailItem,
} from '../api/notes.api';
import { normalizeNoteHtml, safeTimestamp } from '../utils/note-html';
import { clearLocalDraft, readLocalDraft, writeLocalDraft } from '../utils/note-draft.storage';

type UseNoteDraftAndAutoSaveProps = {
  noteId: string;
  note: NoteDetailItem;
  canEditContent: boolean;
  isCollaborativeNote: boolean;
  updateNote: (data: Partial<Note>) => Promise<unknown>;
  markLocked: (noteId: string) => void;
};

export function useNoteDraftAndAutoSave({
  noteId,
  note,
  canEditContent,
  isCollaborativeNote,
  updateNote,
  markLocked,
}: UseNoteDraftAndAutoSaveProps) {
  const queryClient = useQueryClient();
  const unlockToken = useNoteProtectionStore((s) => noteId ? s.unlockTokens[noteId] : undefined);

  const [title, setTitle] = useState(note.title || '');
  const [content, setContent] = useState(note.content || '');
  const [isDirty, setIsDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(note.updatedAt || null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSavingLocal, setIsSavingLocal] = useState(false);
  const [serverProtectionStatus, setServerProtectionStatus] = useState<boolean | null>(note.isProtected ?? null);

  const isRemoteUpdateRef = useRef(false);
  const draftTimeoutRef = useRef<NodeJS.Timeout>();
  const serverTimeoutRef = useRef<NodeJS.Timeout>();

  // Sync server updates for the CURRENT note (e.g. from other tabs)
  useEffect(() => {
    if (isDirty || isRemoteUpdateRef.current) return;
    
    if (note.title !== title) setTitle(note.title || '');
    if (normalizeNoteHtml(note.content) !== normalizeNoteHtml(content)) {
      setContent(note.content || '');
    }
    setLastSavedAt(note.updatedAt || null);
  }, [note.title, note.content, note.updatedAt]);

  // Relock note when navigating away or unmounting (ensure E2E prompt on next enter)
  useEffect(() => {
    return () => {
      markLocked(noteId);
    };
  }, [noteId, markLocked]);

  // Sync protection status
  useEffect(() => {
    if (!note) return;
    let canceled = false;
    getNoteProtectionStatus(noteId)
      .then((r) => {
        if (!canceled) {
          setServerProtectionStatus(r.isProtected);
          if (!r.isProtected) markLocked(noteId);
        }
      })
      .catch(() => {
        if (!canceled) setServerProtectionStatus(note.isProtected ?? null);
      });
    return () => { canceled = true; };
  }, [note?.id, noteId, markLocked, note?.isProtected]);

  // Load draft - only if we have permission to edit
  useEffect(() => {
    if (!note || !canEditContent) return;
    let canceled = false;

    const loadDraft = async () => {
      const localDraft = await readLocalDraft(note.id!);
      if (canceled) return;

      if (localDraft) {
        const draftEmpty = !localDraft.title.trim() && !localDraft.content.trim();
        const noteEmpty = !note.title?.trim() && !note.content?.trim();
        if (!(draftEmpty && !noteEmpty)) {
          const draftTime = safeTimestamp(localDraft.updatedAt);
          const noteTime = safeTimestamp(note.updatedAt);
          if (draftTime >= noteTime) {
            setTitle(localDraft.title);
            setContent(localDraft.content);
            return;
          }
        }
      }

      try {
        const d = await getNoteDraft(note.id!, unlockToken);
        if (!d || canceled) return;
        const draftEmpty = !d.title.trim() && !d.content.trim();
        const noteEmpty = !note.title?.trim() && !note.content?.trim();
        if (draftEmpty && !noteEmpty) return;
        const draftTime = safeTimestamp(d.updatedAt);
        const noteTime = safeTimestamp(note.updatedAt);
        if (draftTime >= noteTime) {
          setTitle(d.title);
          setContent(d.content);
        }
      } catch {
        // Ignore loading errors.
      }
    };

    void loadDraft();
    return () => { canceled = true; };
  }, [note?.id, canEditContent, unlockToken]);

  // HIGH-PERFORMANCE DEBOUNCED AUTOSAVE: Debounce IndexedDB to 150ms and API/Server to 1000ms
  useEffect(() => {
    if (!canEditContent) return;

    const normalized = normalizeNoteHtml(content);
    const changed = (normalized !== normalizeNoteHtml(note.content || '')) || (title !== (note.title || ''));

    if (!changed) {
      setIsDirty(false);
      return;
    }

    setIsDirty(true);
    setSaveError(null);

    // 1. Debounce async IndexedDB local write (150ms) to ensure frictionless typing
    if (draftTimeoutRef.current) clearTimeout(draftTimeoutRef.current);
    draftTimeoutRef.current = setTimeout(async () => {
      await writeLocalDraft(note.id!, title, normalized);
    }, 150);

    // 2. Debounce remote API draft save (1000ms) to prevent server connection flooding
    const apiDraftTimer = setTimeout(async () => {
      try {
        await saveNoteDraft(note.id!, title, normalized, unlockToken);
      } catch {
        console.warn('Draft API save failed');
      }
    }, 1000);

    // 3. Debounce full note server save
    if (serverTimeoutRef.current) clearTimeout(serverTimeoutRef.current);

    if (isCollaborativeNote) {
      serverTimeoutRef.current = setTimeout(() => {
        setLastSavedAt(new Date().toISOString());
      }, 300);
    } else {
      serverTimeoutRef.current = setTimeout(async () => {
        const optTime = new Date().toISOString();
        setLastSavedAt(optTime);
        setSaveError(null);
        setIsSavingLocal(true);
        try {
          const upd = (await updateNote({ title, content: normalized })) as { updatedAt?: string } | null | undefined;
          setLastSavedAt(upd?.updatedAt || optTime);
          setIsDirty(false);
          await clearNoteDraft(note.id!, unlockToken).catch(() => {
            console.warn('Failed to clear remote draft');
          });
          await clearLocalDraft(note.id!);
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Failed';
          if (!msg.toLowerCase().includes('offline') && !msg.toLowerCase().includes('network') && !msg.toLowerCase().includes('connect')) {
            setSaveError(msg);
          }
          console.warn('Server save failed, draft preserved:', msg);
        } finally {
          setIsSavingLocal(false);
        }
      }, 1000); // 1000ms server save debounce
    }

    return () => {
      if (draftTimeoutRef.current) clearTimeout(draftTimeoutRef.current);
      clearTimeout(apiDraftTimer);
      if (serverTimeoutRef.current) clearTimeout(serverTimeoutRef.current);
    };
  }, [content, note, title, updateNote, isCollaborativeNote, canEditContent, unlockToken]);

  useEffect(() => {
    if (!note || !canEditContent) return;

    const flushLocalDraft = () => {
      void writeLocalDraft(note.id!, title, content);
    };

    window.addEventListener('beforeunload', flushLocalDraft);
    window.addEventListener('pagehide', flushLocalDraft);

    return () => {
      window.removeEventListener('beforeunload', flushLocalDraft);
      window.removeEventListener('pagehide', flushLocalDraft);
    };
  }, [note?.id, canEditContent, title, content]);

  const handleRemoteContentUpdate = useCallback((d: { userId: string; content: string; title?: string | undefined; isPinned?: boolean | undefined; isProtected?: boolean | undefined; labels?: string[] | undefined; timestamp?: string | number }) => {
    isRemoteUpdateRef.current = true;
    if (d.title !== undefined && noteId) {
      setTitle(d.title);
      const ut = new Date().toISOString();
      queryClient.setQueryData<Note[]>(NOTES_KEYS.all, (ns = []) =>
        ns.map((n) => n.id === noteId ? { ...n, title: d.title, updatedAt: ut } as Note : n),
      );
      queryClient.setQueriesData<NoteDetailItem>({ queryKey: NOTES_KEYS.detail(noteId) }, (n) =>
        n ? ({ ...n, title: d.title, updatedAt: ut } as NoteDetailItem) : n,
      );
    }
    if (d.isProtected !== undefined) setServerProtectionStatus(d.isProtected);
    if (d.labels !== undefined && noteId) {
      const ut = new Date().toISOString();
      queryClient.setQueryData<Note[]>(NOTES_KEYS.all, (ns = []) =>
        ns.map((n) => n.id === noteId ? { ...n, labels: d.labels ?? n.labels, updatedAt: ut } as Note : n),
      );
      queryClient.setQueriesData<Note>({ queryKey: NOTES_KEYS.detail(noteId) }, (n) =>
        n ? ({ ...n, labels: d.labels ?? n.labels, updatedAt: ut } as Note) : n,
      );
    }
    if (d.isPinned !== undefined && noteId && note) {
      const ut = new Date().toISOString();
      queryClient.setQueryData<Note[]>(NOTES_KEYS.all, (ns = []) =>
        ns.map((n) => n.id === noteId ? { ...n, isPinned: d.isPinned ?? n.isPinned, updatedAt: ut } as Note : n),
      );
      queryClient.setQueriesData<Note>({ queryKey: NOTES_KEYS.detail(noteId!) }, (n) =>
        n ? ({ ...n, isPinned: (d.isPinned ?? n.isPinned) as boolean, updatedAt: ut } as Note) : n,
      );
    }
    if (!isCollaborativeNote) {
      setContent(d.content);
    }
    const ts = d.timestamp ? new Date(d.timestamp).toISOString() : new Date().toISOString();
    setLastSavedAt(ts);
    setIsDirty(false);
    setSaveError(null);
    requestAnimationFrame(() => { isRemoteUpdateRef.current = false; });
  }, [isCollaborativeNote, noteId, note, queryClient]);

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    void writeLocalDraft(note.id!, newTitle, content);
  };

  const handleSaveTitle = async (
    broadcast: (s: { title?: string; isPinned?: boolean; isProtected?: boolean; labels?: string[] }) => void,
  ) => {
    if (!note || title === note.title || !title.trim()) return;
    
    try {
      await updateNote({ title });
      broadcast({ title });
    } catch (e) {
      console.error('Failed to save title', e);
    }
  };

  return {
    title,
    setTitle,
    content,
    setContent,
    isDirty,
    setIsDirty,
    lastSavedAt,
    setLastSavedAt,
    saveError,
    setSaveError,
    isSavingLocal,
    serverProtectionStatus,
    setServerProtectionStatus,
    handleTitleChange,
    handleSaveTitle,
    handleRemoteContentUpdate,
  };
}
