import { useCallback, useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { useNotes, useSharedNotes, useCreateNote, useBulkDeleteNotes, useBulkAddLabel } from '../api/notes.api';
import type { Note } from '@odd-note-app/validation';
import { Button } from '../../../components/ui/button';
import { Plus, Search, Share2, Sparkles, Trash, Grid2x2, List, Tag } from 'lucide-react';
import { LabelSelector } from './label-selector';
import { Input } from '../../../components/ui/input';
import { cn } from '../../../lib/utils';
import { useLabelManagementStore } from '../../settings/stores/label-management.store';
import { NoteCard } from './note-card';
import type { SharedNoteItem } from '../api/notes.api';
import { LabelFilterModal } from './label-filter-modal';

type DisplayNote = Note | SharedNoteItem;

const htmlStripCache = new Map<string, string>();

function stripHtml(html: string | undefined): string {
  if (!html) {
    return '';
  }
  const cached = htmlStripCache.get(html);
  if (cached !== undefined) return cached;

  const stripped = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  
  // Throttle cache growth to 500 items max
  if (htmlStripCache.size > 500) {
    const firstKey = htmlStripCache.keys().next().value;
    if (firstKey !== undefined) {
      htmlStripCache.delete(firstKey);
    }
  }
  
  htmlStripCache.set(html, stripped);
  return stripped;
}

type ViewMode = 'grid' | 'list';

type NoteListProps = {
  selectedNoteId: string | null;
  onSelectNote: (id: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
};

export function NoteList({ selectedNoteId, onSelectNote, viewMode, onViewModeChange }: NoteListProps) {
  const { data: notes, isLoading } = useNotes();
  const { data: sharedNotes } = useSharedNotes();
  const createNoteMutation = useCreateNote();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const labels = useLabelManagementStore((state) => state.labels);
  const syncLabels = useLabelManagementStore((state) => state.syncLabels);

  const bulkDeleteMutation = useBulkDeleteNotes();
  const bulkAddLabelMutation = useBulkAddLabel();
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedNotesIds, setSelectedNotesIds] = useState<Set<string>>(new Set());

  const handleToggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedNotesIds(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedNotesIds.size === 0) return;
    await bulkDeleteMutation.mutateAsync(Array.from(selectedNotesIds));
    setIsSelectionMode(false);
    setSelectedNotesIds(new Set());
  };

  const handleBulkAddLabel = async (label: string) => {
    if (selectedNotesIds.size === 0) return;
    await bulkAddLabelMutation.mutateAsync({
      ids: Array.from(selectedNotesIds),
      label,
      notes: [...(notes ?? []), ...(sharedNotes ?? [])] as Note[],
    });
    setIsSelectionMode(false);
    setSelectedNotesIds(new Set());
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search.trim().toLowerCase());
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [search]);

  const handleCreateNew = async () => {
    flushSync(() => {
      setSelectedLabels([]);
    });
    const newNote = await createNoteMutation.mutateAsync({ title: 'Untitled Note', content: '' });
    onSelectNote(newNote.id || '');
  };

  const handleSelectNote = useCallback((noteId: string) => {
    if (isSelectionMode) {
      setSelectedNotesIds((prev) => {
        const next = new Set(prev);
        if (next.has(noteId)) {
          next.delete(noteId);
        } else {
          next.add(noteId);
        }
        return next;
      });
    } else {
      onSelectNote(noteId);
    }
  }, [isSelectionMode, onSelectNote]);

  const matchesNote = (note: DisplayNote) => {
    const matchesSearch = !debouncedSearch || `${note.title} ${stripHtml(note.content)}`.toLowerCase().includes(debouncedSearch);
    const matchesLabel = selectedLabels.length === 0 || selectedLabels.every((l) => (note.labels || []).includes(l));
    return matchesSearch && matchesLabel;
  };

  const filteredNotes = useMemo(() => {
    const visibleNotes = notes ?? [];

    return visibleNotes
      .filter(matchesNote)
      .sort((left, right) => {
        if (left.isPinned !== right.isPinned) {
          return Number(right.isPinned) - Number(left.isPinned);
        }

        return new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime();
      });
  }, [debouncedSearch, notes, selectedLabels]);

  const filteredSharedNotes = useMemo(() => {
    const visibleNotes = sharedNotes ?? [];

    return visibleNotes.filter(matchesNote);
  }, [debouncedSearch, selectedLabels, sharedNotes]);

  const isGridView = viewMode === 'grid';

  useEffect(() => {
    if ((notes?.length ?? 0) > 0 && labels.length === 0) {
      syncLabels((notes ?? []).flatMap((note) => note.labels || []));
    }
  }, [labels.length, notes, syncLabels]);

  useEffect(() => {
    setSelectedLabels((prev) => prev.filter((l) => labels.includes(l)));
  }, [labels]);

  return (
    <div className="flex h-full flex-col border-r bg-card">
      <div className="space-y-4 border-b border-border/70 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Notes
            </div>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">All notes</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant={isSelectionMode ? "default" : "outline"} onClick={handleToggleSelectionMode} className="rounded-2xl h-10 px-4">
              {isSelectionMode ? 'Cancel' : 'Select'}
            </Button>
            <Button size="icon" variant="default" onClick={handleCreateNew} disabled={createNoteMutation.isPending || isSelectionMode} aria-label="Create new note" title="Create new note" className="rounded-2xl">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {isSelectionMode ? (
          <div className="flex items-center justify-between rounded-xl bg-primary/10 px-4 py-2 border border-primary/20">
            <span className="text-sm font-semibold text-primary">{selectedNotesIds.size} selected</span>
            <div className="flex items-center gap-2">
              <LabelSelector
                selectedLabels={[]}
                onToggleLabel={handleBulkAddLabel}
                onOpenManagement={() => {}}
                disabled={selectedNotesIds.size === 0 || bulkAddLabelMutation.isPending}
              />
              <Button
                size="sm"
                variant="destructive"
                onClick={handleBulkDelete}
                disabled={selectedNotesIds.size === 0 || bulkDeleteMutation.isPending}
                className="h-8 rounded-full"
              >
                <Trash className="mr-2 h-3.5 w-3.5" />
                Delete
              </Button>
            </div>
          </div>
        ) : (
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search notes..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-white/80 p-6 text-center text-sm text-muted-foreground">Loading notes...</div>
        ) : filteredNotes.length === 0 && filteredSharedNotes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-card/80 p-8 text-center text-sm text-muted-foreground">
            {search ? 'No notes found matching your search.' : 'No notes yet. Create your first one.'}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 pb-1 border-b border-border/10">
              {/* Left Side: Label Row with 3 limit */}
              <div className="flex flex-1 items-center gap-1.5 overflow-x-auto pr-2 scrollbar-none">
                <Button
                  size="sm"
                  variant={selectedLabels.length === 0 ? 'default' : 'outline'}
                  onClick={() => setSelectedLabels([])}
                  className="rounded-full shrink-0 h-8"
                >
                  All
                </Button>
                {labels.slice(0, 3).map((label) => {
                  const isSelected = selectedLabels.includes(label);
                  return (
                    <Button
                      key={label}
                      size="sm"
                      variant={isSelected ? 'default' : 'outline'}
                      onClick={() => setSelectedLabels((prev) =>
                        prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
                      )}
                      className="rounded-full shrink-0 h-8"
                    >
                      {label}
                    </Button>
                  );
                })}
                {labels.length > 3 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsFilterModalOpen(true)}
                    className="rounded-full shrink-0 h-8 bg-primary/5 text-primary hover:bg-primary/10 border-primary/20 flex items-center gap-1 font-semibold text-xs"
                  >
                    <Tag className="h-3.5 w-3.5" />
                    +{labels.length - 3} more
                  </Button>
                )}
              </div>

              {/* Right Side: View Mode Toggler */}
              <div className="flex items-center gap-0.5 rounded-full border bg-background p-0.5 shadow-sm shrink-0">
                <Button
                  type="button"
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="icon"
                  onClick={() => onViewModeChange('grid')}
                  className="h-7 w-7 rounded-full p-0"
                  title="Grid view"
                >
                  <Grid2x2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="icon"
                  onClick={() => onViewModeChange('list')}
                  className="h-7 w-7 rounded-full p-0"
                  title="List view"
                >
                  <List className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className={cn(isGridView ? 'grid justify-center gap-3 [grid-template-columns:repeat(auto-fill,minmax(16rem,16rem))]' : 'space-y-2')}>
              {filteredNotes.map((note) => {
                const isSelected = selectedNoteId === note.id;

                const isSelectedForBulk = selectedNotesIds.has(note.id || '');

                return (
                  <NoteCard
                    key={note.id}
                    note={note}
                    isSelected={isSelected}
                    onSelect={handleSelectNote}
                    isGridView={isGridView}
                    isSelectionMode={isSelectionMode}
                    isSelectedForBulk={isSelectedForBulk}
                  />
                );
              })}
            </div>

            {filteredSharedNotes.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  <Share2 className="h-3.5 w-3.5" />
                  Shared with me
                </div>

                <div className={cn(isGridView ? 'grid justify-center gap-3 [grid-template-columns:repeat(auto-fill,minmax(16rem,16rem))]' : 'space-y-2')}>
                  {filteredSharedNotes.map((note: SharedNoteItem) => {
                    const isSelected = selectedNoteId === note.id;

                    const isSelectedForBulk = selectedNotesIds.has(note.id || '');

                    return (
                      <NoteCard
                        key={`shared-${note.id}`}
                        note={note}
                        isSelected={isSelected}
                        onSelect={handleSelectNote}
                        isGridView={isGridView}
                        isSelectionMode={isSelectionMode}
                        isSelectedForBulk={isSelectedForBulk}
                      />
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {isFilterModalOpen && (
        <LabelFilterModal
          isOpen={isFilterModalOpen}
          onClose={() => setIsFilterModalOpen(false)}
          selectedLabels={selectedLabels}
          onToggleLabel={(label) =>
            setSelectedLabels((prev) =>
              prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
            )
          }
          onClearSelection={() => setSelectedLabels([])}
          onSelectAll={() => setSelectedLabels([...labels])}
        />
      )}
    </div>
  );
}

