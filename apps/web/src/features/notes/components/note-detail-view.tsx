import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useNote,
  useUpdateNote,
  useDeleteNote,
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
import { Button } from '../../../components/ui/button';
import { useNoteProtectionStore } from '../stores/note-protection.store';
import { useYjsCollaboration } from '../hooks/useYjsCollaboration';

function normalizeNoteHtml(value: string | undefined): string {
  const html = (value ?? '').trim();
  if (!html) return '';
  if (/^(<p>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>)+$/i.test(html)) return '';
  return html;
}

export function NoteDetailView({ noteId, onDeleted }: { noteId: string; onDeleted: () => void }) {
  const queryClient = useQueryClient();
  const { data: note, isLoading } = useNote(noteId);
  const updateMutation = useUpdateNote(noteId);
  const { mutateAsync: updateNote, isPending: isSaving } = updateMutation;
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
  const [protectionMode, setProtectionMode] = useState<'idle' | 'protect' | 'remove'>('idle');
  const [serverProtectionStatus, setServerProtectionStatus] = useState<boolean | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [remoteCursors, setRemoteCursors] = useState<Array<{ userId: string; displayName: string; color: string; position: number }>>([]);
  const isRemoteUpdateRef = useRef(false);

  // Initialize from note
  useEffect(() => {
    if (!note) return;
    setTitle(note.title || '');
    setContent(note.content || '');
    setIsDirty(false);
    setLastSavedAt(note.updatedAt || null);
    setSaveError(null);
    setServerProtectionStatus(note.isProtected ?? null);
  }, [note?.id]);

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

  // Load draft
  useEffect(() => {
    if (!note) return;
    let canceled = false;
    getNoteDraft(note.id)
      .then((d) => {
        if (!d || canceled) return;
        const draftEmpty = !d.title.trim() && !d.content.trim();
        const noteEmpty = !note.title?.trim() && !note.content?.trim();
        if (draftEmpty && !noteEmpty) return;
        const draftTime = new Date(d.updatedAt).getTime();
        const noteTime = new Date(note.updatedAt || '').getTime();
        if (draftTime >= noteTime) {
          setTitle(d.title);
          setContent(d.content);
        }
      })
      .catch(() => {});
    return () => { canceled = true; };
  }, [note?.id]);

  const isSharedNote = note && 'accessMode' in note && note.accessMode === 'shared';
  const sharedPermission = (note && 'sharedPermission' in note) ? note.sharedPermission : undefined;
  const canEditContent = !isSharedNote || sharedPermission === 'EDIT';
  const canManageShares = !isSharedNote;
  const isCollaborativeNote = (isSharedNote && sharedPermission === 'EDIT') || (note?.isShared && canManageShares);
  const canAutosave = !!note && !isLoading && canEditContent && !isCollaborativeNote;

  // UNIFIED AUTOSAVE
  useEffect(() => {
    if (!canAutosave || !note) return;

    const normalized = normalizeNoteHtml(content);
    const changed = title !== note.title || normalized !== normalizeNoteHtml(note.content || '');

    if (!changed) {
      setIsDirty(false);
      return;
    }

    setIsDirty(true);
    setSaveError(null);

    const draftId = window.setTimeout(() => {
      void saveNoteDraft(note.id, title, normalized);
    }, 500);

    const serverId = window.setTimeout(async () => {
      const optTime = new Date().toISOString();
      setLastSavedAt(optTime);
      setIsDirty(false);

      try {
        const upd = await updateNote({ title, content: normalized });
        setLastSavedAt(upd.updatedAt || optTime);
        await clearNoteDraft(note.id);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed';
        if (!msg.toLowerCase().includes('offline') && !msg.toLowerCase().includes('network')) {
          setSaveError(msg);
        }
      }
    }, 900);

    return () => {
      window.clearTimeout(draftId);
      window.clearTimeout(serverId);
    };
  }, [canAutosave, content, note, title, updateNote]);

  const handleRemoteContentUpdate = useCallback((d: { userId: string; content: string; title?: string; isPinned?: boolean; isProtected?: boolean; timestamp?: string | number }) => {
    isRemoteUpdateRef.current = true;
    if (d.title !== undefined) setTitle(d.title);
    if (d.isProtected !== undefined) setServerProtectionStatus(d.isProtected);
    if (d.isPinned !== undefined && noteId && note) {
      const ut = new Date().toISOString();
      queryClient.setQueryData<Note[]>(NOTES_KEYS.all, (ns = []) =>
        ns.map((n) => n.id === noteId ? { ...n, isPinned: d.isPinned ?? n.isPinned, updatedAt: ut } : n),
      );
      queryClient.setQueryData<Note>(NOTES_KEYS.detail(noteId), (n) =>
        n ? { ...n, isPinned: d.isPinned ?? n.isPinned, updatedAt: ut } : n,
      );
    }
    setContent(d.content);
    const ts = d.timestamp ? new Date(d.timestamp).toISOString() : new Date().toISOString();
    setLastSavedAt(ts);
    setIsDirty(false);
    setSaveError(null);
    requestAnimationFrame(() => { isRemoteUpdateRef.current = false; });
  }, [noteId, note, queryClient]);

  const handleRemoteCursor = useCallback((d: { userId: string; displayName: string; position: number; color: string }) => {
    setRemoteCursors((c) => {
      const filt = c.filter((x) => x.userId !== d.userId);
      const ex = c.find((x) => x.userId === d.userId);
      if (ex && ex.position === d.position && ex.displayName === d.displayName && ex.color === d.color) return c;
      return [...filt, d];
    });
  }, []);

  const { collaborators, presenceParticipants, isConnected: isWsConnected, sendContentUpdate, sendCursorPosition, yDoc } = useYjsCollaboration({
    noteId: isCollaborativeNote ? noteId : null,
    enabled: Boolean(isCollaborativeNote),
    onRemoteContentUpdate: handleRemoteContentUpdate,
    onRemoteCursor: handleRemoteCursor,
  });

  useEffect(() => {
    if (!isCollaborativeNote) setRemoteCursors([]);
  }, [isCollaborativeNote]);

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

  const broadcast = (s: { isPinned?: boolean; isProtected?: boolean } = {}) => {
    if (!isCollaborativeNote) return;
    sendContentUpdate(undefined, title, s);
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    if (note) {
      const ut = new Date().toISOString();
      queryClient.setQueryData<Note[]>(NOTES_KEYS.all, (ns = []) =>
        ns.map((n) => n.id === note.id ? { ...n, title: newTitle, updatedAt: ut } : n),
      );
      queryClient.setQueryData(NOTES_KEYS.detail(note.id), (n) =>
        n ? { ...n, title: newTitle, updatedAt: ut } : n,
      );
    }
    sendContentUpdate(undefined, newTitle);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-border/70 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.06)]">
      <NoteToolbar
        note={note}
        title={title}
        onTitleChange={handleTitleChange}
        isDirty={isDirty}
        isSaving={isSaving}
        lastSavedAt={lastSavedAt}
        saveError={saveError}
        isCollaborativeNote={isCollaborativeNote}
        isWsConnected={isWsConnected}
        collaborators={collaborators}
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
      />

      {deleteConfirmOpen && (
        <div className="border-b border-border/70 bg-slate-50 px-4 py-4 sm:px-6">
          <div className="rounded-2xl border border-destructive/20 bg-white p-5 shadow-sm">
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
          noteId={noteId}
          onClose={() => setShareModalOpen(false)}
        />
      )}

      <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-50 to-white p-4 sm:p-8">
        <div className="mx-auto max-w-4xl">
          <NoteEditor
            content={content}
            readOnly={!canEditContent}
            onInsertImage={() => imageInputRef.current?.click()}
            syncKey={note?.id ?? noteId}
            collaborative={Boolean(isCollaborativeNote)}
            remoteCursors={remoteCursors}
            yDoc={yDoc ?? undefined}
            {...(canEditContent ? {
              onChange: (c: string) => {
                setContent(c);
                if (!isRemoteUpdateRef.current && isCollaborativeNote) {
                  try { 
                    sendContentUpdate(c);
                  } catch {
                    // Handle error silently
                  }
                }
              },
              onCursorMove: (pos: number) => {
                if (isCollaborativeNote) sendCursorPosition(pos);
              },
            } : {})}
          />
        </div>
      </div>
    </div>
  );
}
