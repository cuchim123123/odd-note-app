import { memo } from 'react';
import { useUpdateNote } from '../api/notes.api';
import type { SharedNoteItem } from '../api/notes.api';
import type { Note } from '@odd-note-app/validation';
import { FileText, Lock, Pin, Share2, Check } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useNotePreferencesStore, type NoteColor } from '../../settings/stores/note-preferences.store';

const noteColorClasses: Record<NoteColor, string> = {
  default: 'bg-white dark:bg-slate-900',
  yellow: 'bg-amber-50 dark:bg-amber-950/20',
  green: 'bg-emerald-50 dark:bg-emerald-950/20',
  blue: 'bg-sky-50 dark:bg-sky-950/20',
  pink: 'bg-rose-50 dark:bg-rose-950/20',
  purple: 'bg-violet-50 dark:bg-violet-950/20',
};

type DisplayNote = Note | SharedNoteItem;

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

type NoteCardProps = {
  note: DisplayNote;
  isSelected: boolean;
  onSelect: () => void;
  isGridView: boolean;
  isSelectionMode?: boolean;
  isSelectedForBulk?: boolean;
};

export const NoteCard = memo(function NoteCard({
  note,
  isSelected,
  onSelect,
  isGridView,
  isSelectionMode,
  isSelectedForBulk,
}: NoteCardProps) {
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
