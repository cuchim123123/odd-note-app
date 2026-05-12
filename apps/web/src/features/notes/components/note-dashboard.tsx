import { useState, useEffect } from 'react';
import { useNote, useUpdateNote, useDeleteNote } from '../api/notes.api';
import { NoteList } from './note-list';
import { NoteEditor } from './note-editor';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { Grid2x2, List, Trash2, Save, FileEdit } from 'lucide-react';

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

  // Sync local state when note changes
  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content || '');
    }
  }, [note]);

  const handleSave = () => {
    updateMutation.mutate({ title, content });
  };

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
      <div className="p-4 border-b flex items-center justify-between gap-4 bg-background">
        <Input 
          value={title} 
          onChange={(e) => setTitle(e.target.value)} 
          className="text-xl font-bold border-transparent hover:border-input focus-visible:border-input px-2 shadow-none max-w-xl"
          placeholder="Note title..."
        />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
            <Save className="w-4 h-4 mr-2" />
            {updateMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
          <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
            <Trash2 className="w-4 h-4" />
          </Button>
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
