import { useState } from 'react';
import { X, Tag, Trash2, Edit2, Check, AlertCircle, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLabelManagementStore } from '@/features/settings/stores/label-management.store';
import { useRenameLabel, useDeleteLabel } from '@/features/notes/api/notes.api';

type LabelFilterModalProps = {
  isOpen: boolean;
  onClose: () => void;
  selectedLabels: string[];
  onToggleLabel: (label: string) => void;
  onClearSelection: () => void;
  onSelectAll: () => void;
};

export function LabelFilterModal({
  isOpen,
  onClose,
  selectedLabels,
  onToggleLabel,
  onClearSelection,
  onSelectAll,
}: LabelFilterModalProps) {
  const labels = useLabelManagementStore((state) => state.labels);
  const addLabelLocal = useLabelManagementStore((state) => state.addLabel);
  const renameLabelLocal = useLabelManagementStore((state) => state.renameLabel);
  const deleteLabelLocal = useLabelManagementStore((state) => state.deleteLabel);

  const renameLabelMutation = useRenameLabel();
  const deleteLabelMutation = useDeleteLabel();

  const [activeTab, setActiveTab] = useState<'select' | 'manage'>('select');
  const [newLabelName, setNewLabelName] = useState('');
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredLabels = labels.filter((label) =>
    label.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  const handleCreateLabel = () => {
    const trimmed = newLabelName.trim();
    if (!trimmed) return;
    if (labels.includes(trimmed)) {
      setError('Label already exists.');
      return;
    }
    setError(null);
    addLabelLocal(trimmed);
    setNewLabelName('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border bg-card shadow-2xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold tracking-tight">Labels</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Custom Premium Tabs switcher */}
        <div className="border-b bg-muted/30 px-6 py-2 flex gap-2">
          <Button
            type="button"
            variant={activeTab === 'select' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => { setActiveTab('select'); setError(null); }}
            className="flex-1 rounded-full text-xs font-semibold uppercase tracking-wider h-8"
          >
            Filter Notes
          </Button>
          <Button
            type="button"
            variant={activeTab === 'manage' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => { setActiveTab('manage'); setError(null); }}
            className="flex-1 rounded-full text-xs font-semibold uppercase tracking-wider h-8"
          >
            Manage Labels
          </Button>
        </div>

        {/* Tab 1: Select/Filter Labels */}
        {activeTab === 'select' && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Search and Quick controls */}
            <div className="p-4 border-b space-y-3 bg-muted/10">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search labels..."
                  className="pl-9 h-9 text-sm rounded-xl focus-visible:ring-primary/20"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex justify-between items-center gap-2 text-xs">
                <span className="text-muted-foreground font-medium">
                  {selectedLabels.length} selected
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="p-0 h-auto text-primary text-xs hover:no-underline font-semibold"
                    onClick={onSelectAll}
                  >
                    Select All
                  </Button>
                  <span className="text-muted-foreground/30">|</span>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="p-0 h-auto text-muted-foreground hover:text-primary text-xs hover:no-underline font-semibold"
                    onClick={onClearSelection}
                  >
                    Clear All
                  </Button>
                </div>
              </div>
            </div>

            {/* Labels checkbox list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
              {filteredLabels.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground font-medium">
                  {searchQuery ? 'No matching labels found.' : 'No labels available.'}
                </div>
              ) : (
                filteredLabels.map((label) => {
                  const isChecked = selectedLabels.includes(label);
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => onToggleLabel(label)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border text-sm transition-all text-left ${
                        isChecked
                          ? 'border-primary bg-primary/5 text-primary font-semibold shadow-sm'
                          : 'border-border/60 hover:bg-muted/40 text-foreground'
                      }`}
                    >
                      <span className="truncate pr-4">{label}</span>
                      <div className={`h-5 w-5 rounded-md border flex items-center justify-center transition-all ${
                        isChecked ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/30'
                      }`}>
                        {isChecked && <Check className="h-3.5 w-3.5 stroke-[3px]" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Manage Labels */}
        {activeTab === 'manage' && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Create Label Row */}
            <div className="p-4 border-b bg-muted/10">
              <div className="flex gap-2">
                <Input
                  placeholder="New label name..."
                  className="rounded-xl focus-visible:ring-primary/20"
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateLabel()}
                />
                <Button onClick={handleCreateLabel} size="icon" className="rounded-xl shrink-0">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* List with editable items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {labels.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Tag className="h-8 w-8 text-muted-foreground/30 mb-2" />
                  <p className="text-sm font-medium text-muted-foreground">No labels available.</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Create one above to begin.</p>
                </div>
              ) : (
                labels.map((label) => {
                  const draftValue = renameDrafts[label] ?? label;
                  const isRenaming = renameLabelMutation.isPending && renameLabelMutation.variables?.oldName === label;
                  const isDeleting = deleteLabelMutation.isPending && deleteLabelMutation.variables === label;

                  return (
                    <div key={label} className="flex flex-col gap-2 rounded-2xl border bg-muted/20 p-4 transition-all hover:bg-muted/40">
                      <div className="flex items-center gap-3">
                        <Input
                          value={draftValue}
                          onChange={(e) => setRenameDrafts((prev) => ({ ...prev, [label]: e.target.value }))}
                          className="bg-background/80 focus-visible:ring-primary/20 h-9 rounded-xl text-sm"
                          disabled={isRenaming || isDeleting}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs font-semibold rounded-lg"
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
                          {isRenaming ? <Edit2 className="h-3 w-3 animate-pulse" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                          Rename
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive rounded-lg"
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
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Global Error Banner */}
        {error && (
          <div className="px-6 py-2 bg-destructive/10 flex items-center gap-2 text-xs text-destructive shrink-0">
            <AlertCircle className="h-3 w-3" />
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="border-t px-6 py-4 bg-muted/20 shrink-0">
          <Button className="w-full rounded-2xl font-semibold shadow-md shadow-primary/10" onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  );
}
