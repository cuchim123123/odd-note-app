import { useEffect, useMemo, useState } from 'react';
import { useNote, useUpdateNote, useDeleteNote } from '../api/notes.api';
import { NoteList } from './note-list';
import { NoteEditor } from './note-editor';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { Grid2x2, List, Trash2, FileEdit, Check, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '../../../lib/utils';

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
  const deleteMutation = useDeleteNote(noteId);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Sync local state when note changes
  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content || '');
      setIsDirty(false);
      setLastSavedAt(note.updatedAt);
      setSaveError(null);
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
        const updated = await updateMutation.mutateAsync({ title, content });
        setLastSavedAt(updated.updatedAt);
        setIsDirty(false);
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : 'Failed to save note');
      }
    }, 650);

    return () => window.clearTimeout(timeoutId);
  }, [canAutosave, content, note, title, updateMutation]);

  const saveStatus = useMemo(() => {
    if (saveError) {
      return { icon: AlertTriangle, label: saveError, tone: 'text-destructive' as const };
    }

    if (updateMutation.isPending) {
      return { icon: Loader2, label: 'Autosaving…', tone: 'text-muted-foreground' as const };
    }

    if (isDirty) {
      return { icon: Loader2, label: 'Pending changes…', tone: 'text-muted-foreground' as const };
    }

    return { icon: Check, label: lastSavedAt ? `Saved ${new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Saved', tone: 'text-emerald-600 dark:text-emerald-400' as const };
  }, [isDirty, lastSavedAt, saveError, updateMutation.isPending]);

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this note?')) {
      await deleteMutation.mutateAsync();
      onDeleted();
    }
  };

  if (isLoading || !note) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading note details...</div>;
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
                return <StatusIcon className={cn('h-3.5 w-3.5', saveStatus.tone, updateMutation.isPending && 'animate-spin')} />;
              })()}
              <span className={cn('font-medium', saveStatus.tone)}>{saveStatus.label}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start">
            <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-background">
        <div className="max-w-4xl mx-auto">
          <NoteEditor content={content} onChange={setContent} />
        </div>
      </div>
    </div>
  );
}
