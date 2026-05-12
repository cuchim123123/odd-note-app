import { useEffect, useMemo, useRef, useState } from 'react';
import { useNote, useUpdateNote, useDeleteNote } from '../api/notes.api';
import { NoteList } from './note-list';
import { NoteEditor } from './note-editor';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { Grid2x2, List, Trash2, FileEdit, Check, Loader2, AlertTriangle, Pin, ImagePlus, Lock } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { appendImageToContent } from '../utils/attachments';
import { useNoteProtectionStore } from '../stores/note-protection.store';

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
  const { data: note, isLoading } = useNote(noteId);
  const updateMutation = useUpdateNote(noteId);
  const { mutateAsync: updateNote, isPending: isSaving } = updateMutation;
  const deleteMutation = useDeleteNote(noteId);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const isUnlocked = useNoteProtectionStore((state) => state.isUnlocked(noteId));
  const lockNote = useNoteProtectionStore((state) => state.lockNote);
  const unlockNote = useNoteProtectionStore((state) => state.unlockNote);
  const removeProtection = useNoteProtectionStore((state) => state.removeProtection);

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

  // Sync local state when note changes
  useEffect(() => {
    if (note) {
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
    }
  }, [note]);

  const canAutosave = !!note && !isLoading;

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
    if (confirm('Are you sure you want to delete this note?')) {
      await deleteMutation.mutateAsync();
      onDeleted();
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

    const protectedNow = lockNote(noteId, normalizedPassword);

    if (!protectedNow) {
      setProtectionMessage('Enter a password.');
      return;
    }

    await updateNote({ isProtected: true });
    unlockNote(noteId, normalizedPassword);
    setProtectionMode('idle');
    setProtectionPassword('');
    setConfirmProtectionPassword('');
    setProtectionMessage('Protection enabled.');
  };

  const handleDisableProtection = async () => {
    const removed = removeProtection(noteId, currentPassword);

    if (!removed) {
      setProtectionMessage('Incorrect password.');
      return;
    }

    await updateNote({ isProtected: false });
    setProtectionMode('idle');
    setCurrentPassword('');
    setProtectionMessage('Protection removed.');
  };

  const handleUnlockProtectedNote = async () => {
    if (!unlockNote(noteId, currentPassword)) {
      setProtectionMessage('Incorrect password.');
      return;
    }

    setCurrentPassword('');
    setProtectionMessage(null);
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
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) {
      return;
    }

    for (const file of files) {
      const dataUrl = await readFileAsDataUrl(file);
      setContent((currentContent) => appendImageToContent(currentContent, dataUrl, file.name));
    }

    event.target.value = '';
  };

  if (isLoading || !note) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading note details...</div>;
  }

  if (note.isProtected && !isUnlocked) {
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
              onChange={(e) => setTitle(e.target.value)} 
              className="border-transparent px-0 text-2xl font-semibold shadow-none focus-visible:border-input"
              placeholder="Note title..."
            />
            <div className="flex items-center gap-2 text-xs">
              {(() => {
                const StatusIcon = saveStatus.icon;
                return <StatusIcon className={cn('h-3.5 w-3.5', saveStatus.tone, isSaving && 'animate-spin')} />;
              })()}
              <span className={cn('font-medium', saveStatus.tone)}>{saveStatus.label}</span>
            </div>
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
              disabled={isSaving}
              aria-label="Add image attachment"
            >
              <ImagePlus className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setProtectionMode((currentMode) => (currentMode === 'protect' || currentMode === 'remove' ? 'idle' : note.isProtected ? 'remove' : 'protect'))}
              disabled={isSaving}
              aria-label={note.isProtected ? 'Remove note protection' : 'Protect note'}
            >
              <Lock className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={async () => {
              try {
                await updateNote({ isPinned: !note.isPinned });
              } catch {
                // ignore - mutation handles optimistic updates
              }
            }} disabled={isSaving} aria-label={note.isPinned ? 'Unpin note' : 'Pin note'} aria-pressed={note.isPinned}>
              <Pin className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

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
      
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-background">
        <div className="max-w-4xl mx-auto">
          <NoteEditor content={content} onChange={setContent} />
        </div>
      </div>
    </div>
  );
}
