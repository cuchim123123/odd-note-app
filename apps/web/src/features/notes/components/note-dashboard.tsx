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
  setNotePassword,
  verifyNotePassword,
  NOTES_KEYS,
} from '../api/notes.api';
import type { Note } from '@odd-note-app/validation';
import { NoteList } from './note-list';
import { NoteEditor } from './note-editor';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { Grid2x2, List, Trash2, FileEdit, Check, Loader2, AlertTriangle, Pin, ImagePlus, Lock, Users } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { appendImageToContent } from '../utils/attachments';
import { api } from '../../../lib/axios';
import { useNoteProtectionStore } from '../stores/note-protection.store';
import { useCollaboration } from '../hooks/useCollaboration';

type ViewMode = 'grid' | 'list';

export function NoteDashboard() {
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Your notes</h1>
          <p className="text-sm text-muted-foreground">
            Switch between grid and list views, search instantly, and open any note to edit it.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-full border bg-background p-1 shadow-sm">
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

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border bg-card shadow-sm">
        {/* Sidebar */}
        <div className="w-full shrink-0 border-r lg:w-[22rem]">
          <NoteList
            selectedNoteId={selectedNoteId}
            onSelectNote={setSelectedNoteId}
            viewMode={viewMode}
          />
        </div>

        {/* Main Content */}
        <div className="relative flex-1 overflow-hidden bg-background">
          {selectedNoteId ? (
            <NoteDetailView noteId={selectedNoteId} onDeleted={() => setSelectedNoteId(null)} />
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
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const typingStopTimerRef = useRef<number | null>(null);
  /** Track whether the last content change came from a remote collaborator (skip re-broadcast) */
  const isRemoteUpdateRef = useRef(false);

  // Sync local state when note changes
  useEffect(() => {
    if (note && loadedNoteIdRef.current !== note.id) {
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
    }
  }, [note]);

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

  const canAutosave = !!note && !isLoading && canEditContent;

  // Real-time collaboration: connect when this is a shared EDIT note
  const isCollaborativeNote = (isSharedNote && sharedPermission === 'EDIT') || (note?.isShared && canManageShares);

  const handleRemoteContentUpdate = useCallback(
    (data: { userId: string; content: string; title?: string }) => {
      isRemoteUpdateRef.current = true;
      if (data.title !== undefined) {
        setTitle(data.title);
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

  const { presenceParticipants, typingParticipants, isConnected: isWsConnected, sendContentUpdate, sendTypingState } = useCollaboration({
    noteId: isCollaborativeNote ? noteId : null,
    enabled: Boolean(isCollaborativeNote),
    onRemoteContentUpdate: handleRemoteContentUpdate,
  });

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
    if (!canAutosave || !note) {
      return;
    }

    const hasChanges = title !== note.title || content !== (note.content || '');
    setIsDirty(hasChanges);

    if (!hasChanges) {
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        setSaveError(null);
        const updated = await updateNote({ title, content });
        setLastSavedAt(updated.updatedAt);
        setIsDirty(false);
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : 'Failed to save note');
      }
    }, 650);

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

    return { icon: Check, label: lastSavedAt ? `Saved ${new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Saved', tone: 'text-emerald-600 dark:text-emerald-400' as const };
  }, [isDirty, isSaving, lastSavedAt, saveError]);

  const handleDelete = async () => {
    setDeleteConfirmOpen(true);
  };

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
      await updateNote({ isProtected: true });
      markUnlocked(noteId);
      setServerProtectionStatus(true);
      setProtectionMode('idle');
      setProtectionPassword('');
      setConfirmProtectionPassword('');
      setProtectionMessage('Protection enabled.');
    } catch {
      setProtectionMessage('Failed to enable protection.');
    }
  };

  const handleDisableProtection = async () => {
    try {
      await removeNotePassword(noteId, currentPassword.trim());
      await updateNote({ isProtected: false });
      markLocked(noteId);
      setServerProtectionStatus(false);
      setProtectionMode('idle');
      setCurrentPassword('');
      setProtectionMessage('Protection removed.');
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
    <div className="flex flex-col h-full overflow-hidden">
      <div className="border-b bg-background px-4 py-3 sm:px-6">
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
                notifyTypingActivity();
              }} 
              className="border-transparent px-0 text-2xl font-semibold shadow-none focus-visible:border-input"
              placeholder="Note title..."
              readOnly={!canEdit}
            />
            <div className="flex items-center gap-2 text-xs">
              {(() => {
                const StatusIcon = saveStatus.icon;
                return <StatusIcon className={cn('h-3.5 w-3.5', saveStatus.tone, isSaving && 'animate-spin')} />;
              })()}
              <span className={cn('font-medium', saveStatus.tone)}>{saveStatus.label}</span>
            </div>
            {isSharedNote ? (
              <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
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
                await updateNote({ isPinned: !note.isPinned });
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
        <div className="border-b bg-muted/20 px-4 py-4 sm:px-6">
          <div className="rounded-lg border border-destructive/30 bg-background p-4 shadow-sm">
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
        <div className="border-b bg-muted/20 px-4 py-4 sm:px-6">
          {protectionMode === 'protect' ? (
            <div className="space-y-3 rounded-lg border bg-background p-4 shadow-sm">
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
            <div className="space-y-3 rounded-lg border bg-background p-4 shadow-sm">
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

      {canManageShares ? (
        <div className="border-b bg-muted/20 px-4 py-4 sm:px-6">
          <div className="space-y-4 rounded-lg border bg-background p-4 shadow-sm">
            <div>
              <h3 className="font-semibold">Share this note</h3>
              <p className="text-sm text-muted-foreground">Only registered users can be added. You can grant read-only or edit access.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_10rem_auto]">
              <Input
                type="email"
                placeholder="Recipient email"
                value={shareRecipientEmail}
                onChange={(event) => setShareRecipientEmail(event.target.value)}
              />
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
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
                    <div key={share.id} className="flex flex-col gap-2 rounded-md border px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="font-medium">{share.recipientEmail}</div>
                        <div className="text-xs text-muted-foreground">{share.permission === 'EDIT' ? 'Can edit' : 'Read only'}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
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
      ) : null}
      
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-background">
        <div className="max-w-4xl mx-auto">
          {/* Collaborator presence indicators */}
          {isCollaborativeNote && presenceParticipants.length > 0 ? (
            <div className="mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Viewing now:</span>
              <div className="flex -space-x-2">
                {presenceParticipants.map((participant) => (
                  <div
                    key={participant.userId}
                    className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-background text-[10px] font-bold text-white"
                    style={{ backgroundColor: participant.color }}
                    title={participant.displayName}
                  >
                    {participant.displayName.charAt(0).toUpperCase()}
                  </div>
                ))}
              </div>
              {isWsConnected ? (
                <span className="ml-auto flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
              ) : null}
            </div>
          ) : null}

          {isCollaborativeNote && typingParticipants.length > 0 ? (
            <div className="mb-3 text-xs text-muted-foreground">
              {typingParticipants.map((participant) => participant.displayName).join(', ')} typing…
            </div>
          ) : null}

          <NoteEditor
            content={content}
            readOnly={!canEdit}
            onInsertImage={() => imageInputRef.current?.click()}
            syncKey={note?.id ?? noteId}
            collaborative={Boolean(isCollaborativeNote)}
            {...(canEdit ? {
              onChange: (newContent: string) => {
                setContent(newContent);
                // Broadcast to collaborators unless this change came from a remote update
                if (!isRemoteUpdateRef.current && isCollaborativeNote) {
                  sendContentUpdate(newContent, title);
                  notifyTypingActivity();
                }
              },
            } : {})}
          />
        </div>
      </div>
    </div>
  );
}
