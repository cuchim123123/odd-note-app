import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { Doc as YDoc } from 'yjs';
import {
  useNote,
  useNoteShares,
  useCreateNoteShare,
  useUpdateNoteShare,
  useDeleteNoteShare,
  useUpdateNote,
  useDeleteNote,
  getNoteProtectionStatus,
  removeNotePassword,
  getNoteDraft,
  saveNoteDraft,
  clearNoteDraft,
  setNotePassword,
  verifyNotePassword,
  NOTES_KEYS,
} from '../api/notes.api';
import type { Note } from '@odd-note-app/validation';
import { NoteList } from './note-list';
import { NoteEditor } from './note-editor';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { ChevronLeft, Grid2x2, List, Trash2, Check, Loader2, AlertTriangle, Pin, ImagePlus, Lock, Users, Share2, X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { appendImageToContent } from '../utils/attachments';
import { api } from '../../../lib/axios';
import { useNoteProtectionStore } from '../stores/note-protection.store';
import { useYjsCollaboration } from '../hooks/useYjsCollaboration';

type ViewMode = 'grid' | 'list';

function normalizeNoteHtml(value: string | undefined): string {
  const html = (value ?? '').trim();
  if (!html) return '';
  if (/^(<p>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>)+$/i.test(html)) return '';
  return html;
}

function getYDocDebugId(yDoc?: YDoc | null): string {
  const debugDoc = yDoc as YDoc & { guid?: string | number; clientID?: string | number };
  return String(debugDoc?.guid ?? debugDoc?.clientID ?? 'unknown');
}

export function NoteDashboard() {
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [mobileView, setMobileView] = useState<'list' | 'editor'>('list');
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') {
      return true;
    }
    return window.matchMedia('(min-width: 1024px)').matches;
  });
  const navigate = useNavigate();
  const params = useParams();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const handleChange = (event: MediaQueryListEvent) => {
      setIsDesktop(event.matches);
    };

    setIsDesktop(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  useEffect(() => {
    const routeNoteId = params.noteId ?? null;
    if (routeNoteId && routeNoteId !== selectedNoteId) {
      setSelectedNoteId(routeNoteId);
      setMobileView('editor');
      return;
    }
    if (!routeNoteId && selectedNoteId !== null) {
      setSelectedNoteId(null);
      setMobileView('list');
    }
  }, [params.noteId, selectedNoteId]);

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Your notes</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Switch between grid and list views, search instantly, and open any note to edit it.
          </p>
        </div>
        <div className="hidden items-center gap-2 rounded-full border bg-background p-1 shadow-sm sm:flex">
          <Button type="button" variant={viewMode === 'grid' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('grid')} className="rounded-full">
            <Grid2x2 className="mr-2 h-4 w-4" />
            Grid
          </Button>
          <Button type="button" variant={viewMode === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('list')} className="rounded-full">
            <List className="mr-2 h-4 w-4" />
            List
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-full border bg-background p-1 shadow-sm sm:hidden">
        <Button type="button" variant={mobileView === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => setMobileView('list')} className="flex-1 rounded-full">
          Notes
        </Button>
        <Button type="button" variant={mobileView === 'editor' ? 'default' : 'ghost'} size="sm" onClick={() => setMobileView('editor')} className="flex-1 rounded-full" disabled={!selectedNoteId}>
          Editor
        </Button>
      </div>

      {isDesktop ? (
        <div className="min-h-0 flex-1 overflow-hidden rounded-xl border bg-card shadow-sm">
          {selectedNoteId ? (
            <div className="relative flex h-full flex-1 flex-col overflow-hidden bg-background">
              <div className="border-b border-border/70 bg-white px-4 py-3">
                <Button type="button" variant="outline" className="rounded-full" onClick={() => navigate('/notes')}>
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Back to notes
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <NoteDetailView noteId={selectedNoteId} onDeleted={() => { setSelectedNoteId(null); navigate('/notes'); }} />
              </div>
            </div>
          ) : (
            <div className="w-full">
              <NoteList selectedNoteId={selectedNoteId} onSelectNote={(id) => { navigate(`/notes/${id}`); setSelectedNoteId(id); setMobileView('editor'); }} viewMode={viewMode} />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {mobileView === 'list' || !selectedNoteId ? (
            <div className="max-h-[calc(100dvh-16rem)] overflow-hidden rounded-xl border bg-card shadow-sm">
              <NoteList selectedNoteId={selectedNoteId} onSelectNote={(id) => { navigate(`/notes/${id}`); setSelectedNoteId(id); setMobileView('editor'); }} viewMode={viewMode} />
            </div>
          ) : null}
          {selectedNoteId && mobileView === 'editor' ? (
            <div className="space-y-3">
              <Button type="button" variant="outline" className="w-full rounded-full" onClick={() => navigate('/notes')}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back to notes
              </Button>
              <NoteDetailView noteId={selectedNoteId} onDeleted={() => { setSelectedNoteId(null); navigate('/notes'); }} />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function NoteDetailView({ noteId, onDeleted }: { noteId: string; onDeleted: () => void }) {
  const queryClient = useQueryClient();
  const { data: note, isLoading } = useNote(noteId);
  // Only fetch shares if this note is owned by the current user
  const isOwnedNote = !note?.accessMode || note.accessMode === 'owner';
  const { data: shares } = useNoteShares(isOwnedNote ? noteId : null);
  const updateMutation = useUpdateNote(noteId);
  const { mutateAsync: updateNote, isPending: isSaving } = updateMutation;
  const deleteMutation = useDeleteNote(noteId);
  const createShareMutation = useCreateNoteShare(noteId);
  const updateShareMutation = useUpdateNoteShare(noteId);
  const deleteShareMutation = useDeleteNoteShare(noteId);

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
  const [protectionPassword, setProtectionPassword] = useState('');
  const [confirmProtectionPassword, setConfirmProtectionPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [protectionMessage, setProtectionMessage] = useState<string | null>(null);
  const [serverProtectionStatus, setServerProtectionStatus] = useState<boolean | null>(null);
  const [shareRecipientEmail, setShareRecipientEmail] = useState('');
  const [sharePermission, setSharePermission] = useState<'READ' | 'EDIT'>('READ');
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [remoteCursors, setRemoteCursors] = useState<Array<{ userId: string; displayName: string; color: string; position: number }>>([]);
  const isRemoteUpdateRef = useRef(false);

  // Initialize from note data
  useEffect(() => {
    if (!note) return;
    setTitle(note.title || '');
    setContent(note.content || '');
    setIsDirty(false);
    setLastSavedAt(note.updatedAt || null);
    setSaveError(null);
    setServerProtectionStatus(note.isProtected ?? null);
  }, [note?.id, note?.title, note?.content, note?.updatedAt, note?.isProtected]);

  // Sync protection status
  useEffect(() => {
    if (!note) return;
    let isCancelled = false;
    const sync = async () => {
      try {
        const result = await getNoteProtectionStatus(noteId);
        if (isCancelled) return;
        setServerProtectionStatus(result.isProtected);
        if (!result.isProtected) markLocked(noteId);
      } catch {
        if (!isCancelled) setServerProtectionStatus(note?.isProtected ?? null);
      }
    };
    void sync();
    return () => { isCancelled = true; };
  }, [note?.id, noteId, markLocked, note?.isProtected]);

  // Load draft
  useEffect(() => {
    if (!note) return;
    let isCancelled = false;
    const load = async () => {
      try {
        const draft = await getNoteDraft(note.id);
        if (!draft || isCancelled) return;
        const draftEmpty = !draft.title.trim() && !draft.content.trim();
        const noteEmpty = !note.title.trim() && !note.content?.trim();
        if (draftEmpty && !noteEmpty) return;
        const draftTime = new Date(draft.updatedAt).getTime();
        const noteTime = new Date(note.updatedAt || '').getTime();
        if (draftTime >= noteTime) {
          setTitle(draft.title);
          setContent(draft.content);
        }
      } catch {
        // ignore
      }
    };
    void load();
    return () => { isCancelled = true; };
  }, [note?.id]);

  const isSharedNote = note && 'accessMode' in note && note.accessMode === 'shared';
  const sharedPermission = note && 'sharedPermission' in note ? note.sharedPermission : undefined;
  const sharedBy = note && 'sharedBy' in note ? note.sharedBy : undefined;
  const canEditContent = !isSharedNote || sharedPermission === 'EDIT';
  const canManageShares = !isSharedNote;
  const isCollaborativeNote = (isSharedNote && sharedPermission === 'EDIT') || (note?.isShared && canManageShares);
  const canAutosave = !!note && !isLoading && canEditContent && !isCollaborativeNote;

  // Unified autosave
  useEffect(() => {
    if (!canAutosave || !note) return;

    const normalizedContent = normalizeNoteHtml(content);
    const hasChanges = title !== note.title || normalizedContent !== normalizeNoteHtml(note.content || '');

    if (!hasChanges) {
      setIsDirty(false);
      return;
    }

    setIsDirty(true);
    setSaveError(null);

    const draftTimeoutId = window.setTimeout(() => {
      void saveNoteDraft(note.id, title, normalizedContent);
    }, 500);

    const serverTimeoutId = window.setTimeout(async () => {
      // Optimistic: show saved immediately
      const optimisticTime = new Date().toISOString();
      setLastSavedAt(optimisticTime);
      setIsDirty(false);

      try {
        const updated = await updateNote({ title, content: normalizedContent });
        setLastSavedAt(updated.updatedAt || optimisticTime);
        await clearNoteDraft(note.id);
      } catch (error) {
        // Keep optimistic "Saved" status on error; draft already persisted
        const msg = error instanceof Error ? error.message : 'Failed to save';
        if (!msg.toLowerCase().includes('offline') && !msg.toLowerCase().includes('network')) {
          setSaveError(msg);
        }
      }
    }, 900);

    return () => {
      window.clearTimeout(draftTimeoutId);
      window.clearTimeout(serverTimeoutId);
    };
  }, [canAutosave, content, note, title, updateNote]);

  const handleRemoteContentUpdate = useCallback((data: { userId: string; content: string; title?: string; isPinned?: boolean; isProtected?: boolean; timestamp?: number | string }) => {
    isRemoteUpdateRef.current = true;
    if (data.title !== undefined) setTitle(data.title);
    if (data.isProtected !== undefined) setServerProtectionStatus(data.isProtected);
    if (data.isPinned !== undefined && noteId && note) {
      const updatedAt = new Date().toISOString();
      queryClient.setQueryData<Note[]>(NOTES_KEYS.all, (ns = []) =>
        ns.map((n) => n.id === noteId ? { ...n, isPinned: data.isPinned ?? n.isPinned, updatedAt } : n),
      );
      queryClient.setQueryData<Note>(NOTES_KEYS.detail(noteId), (n) =>
        n ? { ...n, isPinned: data.isPinned ?? n.isPinned, updatedAt } : n,
      );
    }
    setContent(data.content);
    const ts = data.timestamp ? new Date(data.timestamp).toISOString() : new Date().toISOString();
    setLastSavedAt(ts);
    setIsDirty(false);
    setSaveError(null);
    requestAnimationFrame(() => { isRemoteUpdateRef.current = false; });
  }, [noteId, note, queryClient]);

  const handleRemoteCursor = useCallback((data: { userId: string; displayName: string; position: number; color: string }) => {
    setRemoteCursors((c) => {
      const filtered = c.filter((x) => x.userId !== data.userId);
      const existing = c.find((x) => x.userId === data.userId);
      if (existing && existing.position === data.position && existing.displayName === data.displayName && existing.color === data.color) return c;
      return [...filtered, data];
    });
  }, []);

  const { collaborators, presenceParticipants, isConnected: isWsConnected, sendContentUpdate, sendCursorPosition, yDoc } = useYjsCollaboration({
    noteId: isCollaborativeNote ? noteId : null,
    enabled: Boolean(isCollaborativeNote),
    onRemoteContentUpdate: handleRemoteContentUpdate,
    onRemoteCursor: handleRemoteCursor,
  });

  const presenceCount = collaborators.length > 0 ? collaborators.length : presenceParticipants.length;
  const realtimeLabel = isCollaborativeNote
    ? (isWsConnected ? presenceCount > 0 ? `Watching · ${presenceCount}` : 'Realtime · Connected' : 'Realtime · Offline')
    : 'Realtime · Off';
  const realtimeTone = isCollaborativeNote && isWsConnected ? 'text-emerald-600' : 'text-muted-foreground';

  useEffect(() => {
    if (!isCollaborativeNote) setRemoteCursors([]);
  }, [isCollaborativeNote]);

  const saveStatus = useMemo(() => {
    if (saveError) return { icon: AlertTriangle, label: saveError, tone: 'text-destructive' as const };
    if (isSaving) return { icon: Loader2, label: 'Autosaving…', tone: 'text-muted-foreground' as const };
    if (isDirty) return { icon: Loader2, label: 'Pending changes…', tone: 'text-muted-foreground' as const };
    return { icon: Check, label: lastSavedAt ? `Saved ${new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Saved', tone: 'text-emerald-600' as const };
  }, [isDirty, isSaving, lastSavedAt, saveError]);

  const broadcastNoteState = useCallback((nextState: { isPinned?: boolean; isProtected?: boolean } = {}) => {
    if (!isCollaborativeNote) return;
    sendContentUpdate(undefined, title, nextState);
  }, [isCollaborativeNote, sendContentUpdate, title]);

  const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

  const handleAttachImages = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEditContent) { event.target.value = ''; return; }
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    for (const file of files) {
      const dataUrl = await readFileAsDataUrl(file);
      setContent((c) => appendImageToContent(c, dataUrl, file.name));
      (async () => {
        try {
          const form = new FormData();
          form.append('file', file, file.name);
          const resp = await api.post('/uploads', form, { headers: { 'Content-Type': 'multipart/form-data' } });
          const serverUrl = resp.data?.signedUrl ?? resp.data?.url;
          if (serverUrl) setContent((c) => c.split(dataUrl).join(serverUrl));
        } catch {
          // ignore
        }
      })();
    }
    event.target.value = '';
  };

  if (isLoading || !note) return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading…</div>;

  const isProtected = serverProtectionStatus ?? note.isProtected;
  if (isProtected && !isUnlocked) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="w-full max-w-md rounded-xl border bg-background p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-full bg-muted p-3 text-muted-foreground">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">This note is protected</h2>
              <p className="text-sm text-muted-foreground">Enter password to view.</p>
            </div>
          </div>
          <div className="space-y-3">
            <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Password" />
            {protectionMessage ? <p className="text-sm text-destructive">{protectionMessage}</p> : null}
            <div className="flex gap-2">
              <Button type="button" className="flex-1" onClick={async () => {
                try {
                  const r = await verifyNotePassword(noteId, currentPassword.trim());
                  if (!r.verified) { setProtectionMessage('Wrong password.'); return; }
                  markUnlocked(noteId);
                  setCurrentPassword('');
                } catch {
                  setProtectionMessage('Wrong password.');
                }
              }}>Unlock</Button>
              <Button type="button" variant="outline" onClick={() => setCurrentPassword('')}>Clear</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-border/70 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.06)]">
      <div className="border-b border-border/70 bg-gradient-to-r from-slate-50 to-white px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <Input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (note) {
                  const updatedAt = new Date().toISOString();
                  queryClient.setQueryData<Note[]>(NOTES_KEYS.all, (ns = []) =>
                    ns.map((n) => n.id === note.id ? { ...n, title: e.target.value, updatedAt } : n),
                  );
                  queryClient.setQueryData(NOTES_KEYS.detail(note.id), (n) =>
                    n ? { ...n, title: e.target.value, updatedAt } : n,
                  );
                }
                sendContentUpdate(undefined, e.target.value);
              }}
              className="h-auto border-border/60 bg-white px-4 py-3 text-2xl font-semibold shadow-sm focus-visible:border-primary"
              placeholder="Note title…"
              readOnly={!canEditContent}
            />
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {(() => { const I = saveStatus.icon; return <I className={cn('h-3.5 w-3.5', saveStatus.tone, isSaving && 'animate-spin')} />; })()}
              <span className={cn('font-medium', saveStatus.tone)}>{saveStatus.label}</span>
              <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-medium shadow-sm', realtimeTone === 'text-emerald-600' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-border/70 bg-background text-muted-foreground')}>
                <span className={cn('h-1.5 w-1.5 rounded-full', isCollaborativeNote && isWsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/40')} />
                {realtimeLabel}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {note.isPinned && <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 shadow-sm"><Pin className="h-3 w-3" />Pinned</span>}
              {isProtected && <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-700 shadow-sm"><Lock className="h-3 w-3" />Protected</span>}
              {isSharedNote && <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-700 shadow-sm"><Share2 className="h-3 w-3" />{sharedPermission === 'EDIT' ? 'Editable' : 'Read-only'}</span>}
            </div>
            {isSharedNote && <div className="rounded-2xl border border-border/70 bg-slate-50 px-4 py-3 text-sm text-muted-foreground shadow-sm">Shared by <span className="font-medium text-foreground">{sharedBy?.displayName}</span></div>}
          </div>

          <div className="flex items-center gap-2 self-start">
            {canManageShares && <Button type="button" size="sm" variant="outline" onClick={() => setShareModalOpen(true)} disabled={isSaving}><Share2 className="mr-2 h-4 w-4" />Share</Button>}
            <input ref={imageInputRef} type="file" accept="image/*" multiple onChange={handleAttachImages} className="hidden" />
            <Button size="sm" variant="ghost" onClick={() => imageInputRef.current?.click()} disabled={isSaving || !canEditContent}><ImagePlus className="w-4 h-4" /></Button>
            <Button size="sm" variant="ghost" onClick={() => setProtectionMode((m) => m === 'protect' || m === 'remove' ? 'idle' : isProtected ? 'remove' : 'protect')} disabled={isSaving || !canEditContent || isSharedNote}><Lock className="w-4 h-4" /></Button>
            <Button size="sm" variant="ghost" onClick={async () => {
              try {
                const updated = await updateNote({ isPinned: !note.isPinned });
                broadcastNoteState({ isPinned: updated.isPinned });
              } catch { /* ignore */ }
            }} disabled={isSaving || !canEditContent || isSharedNote}><Pin className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => setDeleteConfirmOpen(true)} disabled={deleteMutation.isPending || !canEditContent || isSharedNote}><Trash2 className="w-4 h-4" /></Button>
          </div>
        </div>
      </div>

      {deleteConfirmOpen && (
        <div className="border-b border-border/70 bg-slate-50 px-4 py-4 sm:px-6">
          <div className="rounded-2xl border border-destructive/20 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-destructive">Delete this note?</h3>
            <p className="mt-1 text-sm text-muted-foreground">This cannot be undone.</p>
            <div className="mt-4 flex gap-2">
              <Button type="button" variant="destructive" onClick={async () => { await deleteMutation.mutateAsync(); setDeleteConfirmOpen(false); onDeleted(); }} disabled={deleteMutation.isPending}>Delete</Button>
              <Button type="button" variant="outline" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {protectionMode !== 'idle' && (
        <div className="border-b border-border/70 bg-slate-50 px-4 py-4 sm:px-6">
          {protectionMode === 'protect' && (
            <div className="space-y-3 rounded-2xl border border-border/70 bg-white p-5 shadow-sm">
              <div>
                <h3 className="font-semibold">Protect this note</h3>
                <p className="text-sm text-muted-foreground">Set a password to lock it.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input type="password" placeholder="Password" value={protectionPassword} onChange={(e) => setProtectionPassword(e.target.value)} />
                <Input type="password" placeholder="Confirm" value={confirmProtectionPassword} onChange={(e) => setConfirmProtectionPassword(e.target.value)} />
              </div>
              {protectionMessage && <p className="text-sm text-destructive">{protectionMessage}</p>}
              <div className="flex gap-2">
                <Button type="button" onClick={async () => {
                  const pw = protectionPassword.trim();
                  const cpw = confirmProtectionPassword.trim();
                  if (!pw) { setProtectionMessage('Enter password.'); return; }
                  if (pw !== cpw) { setProtectionMessage('Passwords do not match.'); return; }
                  try {
                    await setNotePassword(noteId, pw);
                    const updated = await updateNote({ isProtected: true });
                    markUnlocked(noteId);
                    setServerProtectionStatus(true);
                    setProtectionMode('idle');
                    setProtectionPassword('');
                    setConfirmProtectionPassword('');
                    broadcastNoteState({ isProtected: updated.isProtected ?? true });
                  } catch {
                    setProtectionMessage('Failed to protect.');
                  }
                }}>Protect</Button>
                <Button type="button" variant="outline" onClick={() => { setProtectionMode('idle'); setProtectionMessage(null); }}>Cancel</Button>
              </div>
            </div>
          )}
          {protectionMode === 'remove' && (
            <div className="space-y-3 rounded-2xl border border-border/70 bg-white p-5 shadow-sm">
              <div>
                <h3 className="font-semibold">Remove protection</h3>
                <p className="text-sm text-muted-foreground">Enter current password.</p>
              </div>
              <Input type="password" placeholder="Password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
              {protectionMessage && <p className="text-sm text-destructive">{protectionMessage}</p>}
              <div className="flex gap-2">
                <Button type="button" onClick={async () => {
                  try {
                    await removeNotePassword(noteId, currentPassword.trim());
                    const updated = await updateNote({ isProtected: false });
                    markLocked(noteId);
                    setServerProtectionStatus(false);
                    setProtectionMode('idle');
                    setCurrentPassword('');
                    broadcastNoteState({ isProtected: updated.isProtected ?? false });
                  } catch {
                    setProtectionMessage('Wrong password.');
                  }
                }}>Remove</Button>
                <Button type="button" variant="outline" onClick={() => { setProtectionMode('idle'); setProtectionMessage(null); }}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {canManageShares && shareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={() => setShareModalOpen(false)} />
          <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-3xl border border-border/70 bg-white shadow-[0_30px_100px_rgba(15,23,42,0.18)]">
            <div className="flex items-start justify-between gap-4 border-b border-border/70 bg-gradient-to-r from-slate-50 to-white px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold">Share this note</h3>
                <p className="text-sm text-muted-foreground">Grant read or edit access.</p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setShareModalOpen(false)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="max-h-[75vh] space-y-5 overflow-y-auto p-5">
              <div className="grid gap-3 sm:grid-cols-[1fr_10rem_auto]">
                <Input type="email" placeholder="Email" value={shareRecipientEmail} onChange={(e) => setShareRecipientEmail(e.target.value)} />
                <select className="h-11 rounded-xl border border-input bg-background px-3 text-sm" value={sharePermission} onChange={(e) => setSharePermission(e.target.value as 'READ' | 'EDIT')}>
                  <option value="READ">Read only</option>
                  <option value="EDIT">Can edit</option>
                </select>
                <Button type="button" onClick={async () => {
                  const email = shareRecipientEmail.trim();
                  if (!email) { setShareMessage('Enter email.'); return; }
                  try {
                    setShareMessage(null);
                    await createShareMutation.mutateAsync({ recipientEmail: email, permission: sharePermission });
                    await queryClient.invalidateQueries({ queryKey: NOTES_KEYS.shares(noteId) });
                    setShareRecipientEmail('');
                    setSharePermission('READ');
                    setShareMessage('Shared!');
                  } catch (error) {
                    setShareMessage(error instanceof Error ? error.message : 'Failed.');
                  }
                }} disabled={createShareMutation.isPending}>Share</Button>
              </div>
              {shareMessage && <p className="text-sm text-muted-foreground">{shareMessage}</p>}
              <div>
                <div className="text-sm font-medium mb-2">Shares</div>
                {(shares ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No shares yet.</p>
                ) : (
                  <div className="space-y-2">
                    {shares?.map((share) => (
                      <div key={share.id} className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="truncate font-medium">{share.recipientEmail}</div>
                          <div className="text-xs text-muted-foreground">{share.permission === 'EDIT' ? 'Can edit' : 'Read only'}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <select className="h-10 rounded-xl border border-input bg-background px-3 text-sm" value={share.permission} onChange={(e) => (async () => {
                            try {
                              await updateShareMutation.mutateAsync({ shareId: share.id, input: { permission: e.target.value as 'READ' | 'EDIT' } });
                              await queryClient.invalidateQueries({ queryKey: NOTES_KEYS.shares(noteId) });
                            } catch (err) {
                              setShareMessage(err instanceof Error ? err.message : 'Failed.');
                            }
                          })()} disabled={updateShareMutation.isPending}>
                            <option value="READ">Read only</option>
                            <option value="EDIT">Can edit</option>
                          </select>
                          <Button type="button" variant="outline" onClick={async () => {
                            try {
                              await deleteShareMutation.mutateAsync(share.id);
                              await queryClient.invalidateQueries({ queryKey: NOTES_KEYS.shares(noteId) });
                            } catch (err) {
                              setShareMessage(err instanceof Error ? err.message : 'Failed.');
                            }
                          }} disabled={deleteShareMutation.isPending}>Remove</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-50 to-white p-4 sm:p-8">
        <div className="mx-auto max-w-4xl">
          {isCollaborativeNote && (isWsConnected || collaborators.length > 0 || presenceParticipants.length > 0) && (
            <div className="mb-4 flex items-center gap-2 rounded-full border border-border/70 bg-white px-3 py-2 shadow-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Viewing:</span>
              <div className="flex -space-x-2">
                {(collaborators.length > 0 ? collaborators : presenceParticipants).map((p) => (
                  <div key={p.userId} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white shadow-sm" style={{ backgroundColor: p.color }} title={p.displayName}>
                    {p.displayName.charAt(0).toUpperCase()}
                  </div>
                ))}
              </div>
              {isWsConnected && (
                <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
              )}
            </div>
          )}
          <NoteEditor
            key={yDoc ? `y-${getYDocDebugId(yDoc)}` : `no-y-${noteId ?? 'none'}`}
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
