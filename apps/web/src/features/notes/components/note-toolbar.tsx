import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { Trash2, Check, Loader2, AlertTriangle, Pin, ImagePlus, Lock, Share2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { Note } from '@odd-note-app/validation';

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
}) {
  const saveStatus: SaveStatus = (() => {
    if (saveError) return { icon: AlertTriangle, label: saveError, tone: 'text-destructive' as const };
    if (isSaving) return { icon: Loader2, label: 'Autosaving…', tone: 'text-muted-foreground' as const };
    if (isDirty) return { icon: Loader2, label: 'Pending…', tone: 'text-muted-foreground' as const };
    return { icon: Check, label: lastSavedAt ? `Saved ${new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Saved', tone: 'text-emerald-600' as const };
  })();

  const realtimeLabel = isCollaborativeNote ? (isWsConnected ? presenceParticipants.length > 0 ? `Watching · ${presenceParticipants.length}` : 'Connected' : 'Offline') : 'Off';
  const realtimeTone = isCollaborativeNote && isWsConnected ? 'text-emerald-600' : 'text-muted-foreground';

  const IconStatus = saveStatus.icon;

  return (
    <div className="border-b border-border/70 bg-gradient-to-r from-slate-50 to-white px-4 py-4 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <Input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            className="h-auto border-border/60 bg-white px-4 py-3 text-2xl font-semibold shadow-sm focus-visible:border-primary"
            placeholder="Title…"
            readOnly={!canEditContent}
          />
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <IconStatus className={cn('h-3.5 w-3.5', saveStatus.tone, isSaving && 'animate-spin')} />
            <span className={cn('font-medium', saveStatus.tone)}>{saveStatus.label}</span>
            <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-medium shadow-sm', realtimeTone === 'text-emerald-600' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-border/70 bg-background text-muted-foreground')}>
              <span className={cn('h-1.5 w-1.5 rounded-full', isCollaborativeNote && isWsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/40')} />
              Realtime · {realtimeLabel}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {note.isPinned && <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 shadow-sm"><Pin className="h-3 w-3" />Pinned</span>}
            {note.isProtected && <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-700 shadow-sm"><Lock className="h-3 w-3" />Protected</span>}
            {isSharedNote && <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-700 shadow-sm"><Share2 className="h-3 w-3" />Shared</span>}
          </div>
        </div>

        <div className="flex items-center gap-2 self-start">
          {canManageShares && <Button type="button" size="sm" variant="outline" onClick={onOpenSharing}><Share2 className="mr-2 h-4 w-4" />Share</Button>}
          <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" />
          <Button size="sm" variant="ghost" onClick={() => imageInputRef.current?.click()} disabled={isSaving || !canEditContent}><ImagePlus className="w-4 h-4" /></Button>
          <Button size="sm" variant="ghost" onClick={() => onOpenProtection(note.isProtected ? 'remove' : 'protect')} disabled={isSaving || !canEditContent || isSharedNote}><Lock className="w-4 h-4" /></Button>
          <Button size="sm" variant="ghost" onClick={onPin} disabled={isSaving || !canEditContent || isSharedNote}><Pin className="w-4 h-4" /></Button>
          <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={onDelete} disabled={!canEditContent || isSharedNote}><Trash2 className="w-4 h-4" /></Button>
        </div>
      </div>
    </div>
  );
}
