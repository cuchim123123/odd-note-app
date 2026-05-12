import { useState } from 'react';
import { useNotes, useCreateNote } from '../api/notes.api';
import { Button } from '../../../components/ui/button';
import { FileText, Plus, Search } from 'lucide-react';
import { Input } from '../../../components/ui/input';
import { cn } from '../../../lib/utils';


type NoteListProps = {
  selectedNoteId: string | null;
  onSelectNote: (id: string) => void;
};

export function NoteList({ selectedNoteId, onSelectNote }: NoteListProps) {
  const { data: notes, isLoading } = useNotes();
  const createNoteMutation = useCreateNote();
  const [search, setSearch] = useState('');

  const handleCreateNew = async () => {
    const newNote = await createNoteMutation.mutateAsync({ title: 'Untitled Note', content: '' });
    onSelectNote(newNote.id);
  };

  const filteredNotes = notes?.filter(note => 
    note.title.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="flex flex-col h-full border-r bg-muted/20">
      <div className="p-4 border-b space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold tracking-tight">All Notes</h2>
          <Button size="icon" variant="ghost" onClick={handleCreateNew} disabled={createNoteMutation.isPending}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search notes..." 
            className="pl-9 bg-background" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-sm text-muted-foreground text-center animate-pulse">Loading notes...</div>
        ) : filteredNotes.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {search ? 'No notes found matching your search.' : 'No notes yet. Create one!'}
          </div>
        ) : (
          <ul className="divide-y divide-border/50">
            {filteredNotes.map((note) => (
              <li key={note.id}>
                <button
                  onClick={() => onSelectNote(note.id)}
                  className={cn(
                    "w-full text-left px-4 py-3 hover:bg-accent hover:text-accent-foreground transition-colors flex flex-col gap-1",
                    selectedNoteId === note.id ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 shrink-0" />
                    <span className={cn(
                      "font-medium truncate",
                      selectedNoteId === note.id ? "text-foreground" : "text-foreground/80"
                    )}>
                      {note.title}
                    </span>
                  </div>
                  <span className="text-xs truncate ml-6">
                    {new Date(note.updatedAt).toLocaleDateString()}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
