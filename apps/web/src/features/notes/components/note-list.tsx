import { useEffect, useMemo, useState } from 'react';
import { useNotes, useCreateNote, useUpdateNote } from '../api/notes.api';
import type { Note } from '@odd-note-app/validation';
import { Button } from '../../../components/ui/button';
import { FileText, Lock, Pin, Plus, Search, Share2 } from 'lucide-react';
import { Input } from '../../../components/ui/input';
import { cn } from '../../../lib/utils';

type ViewMode = 'grid' | 'list';


type NoteListProps = {
  selectedNoteId: string | null;
  onSelectNote: (id: string) => void;
  viewMode: ViewMode;
};

function stripHtml(html: string | undefined): string {
  if (!html) {
    return '';
  }

  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatPreview(noteContent: string | undefined): string {
  const plainText = stripHtml(noteContent);
  if (!plainText) {
    return 'No content yet.';
  }

  return plainText.length > 120 ? `${plainText.slice(0, 120)}…` : plainText;
}

export function NoteList({ selectedNoteId, onSelectNote, viewMode }: NoteListProps) {
  const { data: notes, isLoading } = useNotes();
  const createNoteMutation = useCreateNote();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search.trim().toLowerCase());
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [search]);

  const handleCreateNew = async () => {
    const newNote = await createNoteMutation.mutateAsync({ title: 'Untitled Note', content: '' });
    onSelectNote(newNote.id);
  };

  const filteredNotes = useMemo(() => {
    const visibleNotes = notes ?? [];

    return visibleNotes
      .filter((note) => {
        if (!debouncedSearch) {
          // when there's no search, respect label filter if selected
          return selectedLabel ? note.labels.includes(selectedLabel) : true;
        }

        const searchableText = `${note.title} ${stripHtml(note.content)}`.toLowerCase();
        const matchesSearch = searchableText.includes(debouncedSearch);
        const matchesLabel = selectedLabel ? note.labels.includes(selectedLabel) : true;
        return matchesSearch && matchesLabel;
      })
      .sort((left, right) => {
        if (left.isPinned !== right.isPinned) {
          return Number(right.isPinned) - Number(left.isPinned);
        }

        return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
      });
  }, [debouncedSearch, notes]);

  const isGridView = viewMode === 'grid';

  const labels = useMemo(() => {
    const set = new Set<string>();
    (notes || []).forEach((n) => n.labels.forEach((l) => set.add(l)));
    return Array.from(set).sort();
  }, [notes]);

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
          <div className="p-3">
            <div className="mb-3 flex items-center gap-2 overflow-x-auto">
              <Button size="sm" variant={selectedLabel === null ? 'default' : 'ghost'} onClick={() => setSelectedLabel(null)}>
                All
              </Button>
              {labels.map((label) => (
                <Button
                  key={label}
                  size="sm"
                  variant={selectedLabel === label ? 'default' : 'ghost'}
                  onClick={() => setSelectedLabel((s) => (s === label ? null : label))}
                >
                  {label}
                </Button>
              ))}
            </div>

            <div className={cn(isGridView ? 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3' : 'space-y-2')}>
              {filteredNotes.map((note) => {
                const isSelected = selectedNoteId === note.id;

                return (
                  <NoteCard
                    key={note.id}
                    note={note}
                    isSelected={isSelected}
                    onSelect={() => onSelectNote(note.id)}
                    isGridView={isGridView}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NoteCard({ note, isSelected, onSelect, isGridView }: { note: Note; isSelected: boolean; onSelect: () => void; isGridView: boolean }) {
  const update = useUpdateNote(note.id);

  const handleTogglePin = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await update.mutateAsync({ isPinned: !note.isPinned });
    } catch {
      // noop - optimistic updates handled by mutation
    }
  };

  return (
    <button
      onClick={onSelect}
      className={cn(
        'group w-full rounded-xl border bg-background text-left transition-all hover:-translate-y-0.5 hover:shadow-md',
        isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-border/70 hover:border-border',
        isGridView ? 'p-4' : 'p-4',
      )}
    >
      <div className={cn('flex items-start gap-3', isGridView ? 'flex-col' : 'flex-row')}>
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/70', isSelected && 'bg-primary/10')}>
          <FileText className={cn('h-4 w-4', isSelected ? 'text-primary' : 'text-muted-foreground')} />
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex items-center gap-2">
              <span className={cn('truncate font-medium', isSelected ? 'text-foreground' : 'text-foreground')}>{note.title}</span>
              {note.isPinned ? <Pin className="h-3.5 w-3.5 shrink-0 text-amber-500" /> : null}
              {note.isProtected ? <Lock className="h-3.5 w-3.5 shrink-0 text-destructive" /> : null}
              {note.isShared ? <Share2 className="h-3.5 w-3.5 shrink-0 text-sky-500" /> : null}
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={handleTogglePin}>
                <Pin className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <p className={cn('mt-1 text-sm leading-5 text-muted-foreground', isGridView ? 'line-clamp-3' : 'line-clamp-2')}>
            {formatPreview(note.content)}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            {note.labels.map((label: string) => (
              <span key={label} className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {label}
              </span>
            ))}
          </div>

          <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
            <span>{new Date(note.updatedAt).toLocaleDateString()}</span>
            <span>{new Date(note.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      </div>
    </button>
  );
}
