import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { Trash2, Check, Loader2, AlertTriangle, Pin, ImagePlus, Lock, Share2, Tag, X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { Note } from '@odd-note-app/validation';
import { LabelSelector } from './label-selector';

type SaveStatus = { icon: typeof Check; label: string; tone: 'text-destructive' | 'text-muted-foreground' | 'text-emerald-600' };

export function NoteToolbar({
  note,
  title,
  onTitleChange,
  isDirty,
  isSaving,
  lastSavedAt,
  saveError,
  isCollaborativeNote,
  isWsConnected,
  presenceParticipants,
  canEditContent,
  canManageShares,
  imageInputRef,
  onOpenSharing,
  onOpenProtection,
  onPin,
  onDelete,
  isSharedNote,
  onToggleLabel,
  onOpenLabelManagement,
  onSaveTitle,
}: {
  note: Note;
  title: string;
  onTitleChange: (title: string) => void;
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: string | null;
  saveError: string | null;
  isCollaborativeNote: boolean;
  isWsConnected: boolean;
  presenceParticipants: Array<{ userId: string; displayName: string; color: string }>;
  canEditContent: boolean;
  canManageShares: boolean;
  imageInputRef: React.RefObject<HTMLInputElement>;
  onOpenSharing: () => void;
  onOpenProtection: (mode: 'protect' | 'remove') => void;
  onPin: () => void;
  onDelete: () => void;
  isSharedNote: boolean;
  onToggleLabel: (label: string) => void;
  onOpenLabelManagement: () => void;
  onSaveTitle: () => void;
}) {
  const isTitleDirty = title !== note.title;

  const saveStatus: SaveStatus = (() => {
    if (!canEditContent) return { icon: Lock, label: 'Read Only', tone: 'text-muted-foreground' as const };
    if (saveError) return { icon: AlertTriangle, label: saveError, tone: 'text-destructive' as const };
    if (isSaving) return { icon: Loader2, label: 'Saving…', tone: 'text-muted-foreground' as const };
    if (isDirty) return { icon: Loader2, label: 'Pending…', tone: 'text-muted-foreground' as const };
    return { icon: Check, label: lastSavedAt ? `Saved ${new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Saved', tone: 'text-emerald-600' as const };
  })();

  const realtimeLabel = isCollaborativeNote ? (isWsConnected ? (presenceParticipants.length > 0 ? `Watching · ${presenceParticipants.length}` : 'Connected') : 'Offline') : (isSharedNote ? 'View Only' : 'Off');
  const realtimeTone = isCollaborativeNote && isWsConnected ? 'text-emerald-600' : 'text-muted-foreground';


  const IconStatus = saveStatus.icon;

  return (
    <div className="border-b bg-muted/50 px-4 py-4 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Input
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              className="h-auto border-border/60 bg-card px-4 py-3 text-2xl font-semibold shadow-sm focus-visible:border-primary"
              placeholder="Title…"
              readOnly={!canEditContent}
            />
            {isTitleDirty && (
              <Button 
                size="sm" 
                onClick={onSaveTitle} 
                disabled={isSaving || !title.trim()}
                className="rounded-xl shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95"
              >
                <Check className="mr-1.5 h-4 w-4" />
                Save Title
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <IconStatus className={cn('h-3.5 w-3.5', saveStatus.tone, isSaving && 'animate-spin')} />
            <span className={cn('font-medium', saveStatus.tone)}>{saveStatus.label}</span>
            <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-medium shadow-sm', realtimeTone === 'text-emerald-600' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'border-border/70 bg-background text-muted-foreground')}>
              <span className={cn('h-1.5 w-1.5 rounded-full', isCollaborativeNote && isWsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/40')} />
              Realtime · {realtimeLabel}
            </span>
            
            {/* Active Labels List */}
            {note.labels && note.labels.length > 0 && (
              <div className="flex flex-wrap gap-1.5 ml-2 border-l pl-3 border-border/60">
                {note.labels.map((label) => (
                  <span 
                    key={label} 
                    className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary dark:bg-primary/20"
                  >
                    <Tag className="h-2.5 w-2.5" />
                    {label}
                    <button 
                      onClick={() => onToggleLabel(label)}
                      className="ml-0.5 rounded-full hover:bg-primary/20 p-0.5 transition-colors"
                      disabled={!canEditContent}
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {note.isPinned && <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 shadow-sm"><Pin className="h-3 w-3" />Pinned</span>}
            {note.isProtected && <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 shadow-sm"><Lock className="h-3 w-3" />Protected</span>}
            {isSharedNote && <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-[11px] font-medium text-sky-600 dark:text-sky-400 shadow-sm"><Share2 className="h-3 w-3" />Shared</span>}
          </div>
        </div>

        <div className="flex items-center gap-2 self-start">
          <LabelSelector 
            selectedLabels={note.labels || []} 
            onToggleLabel={onToggleLabel}
            onOpenManagement={onOpenLabelManagement}
            disabled={!canEditContent}
          />
          <div className="w-px h-6 bg-border/60 mx-1" />
          {canManageShares && <Button type="button" size="sm" variant="outline" onClick={onOpenSharing}><Share2 className="mr-2 h-4 w-4" />Share</Button>}
          <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" />
          <Button size="sm" variant="ghost" onClick={() => imageInputRef.current?.click()} disabled={isSaving || !canEditContent}><ImagePlus className="w-4 h-4" /></Button>
          <Button size="sm" variant="ghost" onClick={() => onOpenProtection(note.isProtected ? 'remove' : 'protect')} disabled={isSaving || !canEditContent || !canManageShares}><Lock className="w-4 h-4" /></Button>
          <Button size="sm" variant="ghost" onClick={onPin} disabled={isSaving || !canEditContent || !canManageShares}><Pin className="w-4 h-4" /></Button>
          <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={onDelete} disabled={!canEditContent || !canManageShares}><Trash2 className="w-4 h-4" /></Button>
        </div>
      </div>
    </div>
  );
}
