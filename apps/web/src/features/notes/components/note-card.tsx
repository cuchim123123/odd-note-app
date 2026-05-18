import { memo } from 'react';
import { useUpdateNote } from '../api/notes.api';
import type { SharedNoteItem } from '../api/notes.api';
import type { Note } from '@odd-note-app/validation';
import { FileText, Lock, Pin, Share2, Check } from 'lucide-react';
import { cn } from '../../../lib/utils';

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
  return plainText.length > 50 ? `${plainText.slice(0, 50)}…` : plainText;
}

type NoteCardProps = {
  note: DisplayNote;
  isSelected: boolean;
  onSelect: (id: string) => void;
  isGridView: boolean;
  isSelectionMode?: boolean;
  isSelectedForBulk?: boolean;
};

const NoteCardComponent = function NoteCard({
  note,
  isSelected,
  onSelect,
  isGridView,
  isSelectionMode,
  isSelectedForBulk,
}: NoteCardProps) {
  const update = useUpdateNote(note.id || '');
  const isSharedAccess = 'accessMode' in note && note.accessMode === 'shared';

  const handleTogglePin = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await update.mutateAsync({ isPinned: !note.isPinned });
    } catch {
      // noop
    }
  };

  const handleToggleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await update.mutateAsync({ isShared: !note.isShared });
    } catch {
      // noop
    }
  };

  const handleSelect = () => {
    if (note.id) {
      onSelect(note.id);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSelect();
    }
  };

  const hasContent = !!stripHtml(note.content);

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onClick={handleSelect}
      className={cn(
        'group relative overflow-hidden rounded-2xl border text-left transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary/20',
        isGridView ? 'w-full min-h-[11rem] flex flex-col justify-between' : 'w-full flex flex-col justify-between min-h-[6.5rem]',
        isSelected
          ? 'border-primary bg-primary/10 shadow-lg shadow-primary/5 ring-1 ring-primary/20 scale-[1.01]'
          : 'border-border/30 bg-card hover:bg-card/90 hover:border-primary/30 hover:shadow-lg hover:-translate-y-0.5',
        'p-4 animate-in fade-in slide-in-from-bottom-2 duration-300',
      )}
    >
      <div className="flex flex-col gap-2.5 h-full justify-between">
        <div className="space-y-2">
          {/* Header row: Icon & Title & Badges */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-300',
                isSelected ? 'bg-primary/20 text-primary' : 'bg-primary/5 text-primary/80 group-hover:bg-primary/10 group-hover:text-primary'
              )}>
                {isSelectionMode ? (
                  <div className={cn("h-4.5 w-4.5 rounded border flex items-center justify-center transition-colors", isSelectedForBulk ? "bg-primary border-primary" : "border-primary/50")}>
                    {isSelectedForBulk && <Check className="h-3 w-3 text-primary-foreground" />}
                  </div>
                ) : (
                  <FileText className="h-4.5 w-4.5" />
                )}
              </div>
              
              <span className={cn(
                'font-semibold text-foreground line-clamp-2 whitespace-normal break-words text-sm tracking-tight flex-1',
                isSelected && 'text-primary'
              )}>
                {note.title || 'Untitled Note'}
              </span>
            </div>

            {/* Float actions on hover */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              {isSharedAccess ? null : (
                <button
                  type="button"
                  aria-label={note.isShared ? 'Unshare note' : 'Share note'}
                  aria-pressed={note.isShared}
                  onClick={handleToggleShare}
                  className="rounded-full p-1 text-muted-foreground/60 transition-colors hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground"
                >
                  <Share2 className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                aria-label={note.isPinned ? 'Unpin note' : 'Pin note'}
                aria-pressed={note.isPinned}
                onClick={handleTogglePin}
                className="rounded-full p-1 text-muted-foreground/60 transition-colors hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground"
                disabled={isSharedAccess}
              >
                <Pin className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Subtext description preview */}
          <p className={cn(
            "text-xs leading-relaxed line-clamp-2 overflow-hidden",
            hasContent ? "text-muted-foreground/90 group-hover:text-slate-300 transition-colors duration-200" : "text-muted-foreground/30 italic font-light"
          )}>
            {formatPreview(note.content)}
          </p>
        </div>

        <div className="space-y-2">
          {/* Label Pills */}
          {(note.labels || []).length > 0 && (
            <div className="flex max-w-full flex-wrap gap-1">
              {(note.labels || []).slice(0, 3).map((label: string) => (
                <span 
                  key={label} 
                  className="max-w-[7.5rem] truncate rounded-lg border border-primary/10 bg-primary/5 px-2 py-0.5 text-[10px] font-semibold text-primary/90 tracking-wide"
                >
                  {label}
                </span>
              ))}
              {(note.labels || []).length > 3 && (
                <span className="rounded-lg border border-border/30 bg-muted/40 px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground/80">
                  +{(note.labels || []).length - 3}
                </span>
              )}
            </div>
          )}

          {/* Access status overlay for shared notes */}
          {isSharedAccess && (
            <div className="text-[10px] text-muted-foreground border-t border-border/10 pt-1.5 truncate">
              Shared by <span className="font-semibold text-foreground/80">{(note as SharedNoteItem).sharedBy.displayName}</span>
            </div>
          )}

          {/* Footer Metadata */}
          <div className="flex items-center justify-between border-t border-border/10 pt-2 text-[10px] font-medium text-muted-foreground/50 shrink-0">
            <div className="flex items-center gap-1.5">
              <span>{new Date(note.updatedAt || 0).toLocaleDateString()}</span>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
              <span>{new Date(note.updatedAt || 0).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            
            {/* Corner Badge Icons */}
            <div className="flex items-center gap-1">
              {note.isPinned && <Pin className="h-3 w-3 text-amber-500 fill-amber-500/20" />}
              {note.isProtected && <Lock className="h-3 w-3 text-rose-500" />}
              {note.isShared && !isSharedAccess && <Share2 className="h-3 w-3 text-sky-500" />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const noteCardAreEqual = (prevProps: NoteCardProps, nextProps: NoteCardProps) => {
  return (
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isGridView === nextProps.isGridView &&
    prevProps.isSelectionMode === nextProps.isSelectionMode &&
    prevProps.isSelectedForBulk === nextProps.isSelectedForBulk &&
    prevProps.note.id === nextProps.note.id &&
    prevProps.note.title === nextProps.note.title &&
    prevProps.note.content === nextProps.note.content &&
    prevProps.note.updatedAt === nextProps.note.updatedAt &&
    prevProps.note.isPinned === nextProps.note.isPinned &&
    prevProps.note.isProtected === nextProps.note.isProtected &&
    prevProps.note.isShared === nextProps.note.isShared &&
    (prevProps.note.labels || []).join(',') === (nextProps.note.labels || []).join(',')
  );
};

export const NoteCard = memo(NoteCardComponent, noteCardAreEqual);
