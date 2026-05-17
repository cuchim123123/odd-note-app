import { useEffect, useMemo, useState, memo } from 'react';
import { flushSync } from 'react-dom';
import { useNotes, useSharedNotes, useCreateNote, useUpdateNote, useBulkDeleteNotes, useBulkAddLabel } from '../api/notes.api';
import type { Note } from '@odd-note-app/validation';
import { Button } from '../../../components/ui/button';
import { FileText, Lock, Pin, Plus, Search, Share2, Sparkles, Trash, Check } from 'lucide-react';
import { LabelSelector } from './label-selector';
import { Input } from '../../../components/ui/input';
import { cn } from '../../../lib/utils';
import { useLabelManagementStore } from '../../settings/stores/label-management.store';
import { useNotePreferencesStore, type NoteColor } from '../../settings/stores/note-preferences.store';
import type { SharedNoteItem } from '../api/notes.api';

const noteColorClasses: Record<NoteColor, string> = {
  default: 'bg-white dark:bg-slate-900',
  yellow: 'bg-amber-50 dark:bg-amber-950/20',
  green: 'bg-emerald-50 dark:bg-emerald-950/20',
  blue: 'bg-sky-50 dark:bg-sky-950/20',
  pink: 'bg-rose-50 dark:bg-rose-950/20',
  purple: 'bg-violet-50 dark:bg-violet-950/20',
};

type ViewMode = 'grid' | 'list';

type DisplayNote = Note | SharedNoteItem;

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
  const { data: sharedNotes } = useSharedNotes();
  const createNoteMutation = useCreateNote();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
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
      setSelectedLabel(null);
    });
    const newNote = await createNoteMutation.mutateAsync({ title: 'Untitled Note', content: '' });
    onSelectNote(newNote.id || '');
  };

  const matchesNote = (note: DisplayNote) => {
    if (!debouncedSearch) {
      return selectedLabel ? (note.labels || []).includes(selectedLabel) : true;
    }

    const searchableText = `${note.title} ${stripHtml(note.content)}`.toLowerCase();
    const matchesSearch = searchableText.includes(debouncedSearch);
    const matchesLabel = selectedLabel ? (note.labels || []).includes(selectedLabel) : true;
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
  }, [debouncedSearch, notes, selectedLabel]);

  const filteredSharedNotes = useMemo(() => {
    const visibleNotes = sharedNotes ?? [];

    return visibleNotes.filter(matchesNote);
  }, [debouncedSearch, selectedLabel, sharedNotes]);

  const isGridView = viewMode === 'grid';

  useEffect(() => {
    if ((notes?.length ?? 0) > 0 && labels.length === 0) {
      syncLabels((notes ?? []).flatMap((note) => note.labels || []));
    }
  }, [labels.length, notes, syncLabels]);

  useEffect(() => {
    if (selectedLabel && !labels.includes(selectedLabel)) {
      setSelectedLabel(null);
    }
  }, [labels, selectedLabel]);

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
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <Button
                size="sm"
                variant={selectedLabel === null ? 'default' : 'outline'}
                onClick={() => setSelectedLabel(null)}
                aria-pressed={selectedLabel === null}
                className="rounded-full"
              >
                All
              </Button>
              {labels.map((label) => (
                <Button
                  key={label}
                  size="sm"
                  variant={selectedLabel === label ? 'default' : 'outline'}
                  onClick={() => setSelectedLabel((current) => (current === label ? null : label))}
                  aria-pressed={selectedLabel === label}
                  className="rounded-full"
                >
                  {label}
                </Button>
              ))}
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
                    onSelect={() => {
                      if (isSelectionMode) {
                        const newSet = new Set(selectedNotesIds);
                        if (newSet.has(note.id || '')) {
                          newSet.delete(note.id || '');
                        } else {
                          newSet.add(note.id || '');
                        }
                        setSelectedNotesIds(newSet);
                      } else {
                        onSelectNote(note.id || '');
                      }
                    }}
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
                        onSelect={() => {
                          if (isSelectionMode) {
                            const newSet = new Set(selectedNotesIds);
                            if (newSet.has(note.id || '')) {
                              newSet.delete(note.id || '');
                            } else {
                              newSet.add(note.id || '');
                            }
                            setSelectedNotesIds(newSet);
                          } else {
                            onSelectNote(note.id || '');
                          }
                        }}
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
    </div>
  );
}

const NoteCard = memo(function NoteCard({
  note,
  isSelected,
  onSelect,
  isGridView,
  isSelectionMode,
  isSelectedForBulk,
}: {
  note: DisplayNote;
  isSelected: boolean;
  onSelect: () => void;
  isGridView: boolean;
  isSelectionMode?: boolean;
  isSelectedForBulk?: boolean;
}) {
  const update = useUpdateNote(note.id || '');
  const isSharedAccess = 'accessMode' in note && note.accessMode === 'shared';
  const noteColor = useNotePreferencesStore((state) => state.noteColor);
  const colorClass = noteColorClasses[noteColor] || '';

  const handleTogglePin = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await update.mutateAsync({ isPinned: !note.isPinned });
    } catch {
      // noop - optimistic updates handled by mutation
    }
  };

  const handleToggleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      await update.mutateAsync({ isShared: !note.isShared });
    } catch {
      // noop - optimistic updates handled by mutation
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onClick={onSelect}
      className={cn(
        'note-item group overflow-hidden rounded-2xl border border-border/70 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(15,23,42,0.08)] focus:outline-none focus:ring-2 focus:ring-primary/20',
        isGridView ? 'w-64 max-w-full justify-self-center' : 'w-full',
        colorClass,
        isSelected ? 'border-primary/70 ring-2 ring-primary/20' : 'hover:border-primary/20',
        'p-4',
      )}
    >
      <div className={cn('flex items-start gap-3', isGridView ? 'flex-col' : 'flex-row')}>
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10', isSelected && 'bg-primary/15', isGridView && 'mx-auto')}>
          {isSelectionMode ? (
            <div className={cn("h-5 w-5 rounded border-2 flex items-center justify-center transition-colors", isSelectedForBulk ? "bg-primary border-primary" : "border-primary/50")}>
              {isSelectedForBulk && <Check className="h-3 w-3 text-primary-foreground" />}
            </div>
          ) : (
            <FileText className={cn('h-4 w-4', isSelected ? 'text-primary' : 'text-muted-foreground')} />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className={cn('flex items-start justify-between gap-3', isGridView && 'flex-col') }>
            <div className={cn('min-w-0 flex flex-1 items-center gap-2', isGridView && 'w-full')}>
              <span className={cn('min-w-0 flex-1 font-semibold text-foreground', isGridView ? 'line-clamp-2 text-base leading-snug' : 'truncate')}>
                {note.title}
              </span>
              {note.isPinned ? <Pin className="h-3.5 w-3.5 shrink-0 text-amber-500" /> : null}
              {note.isProtected ? <Lock className="h-3.5 w-3.5 shrink-0 text-rose-500" /> : null}
              {note.isShared ? <Share2 className="h-3.5 w-3.5 shrink-0 text-sky-500" /> : null}
            </div>

            <div className={cn('flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100', isGridView && 'self-end')}>
              {isSharedAccess ? null : (
                <button
                  type="button"
                  aria-label={note.isShared ? 'Unshare note' : 'Share note'}
                  aria-pressed={note.isShared}
                  onClick={handleToggleShare}
                  className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Share2 className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                aria-label={note.isPinned ? 'Unpin note' : 'Pin note'}
                aria-pressed={note.isPinned}
                onClick={handleTogglePin}
                className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                disabled={isSharedAccess}
              >
                <Pin className="h-4 w-4" />
              </button>
            </div>
          </div>

          <p className={cn('mt-1 break-words text-sm leading-6 text-muted-foreground', isGridView ? 'line-clamp-4 text-[0.92rem]' : 'line-clamp-2')}>
            {formatPreview(note.content)}
          </p>

          {'accessMode' in note && note.accessMode === 'shared' ? (
            <p className={cn('text-xs text-muted-foreground', isGridView && 'line-clamp-2')}>
              Shared by {note.sharedBy.displayName} · {note.sharedPermission === 'EDIT' ? 'Can edit' : 'Read only'}
            </p>
          ) : null}

          <div className="flex max-w-full flex-wrap items-center gap-2">
            {(note.labels || []).map((label: string) => (
              <span key={label} className="max-w-full truncate rounded-full bg-card/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground shadow-sm">
                {label}
              </span>
            ))}
          </div>

          <div className={cn('flex items-center justify-between pt-1 text-xs text-muted-foreground', isGridView && 'pt-2')}>
            <span>{new Date(note.updatedAt || 0).toLocaleDateString()}</span>
            <span>{new Date(note.updatedAt || 0).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      </div>
    </div>
  );
});
