import { useState } from 'react';
import { X, Tag, Trash2, Edit2, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLabelManagementStore } from '@/features/settings/stores/label-management.store';
import { useRenameLabel, useDeleteLabel } from '@/features/notes/api/notes.api';

type LabelManagementModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function LabelManagementModal({ isOpen, onClose }: LabelManagementModalProps) {
  const labels = useLabelManagementStore((state) => state.labels);
  const renameLabelLocal = useLabelManagementStore((state) => state.renameLabel);
  const deleteLabelLocal = useLabelManagementStore((state) => state.deleteLabel);

  const renameLabelMutation = useRenameLabel();
  const deleteLabelMutation = useDeleteLabel();

  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border bg-card shadow-2xl flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold tracking-tight">Manage Labels</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {labels.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Tag className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <p className="text-muted-foreground font-medium">No labels found.</p>
              <p className="text-sm text-muted-foreground/60">Create labels inside your notes to organize them.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {labels.map((label) => {
                const draftValue = renameDrafts[label] ?? label;
                const isRenaming = renameLabelMutation.isPending && renameLabelMutation.variables?.oldName === label;
                const isDeleting = deleteLabelMutation.isPending && deleteLabelMutation.variables === label;

                return (
                  <div key={label} className="group flex flex-col gap-2 rounded-2xl border bg-muted/30 p-4 transition-all hover:bg-muted/50">
                    <div className="flex flex-1 items-center gap-3">
                      <Input
                        value={draftValue}
                        onChange={(e) => setRenameDrafts((prev) => ({ ...prev, [label]: e.target.value }))}
                        className="bg-background/50 focus-visible:ring-primary/20"
                        disabled={isRenaming || isDeleting}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isRenaming || isDeleting || draftValue.trim() === label || !draftValue.trim()}
                        onClick={async () => {
                          setError(null);
                          try {
                            await renameLabelMutation.mutateAsync({ oldName: label, newName: draftValue.trim() });
                            renameLabelLocal(label, draftValue.trim());
                            setRenameDrafts((prev) => {
                              const next = { ...prev };
                              delete next[label];
                              return next;
                            });
                          } catch {
                            setError('Failed to rename label.');
                          }
                        }}
                      >
                        {isRenaming ? <Edit2 className="h-3 w-3 animate-pulse" /> : <Check className="h-3 w-3 mr-1" />}
                        Rename
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={isRenaming || isDeleting}
                        onClick={async () => {
                          setError(null);
                          try {
                            await deleteLabelMutation.mutateAsync(label);
                            deleteLabelLocal(label);
                          } catch {
                            setError('Failed to delete label.');
                          }
                        }}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {error && (
          <div className="px-6 py-2 bg-destructive/10 flex items-center gap-2 text-xs text-destructive">
            <AlertCircle className="h-3 w-3" />
            {error}
          </div>
        )}

        <div className="border-t px-6 py-4 bg-muted/20">
          <Button className="w-full rounded-xl" onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  );
}
