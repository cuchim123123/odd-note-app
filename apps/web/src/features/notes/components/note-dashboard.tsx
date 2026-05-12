import { useState, useEffect } from 'react';
import { useNote, useUpdateNote, useDeleteNote } from '../api/notes.api';
import { NoteList } from './note-list';
import { NoteEditor } from './note-editor';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { Trash2, Save, FileEdit } from 'lucide-react';

export function NoteDashboard() {
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  return (
    <div className="flex h-[calc(100vh-6rem)] overflow-hidden rounded-xl border bg-card shadow-sm">
      {/* Sidebar */}
      <div className="w-80 shrink-0 h-full border-r">
        <NoteList selectedNoteId={selectedNoteId} onSelectNote={setSelectedNoteId} />
      </div>
      
      {/* Main Content */}
      <div className="flex-1 h-full overflow-hidden flex flex-col bg-background relative">
        {selectedNoteId ? (
          <NoteDetailView noteId={selectedNoteId} onDeleted={() => setSelectedNoteId(null)} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <div className="bg-muted/30 p-6 rounded-full mb-4">
              <FileEdit className="w-10 h-10 text-muted-foreground/50" />
            </div>
            <p>Select a note from the sidebar or create a new one.</p>
          </div>
        )}
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
