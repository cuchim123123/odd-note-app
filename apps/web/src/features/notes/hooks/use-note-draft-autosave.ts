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
  const isInitializingRef = useRef(true);

  // Sync server updates for the CURRENT note (e.g. from other tabs)
  useEffect(() => {
    if (isDirty || isRemoteUpdateRef.current || isInitializingRef.current) return;
    
    if (note.title !== title) setTitle(note.title || '');
    if (normalizeNoteHtml(note.content) !== normalizeNoteHtml(content)) {
      setContent(note.content || '');
    }
    setLastSavedAt(note.updatedAt || null);
  }, [note.title, note.content, note.updatedAt]);

  // Reset state variables immediately when switching notes to avoid cross-note pollution
  useEffect(() => {
    isInitializingRef.current = true;
    setIsDirty(false);
    setSaveError(null);
    setTitle(note.title || '');
    setContent(note.content || '');
    setLastSavedAt(note.updatedAt || null);
  }, [noteId]);

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
    if (!note || !canEditContent || isCollaborativeNote) {
      isInitializingRef.current = false;
      return;
    }
    let canceled = false;

    const loadDraft = async () => {
      try {
        // 1. Try to read emergency synchronous recovery backup first (in case of page crashes / sudden reloads)
        let backupDraft: { title: string; content: string; updatedAt: string } | null = null;
        try {
          const rawBackup = localStorage.getItem(`note-draft-backup:${note.id}`);
          if (rawBackup) {
            backupDraft = JSON.parse(rawBackup);
            // Immediate cleanup to prevent stale draft pollution on next load
            localStorage.removeItem(`note-draft-backup:${note.id}`);
          }
        } catch {
          // Ignore backup parsing failures
        }

        // 2. Fall back to standard asynchronous IndexedDB draft store
        const localDraft = await readLocalDraft(note.id!);
        if (canceled) return;

        const primaryDraft = backupDraft || localDraft;

        if (primaryDraft) {
          const draftEmpty = !primaryDraft.title.trim() && !primaryDraft.content.trim();
          const noteEmpty = !note.title?.trim() && !note.content?.trim();
          if (!(draftEmpty && !noteEmpty)) {
            const draftTime = safeTimestamp(primaryDraft.updatedAt);
            const noteTime = safeTimestamp(note.updatedAt);
            if (draftTime >= noteTime) {
              setTitle(primaryDraft.title);
              setContent(primaryDraft.content);
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
      } finally {
        if (!canceled) {
          // Brief timeout to ensure state updates flush before enabling auto-save
          setTimeout(() => {
            if (!canceled) {
              isInitializingRef.current = false;
            }
          }, 50);
        }
      }
    };

    void loadDraft();
    return () => { canceled = true; };
  }, [note?.id, canEditContent, unlockToken, isCollaborativeNote]);

  // HIGH-PERFORMANCE DEBOUNCED AUTOSAVE: Debounce IndexedDB to 150ms and API/Server to 1000ms
  useEffect(() => {
    if (!canEditContent || isInitializingRef.current) return;

    const normalized = normalizeNoteHtml(content);
    const changed = (normalized !== normalizeNoteHtml(note.content || ''));

    if (!changed) {
      setIsDirty(false);
      return;
    }

    // For collaborative notes (Yjs), we do NOT track dirty state, nor do we save to IndexedDB.
    // Yjs handles persistence and offline sync natively.
    if (isCollaborativeNote) {
      if (serverTimeoutRef.current) clearTimeout(serverTimeoutRef.current);
      serverTimeoutRef.current = setTimeout(() => {
        setLastSavedAt(new Date().toISOString());
      }, 300);
      return; // Exit early! No dirty tracking or manual drafting.
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

    serverTimeoutRef.current = setTimeout(async () => {
      const optTime = new Date().toISOString();
      setLastSavedAt(optTime);
      setSaveError(null);
      setIsSavingLocal(true);
      try {
        const upd = (await updateNote({ content: normalized })) as { updatedAt?: string } | null | undefined;
        setLastSavedAt(upd?.updatedAt || optTime);
        setIsDirty(false);
        await clearNoteDraft(note.id!, unlockToken).catch(() => {
          console.warn('Failed to clear remote draft');
        });
        await clearLocalDraft(note.id!);
        try {
          localStorage.removeItem(`note-draft-backup:${note.id}`);
        } catch {
          // Ignore storage cleanup errors
        }
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

    return () => {
      if (draftTimeoutRef.current) clearTimeout(draftTimeoutRef.current);
      clearTimeout(apiDraftTimer);
      if (serverTimeoutRef.current) clearTimeout(serverTimeoutRef.current);
    };
  }, [content, note, title, updateNote, isCollaborativeNote, canEditContent, unlockToken]);

  // Unload Event prompt listener: intercept reloads if active unsaved keystrokes remain
  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      const warningText = 'Are you sure you want to leave? Changes you made may not be saved.';
      e.returnValue = warningText; // Truthy string is strictly required by modern Chrome/Firefox to trigger the alert!
      return warningText;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);

  // Page Exit Sync: guaranteed synchronous localStorage dump & async IndexedDB flush on exit
  useEffect(() => {
    if (!note || !canEditContent || isCollaborativeNote) return;

    const flushLocalDraft = () => {
      // Best effort async IndexedDB flush
      void writeLocalDraft(note.id!, title, content);

      // Bulletproof synchronous emergency dump to prevent microtask termination on exit
      try {
        localStorage.setItem(`note-draft-backup:${note.id}`, JSON.stringify({
          title,
          content,
          updatedAt: new Date().toISOString(),
        }));
      } catch {
        // Ignore quota limits in private browsers
      }
    };

    window.addEventListener('beforeunload', flushLocalDraft);
    window.addEventListener('pagehide', flushLocalDraft);

    return () => {
      window.removeEventListener('beforeunload', flushLocalDraft);
      window.removeEventListener('pagehide', flushLocalDraft);
    };
  }, [note?.id, canEditContent, title, content, isCollaborativeNote]);

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
    
    // Always update React state to ensure it doesn't go stale when Yjs syncs.
    // NoteEditor's useEffect correctly ignores prop changes when collaborative=true, 
    // so this will not destroy cursor position.
    if (d.content !== undefined) {
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
