import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { Doc as YDoc } from 'yjs';
import {
  useNote,
  useUpdateNote,
  useDeleteNote,
  useNoteShares,
  useCreateNoteShare,
  getNoteProtectionStatus,
  getNoteDraft,
  saveNoteDraft,
  clearNoteDraft,
  NOTES_KEYS,
} from '../api/notes.api';
import type { Note } from '@odd-note-app/validation';
import { NoteEditor } from './note-editor';
import { NoteToolbar } from './note-toolbar';
import { ProtectionPanel, ProtectionUnlockPrompt } from './protection-panel';
import { SharingModal } from './sharing-modal';
import { LabelManagementModal } from './label-management-modal';
import { Button } from '../../../components/ui/button';
import { useNoteProtectionStore } from '../stores/note-protection.store';
import { useYjsCollaboration } from '../hooks/useYjsCollaboration';
import { ProtectedNoteRoute, type ProtectedNote } from './protected-note-route';
import { normalizeNoteHtml, safeTimestamp } from '../utils/note-html';
import { clearLocalDraft, readLocalDraft, writeLocalDraft } from '../utils/note-draft.storage';

function getYDocDebugId(yDoc?: YDoc | null): string {
  const debugDoc = yDoc as YDoc & { guid?: string | number; clientID?: string | number };
  return String(debugDoc?.guid ?? debugDoc?.clientID ?? 'unknown');
}

export function NoteDetailView({ noteId, onDeleted }: { noteId: string; onDeleted: () => void }) {
  const queryClient = useQueryClient();
  const { data: note, isLoading } = useNote(noteId);
  const navigate = useNavigate();
  
  // Robust permission checks
  const isOwnedNote = Boolean(note && (!note.accessMode || note.accessMode === 'owner'));
  const isSharedNote = Boolean(note?.isShared || (note && 'accessMode' in note && note.accessMode === 'shared'));
  const sharedPermission = (note && 'sharedPermission' in note) ? (note as NoteDetailItem).sharedPermission : undefined;
  
  // Owners can always edit; recipients need EDIT permission
  const canEditContent = isOwnedNote || sharedPermission === 'EDIT';
  const canManageShares = isOwnedNote;
  const isCollaborativeNote = Boolean(isSharedNote && canEditContent);

  const { data: shares = [] } = useNoteShares(isOwnedNote ? noteId : null);
  const updateMutation = useUpdateNote(noteId);
  const { mutateAsync: updateNote, isPending: isSaving } = updateMutation;
  const createShareMutation = useCreateNoteShare(noteId);
  const deleteMutation = useDeleteNote(noteId);

  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const isUnlocked = useNoteProtectionStore((state) => state.isUnlocked(noteId));
  const markUnlocked = useNoteProtectionStore((state) => state.markUnlocked);
  const markLocked = useNoteProtectionStore((state) => state.markLocked);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSavingLocal, setIsSavingLocal] = useState(false);
  const [protectionMode, setProtectionMode] = useState<'idle' | 'protect' | 'remove'>('idle');
  const [serverProtectionStatus, setServerProtectionStatus] = useState<boolean | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [labelManagementOpen, setLabelManagementOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const isRemoteUpdateRef = useRef(false);
  const draftTimeoutRef = useRef<NodeJS.Timeout>();
  const serverTimeoutRef = useRef<NodeJS.Timeout>();

  // 1. Reset state completely when switching to a DIFFERENT note
  useEffect(() => {
    if (!note) return;
    
    // Completely reset local state for the new note
    setTitle(note.title || '');
    setContent(note.content || '');
    setIsDirty(false);
    setLastSavedAt(note.updatedAt || null);
    setSaveError(null);
    setServerProtectionStatus(note.isProtected ?? null);
    
    // Clear any pending timeouts from the previous note
    if (draftTimeoutRef.current) clearTimeout(draftTimeoutRef.current);
    if (serverTimeoutRef.current) clearTimeout(serverTimeoutRef.current);
  }, [note?.id]);

  // 2. Sync server updates for the CURRENT note (e.g. from other tabs)
  // Only sync if we are NOT dirty and NOT currently applying a remote update
  useEffect(() => {
    if (!note || isDirty || isRemoteUpdateRef.current) return;
    
    // Sync title/content if they changed on server while we were idle
    if (note.title !== title) setTitle(note.title || '');
    if (normalizeNoteHtml(note.content) !== normalizeNoteHtml(content)) {
      setContent(note.content || '');
    }
    setLastSavedAt(note.updatedAt || null);
  }, [note?.title, note?.content, note?.updatedAt]);

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
    const localDraft = readLocalDraft(note.id!);
    if (localDraft) {
      const draftEmpty = !localDraft.title.trim() && !localDraft.content.trim();
      const noteEmpty = !note.title?.trim() && !note.content?.trim();
      if (!(draftEmpty && !noteEmpty)) {
        const draftTime = safeTimestamp(localDraft.updatedAt);
        const noteTime = safeTimestamp(note.updatedAt);
        if (draftTime >= noteTime) {
          setTitle(localDraft.title);
          setContent(localDraft.content);
          return () => { canceled = true; };
        }
      }
    }

    getNoteDraft(note.id!)
      .then((d) => {
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
      })
      .catch(() => {});
    return () => { canceled = true; };
  }, [note?.id, canEditContent]);


  // AGGRESSIVE AUTOSAVE: Always save immediately to IndexedDB, then to server
  useEffect(() => {
    if (!note || isLoading || !canEditContent) return;

    const normalized = normalizeNoteHtml(content);
    const changed = title !== note.title || normalized !== normalizeNoteHtml(note.content || '');

    if (!changed) {
      setIsDirty(false);
      return;
    }

    // Set dirty immediately
    setIsDirty(true);
    setSaveError(null);

    // SAVE DRAFT TO INDEXEDDB IMMEDIATELY (no delay!)
    writeLocalDraft(note.id!, title, normalized);

    void saveNoteDraft(note.id!, title, normalized).catch(() => {
      console.warn('Draft save failed');
    });

    // Clear previous timeouts
    if (draftTimeoutRef.current) clearTimeout(draftTimeoutRef.current);
    if (serverTimeoutRef.current) clearTimeout(serverTimeoutRef.current);

    if (isCollaborativeNote) {
      // Collaborative content is synced via Yjs updates from the editor.
      // Do not send full-content `note:update` payloads here because that can
      // reset selection/cursor positions on all clients.
      serverTimeoutRef.current = setTimeout(() => {
        setLastSavedAt(new Date().toISOString());
      }, 300);
    } else {
      // For solo notes: save to server immediately with optimistic UI
      serverTimeoutRef.current = setTimeout(async () => {
        const optTime = new Date().toISOString();
        setLastSavedAt(optTime);
        setSaveError(null);
        setIsSavingLocal(true);

        try {
          const upd = await updateNote({ title, content: normalized });
          setLastSavedAt(upd.updatedAt || optTime);
          setIsDirty(false);
          // Only clear draft if server save succeeds
          await clearNoteDraft(note.id!).catch(() => {
            console.warn('Failed to clear draft');
          });
          clearLocalDraft(note.id!);
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Failed';
          // Only show error if it's not a network error (those are expected when offline)
          if (!msg.toLowerCase().includes('offline') && !msg.toLowerCase().includes('network') && !msg.toLowerCase().includes('connect')) {
            setSaveError(msg);
          }
          // Keep draft in IndexedDB on any error - user can recover on reload
          console.warn('Server save failed, draft preserved:', msg);
        } finally {
          setIsSavingLocal(false);
        }
      }, 300);
    }

    return () => {
      if (draftTimeoutRef.current) clearTimeout(draftTimeoutRef.current);
      if (serverTimeoutRef.current) clearTimeout(serverTimeoutRef.current);
    };
  }, [content, note, title, updateNote, isCollaborativeNote, isLoading, canEditContent]);

  useEffect(() => {
    if (!note || !canEditContent) return;

    const flushLocalDraft = () => {
      writeLocalDraft(note.id!, title, content);
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
    if (d.title !== undefined) setTitle(d.title);
    if (d.isProtected !== undefined) setServerProtectionStatus(d.isProtected);
    if (d.labels !== undefined && noteId) {
      const ut = new Date().toISOString();
      queryClient.setQueryData<Note[]>(NOTES_KEYS.all, (ns = []) =>
        ns.map((n) => n.id === noteId ? { ...n, labels: d.labels ?? n.labels, updatedAt: ut } as Note : n),
      );
      queryClient.setQueryData<Note>(NOTES_KEYS.detail(noteId), (n) =>
        n ? ({ ...n, labels: d.labels ?? n.labels, updatedAt: ut } as Note) : n,
      );
    }
    if (d.isPinned !== undefined && noteId && note) {
      const ut = new Date().toISOString();
      queryClient.setQueryData<Note[]>(NOTES_KEYS.all, (ns = []) =>
        ns.map((n) => n.id === noteId ? { ...n, isPinned: d.isPinned ?? n.isPinned, updatedAt: ut } as Note : n),
      );
      queryClient.setQueryData<Note>(NOTES_KEYS.detail(noteId!), (n) =>
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

  const { presenceParticipants, isConnected: isWsConnected, sendContentUpdate, yDoc } = useYjsCollaboration({
    noteId: isCollaborativeNote ? noteId : null,
    enabled: Boolean(isCollaborativeNote),
    onRemoteContentUpdate: handleRemoteContentUpdate,
  });

  if (isLoading || !note) return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading…</div>;

  const isProtected = serverProtectionStatus ?? note.isProtected;
  if (isProtected && !isUnlocked) {
    return (
      <ProtectionUnlockPrompt
        noteId={noteId}
        onUnlock={() => markUnlocked(noteId)}
      />
    );
  }

  const broadcast = (s: { isPinned?: boolean | undefined; isProtected?: boolean | undefined; labels?: string[] | undefined } = {}) => {
    if (!isCollaborativeNote) return;
    sendContentUpdate(undefined, title, s);
  };

  const handleToggleLabel = async (label: string) => {
    if (!note || !canEditContent) return;
    const currentLabels = note.labels || [];
    const nextLabels = currentLabels.includes(label)
      ? currentLabels.filter((l) => l !== label)
      : [...currentLabels, label];
    
    try {
      const updated = await updateNote({ labels: nextLabels });
      broadcast({ labels: updated.labels });
    } catch {
      // Silently fail
    }
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    writeLocalDraft(note.id!, newTitle, content);
    if (note) {
      const ut = new Date().toISOString();
      queryClient.setQueryData<Note[]>(NOTES_KEYS.all, (ns = []) =>
        ns.map((n) => n.id === note.id ? { ...n, title: newTitle, updatedAt: ut } : n),
      );
      queryClient.setQueryData(NOTES_KEYS.detail(note.id!), (n) =>
        n ? { ...n, title: newTitle, updatedAt: ut } : n,
      );
    }
    sendContentUpdate(undefined, newTitle);
  };

  const onUnauthorized = () => navigate('/notes');

  return (
    <ProtectedNoteRoute note={note as ProtectedNote | null} isLoading={isLoading} onUnauthorized={onUnauthorized}>
      <div className="flex h-full flex-col overflow-hidden rounded-3xl border bg-card shadow-[0_24px_80px_rgba(15,23,42,0.12)] dark:shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
      <NoteToolbar
        note={note}
        title={title}
        onTitleChange={handleTitleChange}
        isDirty={isDirty}
        isSaving={isSavingLocal || isSaving}
        lastSavedAt={lastSavedAt}
        saveError={saveError}
        isCollaborativeNote={isCollaborativeNote}
        isWsConnected={isWsConnected}
        presenceParticipants={presenceParticipants}
        canEditContent={canEditContent}
        canManageShares={canManageShares}
        imageInputRef={imageInputRef}
        onOpenSharing={() => setShareModalOpen(true)}
        onOpenProtection={(mode) => setProtectionMode(mode)}
        onPin={async () => {
          try {
            const u = await updateNote({ isPinned: !note.isPinned });
            broadcast({ isPinned: u.isPinned ?? true });
          } catch {
            // Handle error silently
          }
        }}
        onDelete={() => setDeleteConfirmOpen(true)}
        isSharedNote={isSharedNote}
        onToggleLabel={handleToggleLabel}
        onOpenLabelManagement={() => setLabelManagementOpen(true)}
      />

      {deleteConfirmOpen && (
        <div className="border-b bg-muted/30 px-4 py-4 sm:px-6">
          <div className="rounded-2xl border border-destructive/20 bg-card p-5 shadow-sm">
            <h3 className="font-semibold text-destructive">Delete?</h3>
            <p className="mt-1 text-sm text-muted-foreground">Cannot undo.</p>
            <div className="mt-4 flex gap-2">
              <Button type="button" variant="destructive" onClick={async () => { await deleteMutation.mutateAsync(); setDeleteConfirmOpen(false); onDeleted(); }} disabled={deleteMutation.isPending}>Delete</Button>
              <Button type="button" variant="outline" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {protectionMode !== 'idle' && (
        <ProtectionPanel
          noteId={noteId}
          mode={protectionMode}
          onClose={() => setProtectionMode('idle')}
          onProtected={() => {
            setServerProtectionStatus(true);
            broadcast({ isProtected: true });
          }}
          onUnprotected={() => {
            setServerProtectionStatus(false);
            broadcast({ isProtected: false });
          }}
          onUnlock={() => markUnlocked(noteId)}
          onLock={() => markLocked(noteId)}
        />
      )}

      {canManageShares && shareModalOpen && (
        <SharingModal
          isOpen={shareModalOpen}
          noteId={noteId}
          shares={shares ?? []}
          onShare={async (email, permission) => {
            await createShareMutation.mutateAsync({ recipientEmail: email, permission });
            setShareModalOpen(false);
          }}
          onClose={() => setShareModalOpen(false)}
        />
      )}

      {labelManagementOpen && (
        <LabelManagementModal
          isOpen={labelManagementOpen}
          onClose={() => setLabelManagementOpen(false)}
        />
      )}

      <div className="flex-1 overflow-y-auto bg-gradient-to-b from-muted/20 to-card p-4 sm:p-8">
        <div className="mx-auto max-w-4xl">
          <NoteEditor
            key={yDoc ? `y-${getYDocDebugId(yDoc)}` : `no-y-${noteId ?? 'none'}`}
            content={content}
            readOnly={!canEditContent}
            onInsertImage={() => imageInputRef.current?.click()}
            syncKey={note?.id ?? noteId}
            collaborative={Boolean(isCollaborativeNote)}
            yDoc={yDoc ?? undefined}
            isOwner={isOwnedNote}
            {...(canEditContent ? {
              onChange: (c: string) => {
                setContent(c);
                writeLocalDraft(note.id!, title, c);
              },
            } : {})}
          />
        </div>
      </div>
      </div>
    </ProtectedNoteRoute>
  );
}
