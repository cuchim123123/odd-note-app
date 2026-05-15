import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
import { ChevronLeft, Grid2x2, List, Trash2, FileEdit, Check, Loader2, AlertTriangle, Pin, ImagePlus, Lock, Users, Share2, X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { appendImageToContent } from '../utils/attachments';
import { api } from '../../../lib/axios';
import { useNoteProtectionStore } from '../stores/note-protection.store';
import { useYjsCollaboration } from '../hooks/useYjsCollaboration';

type ViewMode = 'grid' | 'list';

export function NoteDashboard() {
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [mobileView, setMobileView] = useState<'list' | 'editor'>('list');

  const handleSelectNote = (id: string) => {
    setSelectedNoteId(id);
    setMobileView('editor');
  };

  const handleDeleteSelectedNote = () => {
    setSelectedNoteId(null);
    setMobileView('list');
  };

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
          <Button
            type="button"
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
            className="rounded-full"
          >
            <Grid2x2 className="mr-2 h-4 w-4" />
            Grid
          </Button>
          <Button
            type="button"
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
            className="rounded-full"
          >
            <List className="mr-2 h-4 w-4" />
            List
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-full border bg-background p-1 shadow-sm sm:hidden">
        <Button
          type="button"
          variant={mobileView === 'list' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setMobileView('list')}
          className="flex-1 rounded-full"
        >
          Notes
        </Button>
        <Button
          type="button"
          variant={mobileView === 'editor' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setMobileView('editor')}
          className="flex-1 rounded-full"
          disabled={!selectedNoteId}
        >
          Editor
        </Button>
      </div>

      <div className="hidden min-h-0 flex-1 overflow-hidden rounded-xl border bg-card shadow-sm lg:flex">
        <div className="w-full shrink-0 border-r lg:w-[22rem]">
          <NoteList selectedNoteId={selectedNoteId} onSelectNote={handleSelectNote} viewMode={viewMode} />
        </div>

        <div className="relative flex-1 overflow-hidden bg-background">
          {selectedNoteId ? (
            <NoteDetailView noteId={selectedNoteId} onDeleted={handleDeleteSelectedNote} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center text-muted-foreground">
              <div className="mb-4 rounded-full bg-muted/30 p-6">
                <FileEdit className="h-10 w-10 text-muted-foreground/50" />
              </div>
              <p className="max-w-sm">Select a note from the sidebar or create a new one.</p>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3 lg:hidden">
        {mobileView === 'list' || !selectedNoteId ? (
          <div className="max-h-[calc(100dvh-16rem)] overflow-hidden rounded-xl border bg-card shadow-sm">
            <NoteList selectedNoteId={selectedNoteId} onSelectNote={handleSelectNote} viewMode={viewMode} />
          </div>
        ) : null}

        {selectedNoteId && mobileView === 'editor' ? (
          <div className="space-y-3">
            <Button type="button" variant="outline" className="w-full rounded-full" onClick={() => setMobileView('list')}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back to notes
            </Button>
            <NoteDetailView noteId={selectedNoteId} onDeleted={handleDeleteSelectedNote} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function NoteDetailView({ noteId, onDeleted }: { noteId: string; onDeleted: () => void }) {
  const queryClient = useQueryClient();
  const { data: note, isLoading } = useNote(noteId);
  const { data: shares } = useNoteShares(noteId);
  const updateMutation = useUpdateNote(noteId);
  const { mutateAsync: updateNote, isPending: isSaving } = updateMutation;
  const deleteMutation = useDeleteNote(noteId);
  const createShareMutation = useCreateNoteShare(noteId);
  const updateShareMutation = useUpdateNoteShare(noteId);
  const deleteShareMutation = useDeleteNoteShare(noteId);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const loadedNoteIdRef = useRef<string | null>(null);
  const isHydratingFromServerRef = useRef(false);
  const hydrationTimeoutRef = useRef<number | null>(null);
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
  const typingStopTimerRef = useRef<number | null>(null);
  /** Track whether the last content change came from a remote collaborator (skip re-broadcast) */
  const isRemoteUpdateRef = useRef(false);

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
      setProtectionMode('idle');
      setProtectionPassword('');
      setConfirmProtectionPassword('');
      setCurrentPassword('');
      setProtectionMessage(null);
      setServerProtectionStatus(null);
      setShareRecipientEmail('');
      setSharePermission('READ');
      setShareMessage(null);
      setShareModalOpen(false);

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

  useEffect(() => {
    if (!note) {
      return;
    }

    let isCancelled = false;

    const syncProtectionStatus = async () => {
      try {
        const result = await getNoteProtectionStatus(noteId);
        if (isCancelled) {
          return;
        }

        setServerProtectionStatus(result.isProtected);
        if (!result.isProtected) {
          markLocked(noteId);
        }

        if (result.isProtected !== note.isProtected) {
          await updateNote({ isProtected: result.isProtected });
        }
      } catch {
        if (!isCancelled) {
          setServerProtectionStatus(note.isProtected);
        }
      }
    };

    void syncProtectionStatus();

    return () => {
      isCancelled = true;
    };
  }, [markLocked, note, noteId, updateNote]);

  const noteAccessMode = note && 'accessMode' in note ? note.accessMode : 'owner';
  const sharedPermission = note && 'sharedPermission' in note ? note.sharedPermission : undefined;
  const sharedBy = note && 'sharedBy' in note ? note.sharedBy : undefined;
  const isSharedNote = noteAccessMode === 'shared';
  const canEditContent = !isSharedNote || sharedPermission === 'EDIT';
  const canManageShares = noteAccessMode === 'owner';

  useEffect(() => {
    if (!note || !canEditContent) {
      return;
    }

    let isCancelled = false;

    const loadDraft = async () => {
      try {
        const draft = await getNoteDraft(note.id);
        if (!draft || isCancelled) {
          return;
        }

        const isDraftEmpty = draft.title.trim().length === 0 && draft.content.trim().length === 0;
        const isServerNoteEmpty = note.title.trim().length === 0 && (note.content || '').trim().length === 0;
        if (isDraftEmpty && !isServerNoteEmpty) {
          return;
        }

        const noteUpdatedAt = new Date(note.updatedAt).getTime();
        const draftUpdatedAt = new Date(draft.updatedAt).getTime();
        if (draftUpdatedAt >= noteUpdatedAt) {
          setTitle(draft.title);
          setContent(draft.content);
        }
      } catch {
        // ignore draft read failures
      }
    };

    void loadDraft();

    return () => {
      isCancelled = true;
    };
  }, [canEditContent, note]);

  const canAutosave = !!note && !isLoading && canEditContent;

  // Real-time collaboration: connect when this is a shared EDIT note
  const isCollaborativeNote = (isSharedNote && sharedPermission === 'EDIT') || (note?.isShared && canManageShares);

  const handleRemoteContentUpdate = useCallback(
    (data: { userId: string; content: string; title?: string; isPinned?: boolean; isProtected?: boolean }) => {
      isRemoteUpdateRef.current = true;
      if (data.title !== undefined) {
        setTitle(data.title);
      }

      if (data.isProtected !== undefined) {
        setServerProtectionStatus(data.isProtected);
      }

      if (data.isPinned !== undefined && noteId) {
        const updatedAt = new Date().toISOString();
        queryClient.setQueryData<Note[]>(NOTES_KEYS.all, (currentNotes = []) =>
          currentNotes.map((currentNote) =>
            currentNote.id === noteId
              ? { ...currentNote, isPinned: data.isPinned ?? currentNote.isPinned, updatedAt }
              : currentNote,
          ),
        );
        queryClient.setQueryData<Note>(NOTES_KEYS.detail(noteId), (currentNote) =>
          currentNote ? { ...currentNote, isPinned: data.isPinned ?? currentNote.isPinned, updatedAt } : currentNote,
        );
      }

      setContent(data.content);
      // Let the flag reset after the next render cycle so the onChange handler
      // doesn't re-broadcast this change.
      requestAnimationFrame(() => {
        isRemoteUpdateRef.current = false;
      });
    },
    [],
  );

  const handleRemoteCursor = useCallback((data: { userId: string; displayName: string; position: number; color: string }) => {
    setRemoteCursors((current) => {
      const filtered = current.filter((cursor) => cursor.userId !== data.userId);
      const existing = current.find((cursor) => cursor.userId === data.userId);
      if (
        existing &&
        existing.position === data.position &&
        existing.displayName === data.displayName &&
        existing.color === data.color
      ) {
        return current;
      }

      return [...filtered, data];
    });
  }, []);

  const { collaborators, presenceParticipants, typingParticipants, isConnected: isWsConnected, sendContentUpdate, sendCursorPosition, sendTypingState, yDoc } = useYjsCollaboration({
    noteId: isCollaborativeNote ? noteId : null,
    enabled: Boolean(isCollaborativeNote),
    onRemoteContentUpdate: handleRemoteContentUpdate,
    onRemoteCursor: handleRemoteCursor,
  });

  const presenceCount = collaborators.length > 0 ? collaborators.length : presenceParticipants.length;
  const realtimeLabel = isCollaborativeNote
    ? (isWsConnected
      ? presenceCount > 0
        ? `Watching · ${presenceCount}`
        : 'Realtime · Connected'
      : 'Realtime · Offline')
    : 'Realtime · Off';
  const realtimeTone = isCollaborativeNote && isWsConnected ? 'text-emerald-600' : 'text-muted-foreground';

  const notifyTypingActivity = useCallback(() => {
    if (!isCollaborativeNote) {
      return;
    }

    sendTypingState(true);

    if (typingStopTimerRef.current) {
      window.clearTimeout(typingStopTimerRef.current);
    }

    typingStopTimerRef.current = window.setTimeout(() => {
      sendTypingState(false);
      typingStopTimerRef.current = null;
    }, 1200);
  }, [isCollaborativeNote, sendTypingState]);

  useEffect(() => {
    return () => {
      if (typingStopTimerRef.current) {
        window.clearTimeout(typingStopTimerRef.current);
      }
      if (isCollaborativeNote) {
        sendTypingState(false);
      }
    };
  }, [isCollaborativeNote, sendTypingState]);

  useEffect(() => {
    if (!isCollaborativeNote) {
      setRemoteCursors([]);
    }
  }, [isCollaborativeNote]);

  useEffect(() => {
    if (!canAutosave || !note) {
      return;
    }

    const hasChanges = title !== note.title || content !== (note.content || '');
    setIsDirty(hasChanges);
  }, [canAutosave, content, note, title]);

  useEffect(() => {
    if (!canAutosave || !note) {
      return;
    }

    if (isHydratingFromServerRef.current) {
      return;
    }

    const hasChanges = title !== note.title || content !== (note.content || '');
    if (!hasChanges) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void saveNoteDraft(note.id, title, content);
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [canAutosave, content, note, title]);

  useEffect(() => {
    if (!canAutosave || !note) {
      return;
    }

    if (isHydratingFromServerRef.current) {
      return;
    }

    const hasChanges = title !== note.title || content !== (note.content || '');
    if (!hasChanges) {
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        setSaveError(null);
        const updated = await updateNote({ title, content });
        setLastSavedAt(updated.updatedAt);
        setIsDirty(false);
        await clearNoteDraft(note.id);
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : 'Failed to save note');
      }
    }, 2000);

    return () => window.clearTimeout(timeoutId);
  }, [canAutosave, content, note, title, updateNote]);

  const saveStatus = useMemo(() => {
    if (saveError) {
      return { icon: AlertTriangle, label: saveError, tone: 'text-destructive' as const };
    }

    if (isSaving) {
      return { icon: Loader2, label: 'Autosaving…', tone: 'text-muted-foreground' as const };
    }

    if (isDirty) {
      return { icon: Loader2, label: 'Pending changes…', tone: 'text-muted-foreground' as const };
    }

    return { icon: Check, label: lastSavedAt ? `Saved ${new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Saved', tone: 'text-emerald-600' as const };
  }, [isDirty, isSaving, lastSavedAt, saveError]);

  const handleDelete = async () => {
    setDeleteConfirmOpen(true);
  };

  const broadcastNoteState = useCallback(
    (nextState: { isPinned?: boolean; isProtected?: boolean } = {}) => {
      if (!isCollaborativeNote) {
        return;
      }

      sendContentUpdate(undefined, title, nextState);
    },
    [content, isCollaborativeNote, sendContentUpdate, title],
  );

  const handleConfirmDelete = async () => {
    await deleteMutation.mutateAsync();
    setDeleteConfirmOpen(false);
    onDeleted();
  };

  const handleAddShare = async () => {
    const email = shareRecipientEmail.trim();

    if (!email) {
      setShareMessage('Enter a recipient email.');
      return;
    }

    try {
      setShareMessage(null);
      await createShareMutation.mutateAsync({ recipientEmail: email, permission: sharePermission });
      await queryClient.invalidateQueries({ queryKey: NOTES_KEYS.shares(noteId) });
      setShareRecipientEmail('');
      setSharePermission('READ');
      setShareMessage('Sharing updated.');
    } catch (error) {
      setShareMessage(error instanceof Error ? error.message : 'Failed to share note.');
    }
  };

  const handleChangeSharePermission = async (shareId: string, permission: 'READ' | 'EDIT') => {
    try {
      await updateShareMutation.mutateAsync({ shareId, input: { permission } });
      await queryClient.invalidateQueries({ queryKey: NOTES_KEYS.shares(noteId) });
      setShareMessage('Sharing updated.');
    } catch (error) {
      setShareMessage(error instanceof Error ? error.message : 'Failed to update sharing.');
    }
  };

  const handleRemoveShare = async (shareId: string) => {
    try {
      await deleteShareMutation.mutateAsync(shareId);
      await queryClient.invalidateQueries({ queryKey: NOTES_KEYS.shares(noteId) });
      setShareMessage('Share removed.');
    } catch (error) {
      setShareMessage(error instanceof Error ? error.message : 'Failed to remove share.');
    }
  };

  const handleEnableProtection = async () => {
    const normalizedPassword = protectionPassword.trim();

    if (!normalizedPassword) {
      setProtectionMessage('Enter a password.');
      return;
    }

    if (normalizedPassword !== confirmProtectionPassword.trim()) {
      setProtectionMessage('Passwords do not match.');
      return;
    }

    try {
      await setNotePassword(noteId, normalizedPassword);
      const updated = await updateNote({ isProtected: true });
      markUnlocked(noteId);
      setServerProtectionStatus(true);
      setProtectionMode('idle');
      setProtectionPassword('');
      setConfirmProtectionPassword('');
      setProtectionMessage('Protection enabled.');
      broadcastNoteState({ isProtected: updated.isProtected });
    } catch {
      setProtectionMessage('Failed to enable protection.');
    }
  };

  const handleDisableProtection = async () => {
    try {
      await removeNotePassword(noteId, currentPassword.trim());
      const updated = await updateNote({ isProtected: false });
      markLocked(noteId);
      setServerProtectionStatus(false);
      setProtectionMode('idle');
      setCurrentPassword('');
      setProtectionMessage('Protection removed.');
      broadcastNoteState({ isProtected: updated.isProtected });
    } catch {
      setProtectionMessage('Incorrect password.');
    }
  };

  const handleUnlockProtectedNote = async () => {
    try {
      const result = await verifyNotePassword(noteId, currentPassword.trim());
      if (!result.verified) {
        setProtectionMessage('Incorrect password.');
        return;
      }

      markUnlocked(noteId);
      setCurrentPassword('');
      setProtectionMessage(null);
    } catch {
      setProtectionMessage('Incorrect password.');
    }
  };

  const readFileAsDataUrl = (file: File) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(new Error('Failed to read attachment'));
      reader.readAsDataURL(file);
    });
  };

  const handleAttachImages = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEditContent) {
      event.target.value = '';
      return;
    }

    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) {
      return;
    }

    for (const file of files) {
      const dataUrl = await readFileAsDataUrl(file);
      // Optimistically insert a data URL so the user sees the image immediately
      setContent((currentContent) => appendImageToContent(currentContent, dataUrl, file.name));

      // Upload in background and replace the data URL with the returned server URL when available
      (async () => {
        try {
          const form = new FormData();
          form.append('file', file, file.name);
          const resp = await api.post('/uploads', form, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });

          const serverUrl = resp.data?.signedUrl ?? resp.data?.url;
          if (serverUrl) {
            // Replace the data URL with the server URL in the content
            setContent((currentContent) => currentContent.split(dataUrl).join(serverUrl));
          }
        } catch {
          // Upload failed — leave the inline data URL as-is. Optionally show a toast.
        }
      })();
    }

    event.target.value = '';
  };

  if (isLoading || !note) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading note details...</div>;
  }

  const isProtected = serverProtectionStatus ?? note.isProtected;
  const canEdit = canEditContent;

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
              <p className="text-sm text-muted-foreground">Enter the note password to view or edit it.</p>
            </div>
          </div>

          <div className="space-y-3">
            <Input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              placeholder="Password"
              aria-label="Password"
            />
            {protectionMessage ? <p className="text-sm text-destructive">{protectionMessage}</p> : null}
            <div className="flex gap-2">
              <Button type="button" className="flex-1" onClick={handleUnlockProtectedNote}>
                Unlock note
              </Button>
              <Button type="button" variant="outline" onClick={() => setCurrentPassword('')}>
                Clear
              </Button>
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
                const nextTitle = e.target.value;
                setTitle(nextTitle);
                if (note) {
                  const updatedAt = new Date().toISOString();
                  queryClient.setQueryData<Note[]>(NOTES_KEYS.all, (currentNotes = []) =>
                    currentNotes.map((currentNote) =>
                      currentNote.id === note.id
                        ? { ...currentNote, title: nextTitle, updatedAt }
                        : currentNote,
                    ),
                  );
                  queryClient.setQueryData(NOTES_KEYS.detail(note.id), (currentNote) =>
                    currentNote ? { ...currentNote, title: nextTitle, updatedAt } : currentNote,
                  );
                }
                sendContentUpdate(undefined, nextTitle);
                notifyTypingActivity();
              }}
              className="h-auto border-border/60 bg-white px-4 py-3 text-2xl font-semibold shadow-sm focus-visible:border-primary"
              placeholder="Note title..."
              readOnly={!canEdit}
            />
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {(() => {
                const StatusIcon = saveStatus.icon;
                return <StatusIcon className={cn('h-3.5 w-3.5', saveStatus.tone, isSaving && 'animate-spin')} />;
              })()}
              <span className={cn('font-medium', saveStatus.tone)}>{saveStatus.label}</span>
              <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-medium shadow-sm', realtimeTone === 'text-emerald-600' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-border/70 bg-background text-muted-foreground', realtimeTone)}>
                <span className={cn('h-1.5 w-1.5 rounded-full', isCollaborativeNote && isWsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/40')} />
                {realtimeLabel}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {note.isPinned ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 shadow-sm">
                  <Pin className="h-3 w-3" />
                  Pinned
                </span>
              ) : null}
              {isProtected ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-700 shadow-sm">
                  <Lock className="h-3 w-3" />
                  Protected
                </span>
              ) : null}
              {isSharedNote ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-700 shadow-sm">
                  <Share2 className="h-3 w-3" />
                  {sharedPermission === 'EDIT' ? 'Shared · Editable' : 'Shared · Read only'}
                </span>
              ) : null}
            </div>
            {isSharedNote ? (
              <div className="rounded-2xl border border-border/70 bg-slate-50 px-4 py-3 text-sm text-muted-foreground shadow-sm">
                Shared by <span className="font-medium text-foreground">{sharedBy?.displayName}</span>
                {' '}
                · {sharedPermission === 'EDIT' ? 'You can edit this note' : 'Read-only access'}
              </div>
            ) : null}
            <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
              {saveStatus.label}
            </div>
          </div>

          <div className="flex items-center gap-2 self-start">
            {canManageShares ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShareModalOpen(true)}
                disabled={isSaving}
                aria-label="Open sharing settings"
              >
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </Button>
            ) : null}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleAttachImages}
              className="hidden"
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => imageInputRef.current?.click()}
              disabled={isSaving || !canEdit}
              aria-label="Add image attachment"
            >
              <ImagePlus className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setProtectionMode((currentMode) => (currentMode === 'protect' || currentMode === 'remove' ? 'idle' : isProtected ? 'remove' : 'protect'))}
              disabled={isSaving || !canEdit || isSharedNote}
              aria-label={isProtected ? 'Remove note protection' : 'Protect note'}
            >
              <Lock className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={async () => {
              try {
                const updated = await updateNote({ isPinned: !note.isPinned });
                broadcastNoteState({ isPinned: updated.isPinned });
              } catch {
                // ignore - mutation handles optimistic updates
              }
            }} disabled={isSaving || !canEdit || isSharedNote} aria-label={note.isPinned ? 'Unpin note' : 'Pin note'} aria-pressed={note.isPinned}>
              <Pin className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={handleDelete} disabled={deleteMutation.isPending || !canEdit || isSharedNote} aria-label="Delete note">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {deleteConfirmOpen ? (
        <div className="border-b border-border/70 bg-slate-50 px-4 py-4 sm:px-6">
          <div className="rounded-2xl border border-destructive/20 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-destructive">Delete this note?</h3>
            <p className="mt-1 text-sm text-muted-foreground">This action cannot be undone.</p>
            <div className="mt-4 flex gap-2">
              <Button type="button" variant="destructive" onClick={handleConfirmDelete} disabled={deleteMutation.isPending}>
                Delete
              </Button>
              <Button type="button" variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {protectionMode !== 'idle' ? (
        <div className="border-b border-border/70 bg-slate-50 px-4 py-4 sm:px-6">
          {protectionMode === 'protect' ? (
            <div className="space-y-3 rounded-2xl border border-border/70 bg-white p-5 shadow-sm">
              <div>
                <h3 className="font-semibold">Protect this note</h3>
                <p className="text-sm text-muted-foreground">Set a password to lock viewing, editing, and deleting.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input type="password" placeholder="New password" value={protectionPassword} onChange={(event) => setProtectionPassword(event.target.value)} />
                <Input type="password" placeholder="Confirm password" value={confirmProtectionPassword} onChange={(event) => setConfirmProtectionPassword(event.target.value)} />
              </div>
              {protectionMessage ? <p className="text-sm text-destructive">{protectionMessage}</p> : null}
              <div className="flex gap-2">
                <Button type="button" onClick={handleEnableProtection}>Enable protection</Button>
                <Button type="button" variant="outline" onClick={() => { setProtectionMode('idle'); setProtectionMessage(null); }}>Cancel</Button>
              </div>
            </div>
          ) : null}

          {protectionMode === 'remove' ? (
            <div className="space-y-3 rounded-2xl border border-border/70 bg-white p-5 shadow-sm">
              <div>
                <h3 className="font-semibold">Remove protection</h3>
                <p className="text-sm text-muted-foreground">Enter the current password to unlock this note permanently.</p>
              </div>
              <Input type="password" placeholder="Current password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
              {protectionMessage ? <p className="text-sm text-destructive">{protectionMessage}</p> : null}
              <div className="flex gap-2">
                <Button type="button" onClick={handleDisableProtection}>Remove protection</Button>
                <Button type="button" variant="outline" onClick={() => { setProtectionMode('idle'); setProtectionMessage(null); }}>Cancel</Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {canManageShares && shareModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close sharing modal"
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            onClick={() => setShareModalOpen(false)}
          />

          <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-3xl border border-border/70 bg-white shadow-[0_30px_100px_rgba(15,23,42,0.18)]">
            <div className="flex items-start justify-between gap-4 border-b border-border/70 bg-gradient-to-r from-slate-50 to-white px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold tracking-tight">Share this note</h3>
                <p className="text-sm text-muted-foreground">Only registered users can be added. You can grant read-only or edit access.</p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setShareModalOpen(false)} aria-label="Close sharing modal">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="max-h-[75vh] space-y-5 overflow-y-auto p-5">
              <div className="grid gap-3 sm:grid-cols-[1fr_10rem_auto]">
                <Input
                  type="email"
                  placeholder="Recipient email"
                  value={shareRecipientEmail}
                  onChange={(event) => setShareRecipientEmail(event.target.value)}
                />
                <select
                  className="h-11 rounded-xl border border-input bg-background px-3 text-sm"
                  value={sharePermission}
                  onChange={(event) => setSharePermission(event.target.value as 'READ' | 'EDIT')}
                >
                  <option value="READ">Read only</option>
                  <option value="EDIT">Can edit</option>
                </select>
                <Button type="button" onClick={handleAddShare} disabled={createShareMutation.isPending}>
                  Share
                </Button>
              </div>

              {shareMessage ? <p className="text-sm text-muted-foreground">{shareMessage}</p> : null}

              <div className="space-y-3">
                <div className="text-sm font-medium">Current shares</div>
                {(shares ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">This note is not shared yet.</p>
                ) : (
                  <div className="space-y-2">
                    {shares?.map((share) => (
                      <div key={share.id} className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="truncate font-medium">{share.recipientEmail}</div>
                          <div className="text-xs text-muted-foreground">{share.permission === 'EDIT' ? 'Can edit' : 'Read only'}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
                            value={share.permission}
                            onChange={(event) => handleChangeSharePermission(share.id, event.target.value as 'READ' | 'EDIT')}
                            disabled={updateShareMutation.isPending}
                          >
                            <option value="READ">Read only</option>
                            <option value="EDIT">Can edit</option>
                          </select>
                          <Button type="button" variant="outline" onClick={() => handleRemoveShare(share.id)} disabled={deleteShareMutation.isPending}>
                            Revoke
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      
      <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-50 to-white p-4 sm:p-8">
        <div className="mx-auto max-w-4xl">
          {/* Collaborator presence indicators */}
          {isCollaborativeNote && (isWsConnected || collaborators.length > 0 || presenceParticipants.length > 0) ? (
            <div className="mb-4 flex items-center gap-2 rounded-full border border-border/70 bg-white px-3 py-2 shadow-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Viewing now:</span>
              <div className="flex -space-x-2">
                {(collaborators.length > 0 ? collaborators : presenceParticipants).map((participant) => (
                  <div
                    key={participant.userId}
                    className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white shadow-sm"
                    style={{ backgroundColor: participant.color }}
                    title={participant.displayName}
                  >
                    {participant.displayName.charAt(0).toUpperCase()}
                  </div>
                ))}
              </div>
              {isWsConnected ? (
                <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {collaborators.length > 0 || presenceParticipants.length > 0 ? 'Live' : 'Connected'}
                </span>
              ) : null}
            </div>
          ) : null}

          {isCollaborativeNote && typingParticipants.length > 0 ? (
            <div className="mb-3 rounded-full border border-border/70 bg-white px-3 py-2 text-xs text-muted-foreground shadow-sm">
              {typingParticipants.map((participant) => participant.displayName).join(', ')} typing…
            </div>
          ) : null}

          <NoteEditor
            content={content}
            readOnly={!canEdit}
            onInsertImage={() => imageInputRef.current?.click()}
            syncKey={note?.id ?? noteId}
            collaborative={Boolean(isCollaborativeNote)}
            remoteCursors={remoteCursors}
            yDoc={yDoc ?? undefined}
            {...(canEdit ? {
              onChange: (newContent: string) => {
                setContent(newContent);
                // Broadcast to collaborators unless this change came from a remote update
                if (!isRemoteUpdateRef.current && isCollaborativeNote) {
                  notifyTypingActivity();
                }
              },
              onCursorMove: (position: number) => {
                if (isCollaborativeNote) {
                  sendCursorPosition(position);
                }
              },
            } : {})}
          />
        </div>
      </div>
    </div>
  );
}
