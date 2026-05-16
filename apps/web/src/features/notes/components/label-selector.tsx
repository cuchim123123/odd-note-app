import { useState, useRef, useEffect } from 'react';
import { Tag, Plus, Search, Check, X, Settings2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { useLabelManagementStore } from '../../settings/stores/label-management.store';
import { cn } from '../../../lib/utils';

type LabelSelectorProps = {
  selectedLabels: string[];
  onToggleLabel: (label: string) => void;
  onOpenManagement: () => void;
  disabled?: boolean;
};

export function LabelSelector({ selectedLabels, onToggleLabel, onOpenManagement, disabled }: LabelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  
  const allLabels = useLabelManagementStore((state) => state.labels);
  const addLabelLocal = useLabelManagementStore((state) => state.addLabel);

  const filteredLabels = allLabels.filter(label => 
    label.toLowerCase().includes(search.toLowerCase())
  );

  const canCreate = search.trim() !== '' && !allLabels.includes(search.trim());

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCreateAndToggle = () => {
    const newLabel = search.trim();
    if (newLabel) {
      addLabelLocal(newLabel);
      onToggleLabel(newLabel);
      setSearch('');
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "h-8 gap-2 rounded-full px-3 transition-all",
          isOpen ? "bg-primary/10 text-primary shadow-inner" : "hover:bg-muted"
        )}
      >
        <Tag className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Labels</span>
        {selectedLabels.length > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
            {selectedLabels.length}
          </span>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-full z-[60] mt-2 w-64 origin-top-right overflow-hidden rounded-2xl border bg-card p-1 shadow-2xl animate-in fade-in zoom-in duration-150">
          <div className="flex items-center gap-2 border-b bg-muted/30 p-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Search or create..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 border-none bg-transparent pl-8 text-sm focus-visible:ring-0"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canCreate) {
                    handleCreateAndToggle();
                  }
                }}
              />
            </div>
            {search && (
              <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={() => setSearch('')}>
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          <div className="max-h-60 overflow-y-auto p-1">
            {filteredLabels.length > 0 ? (
              filteredLabels.map((label) => {
                const isSelected = selectedLabels.includes(label);
                return (
                  <button
                    key={label}
                    onClick={() => onToggleLabel(label)}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors hover:bg-muted"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div className={cn(
                        "h-2 w-2 rounded-full",
                        isSelected ? "bg-primary" : "bg-muted-foreground/30"
                      )} />
                      <span className={cn(isSelected ? "font-semibold text-foreground" : "text-muted-foreground")}>
                        {label}
                      </span>
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                  </button>
                );
              })
            ) : !canCreate ? (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                No labels match your search.
              </div>
            ) : null}

            {canCreate && (
              <button
                onClick={handleCreateAndToggle}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-primary transition-colors hover:bg-primary/5"
              >
                <Plus className="h-4 w-4" />
                <span>Create "<span className="font-bold">{search}</span>"</span>
              </button>
            )}
          </div>

          <div className="border-t p-1 bg-muted/10">
            <button
              onClick={() => {
                onOpenManagement();
                setIsOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Manage all labels
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
