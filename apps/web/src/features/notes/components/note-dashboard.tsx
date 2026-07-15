import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { NoteList } from './note-list';
import { NoteDetailView } from './note-detail-view';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';

type ViewMode = 'grid' | 'list';

export function NoteDashboard() {
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const navigate = useNavigate();
  const params = useParams();

  useEffect(() => {
    const routeNoteId = params.noteId ?? null;
    if (routeNoteId && routeNoteId !== selectedNoteId) {
      setSelectedNoteId(routeNoteId);
      return;
    }
    if (!routeNoteId && selectedNoteId !== null) {
      setSelectedNoteId(null);
    }
  }, [params.noteId, selectedNoteId]);

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] gap-4 animate-in fade-in duration-300">
      <div className="flex-1 min-h-0 overflow-hidden sm:rounded-2xl border-0 sm:border border-border/50 bg-transparent sm:bg-card/45 backdrop-blur-none sm:backdrop-blur-md shadow-none sm:shadow-sm">
        {selectedNoteId ? (
          /* Single-Pane Editor Stack (Full Page) */
          <div className="flex h-full w-full flex-col overflow-hidden bg-background/30 animate-in slide-in-from-right duration-300">
            <div className="border-b bg-card/90 px-4 py-3 flex items-center shrink-0">
              <Button
                type="button"
                variant="ghost"
                className="rounded-full hover:bg-muted text-muted-foreground hover:text-foreground -ml-2"
                onClick={() => navigate('/notes')}
              >
                <ChevronLeft className="mr-1 h-5 w-5" />
                Back to Notes
              </Button>
              <span className="ml-3 font-semibold text-sm text-foreground truncate">Note Editor</span>
            </div>
            <div className="min-h-0 flex-1 flex flex-col overflow-hidden">
              <NoteDetailView
                noteId={selectedNoteId}
                onDeleted={() => {
                  setSelectedNoteId(null);
                  navigate('/notes');
                }}
              />
            </div>
          </div>
        ) : (
          /* Single-Pane Notes List Stack (Full Page) */
          <div className="h-full w-full overflow-hidden animate-in slide-in-from-left duration-300">
            <NoteList
              selectedNoteId={selectedNoteId}
              onSelectNote={(id) => {
                navigate(`/notes/${id}`);
              }}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
          </div>
        )}
      </div>
    </div>
  );
}
