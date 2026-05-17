import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { NoteList } from './note-list';
import { NoteDetailView } from './note-detail-view';
import { Button } from '../../../components/ui/button';
import { ChevronLeft } from 'lucide-react';

type ViewMode = 'grid' | 'list';

export function NoteDashboard() {
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [mobileView, setMobileView] = useState<'list' | 'editor'>('list');
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') {
      return true;
    }
    return window.matchMedia('(min-width: 1024px)').matches;
  });
  const navigate = useNavigate();
  const params = useParams();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const handleChange = (event: MediaQueryListEvent) => {
      setIsDesktop(event.matches);
    };

    setIsDesktop(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  useEffect(() => {
    const routeNoteId = params.noteId ?? null;
    if (routeNoteId && routeNoteId !== selectedNoteId) {
      setSelectedNoteId(routeNoteId);
      setMobileView('editor');
      return;
    }
    if (!routeNoteId && selectedNoteId !== null) {
      setSelectedNoteId(null);
      setMobileView('list');
    }
  }, [params.noteId, selectedNoteId]);

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Your notes</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Filter instantly by multiple labels, search text, and click any note card to open the editor.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-full border bg-background p-1 shadow-sm sm:hidden">
        <Button type="button" variant={mobileView === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => setMobileView('list')} className="flex-1 rounded-full">
          Notes
        </Button>
        <Button type="button" variant={mobileView === 'editor' ? 'default' : 'ghost'} size="sm" onClick={() => setMobileView('editor')} className="flex-1 rounded-full" disabled={!selectedNoteId}>
          Editor
        </Button>
      </div>

      {isDesktop ? (
        <div className="min-h-0 flex-1 overflow-hidden rounded-xl border bg-card shadow-sm">
          {selectedNoteId ? (
            <div className="relative flex h-full flex-1 flex-col overflow-hidden bg-background">
              <div className="border-b bg-card px-4 py-3">
                <Button type="button" variant="outline" className="rounded-full" onClick={() => navigate('/notes')}>
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Back to notes
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <NoteDetailView noteId={selectedNoteId} onDeleted={() => { setSelectedNoteId(null); navigate('/notes'); }} />
              </div>
            </div>
          ) : (
            <div className="w-full">
              <NoteList selectedNoteId={selectedNoteId} onSelectNote={(id) => { navigate(`/notes/${id}`); setSelectedNoteId(id); setMobileView('editor'); }} viewMode={viewMode} onViewModeChange={setViewMode} />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {mobileView === 'list' || !selectedNoteId ? (
            <div className="max-h-[calc(100dvh-16rem)] overflow-hidden rounded-xl border bg-card shadow-sm">
              <NoteList selectedNoteId={selectedNoteId} onSelectNote={(id) => { navigate(`/notes/${id}`); setSelectedNoteId(id); setMobileView('editor'); }} viewMode={viewMode} onViewModeChange={setViewMode} />
            </div>
          ) : null}
          {selectedNoteId && mobileView === 'editor' ? (
            <div className="space-y-3">
              <Button type="button" variant="outline" className="w-full rounded-full" onClick={() => navigate('/notes')}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back to notes
              </Button>
              <NoteDetailView noteId={selectedNoteId} onDeleted={() => { setSelectedNoteId(null); navigate('/notes'); }} />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
