import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { NoteList } from './note-list';
import { NoteDetailView } from './note-detail-view';
import { Button } from '../../../components/ui/button';
import { ChevronLeft, Sparkles, BookOpen, PenTool } from 'lucide-react';
import { useCreateNote } from '../api/notes.api';

type ViewMode = 'grid' | 'list';

export function NoteDashboard() {
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') {
      return true;
    }
    return window.matchMedia('(min-width: 1024px)').matches;
  });
  const navigate = useNavigate();
  const params = useParams();
  const createNoteMutation = useCreateNote();

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
      return;
    }
    if (!routeNoteId && selectedNoteId !== null) {
      setSelectedNoteId(null);
    }
  }, [params.noteId, selectedNoteId]);

  const handleCreateFromWelcome = async () => {
    const newNote = await createNoteMutation.mutateAsync({ title: 'Untitled Note', content: '' });
    navigate(`/notes/${newNote.id}`);
  };

  return (
    <div className="flex h-[calc(100vh-8.5rem)] flex-col gap-4 animate-in fade-in duration-300">
      {/* Page Title Header (visible on mobile only, as on desktop the sidebar lists it nicely) */}
      <div className="flex flex-col gap-1 lg:hidden">
        <h1 className="text-2xl font-bold tracking-tight">Your notes</h1>
        <p className="text-xs text-muted-foreground">
          Filter and edit notes instantly.
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden rounded-2xl border border-border/50 bg-card/45 backdrop-blur-md shadow-sm">
        {isDesktop ? (
          /* Multi-Pane Workspace Layout for Desktop */
          <div className="flex h-full w-full overflow-hidden">
            {/* Left Column Pane: Notes Sidebar List (Always visible) */}
            <div className="w-[23rem] xl:w-[25rem] shrink-0 border-r border-border/40 h-full overflow-hidden">
              <NoteList
                selectedNoteId={selectedNoteId}
                onSelectNote={(id) => navigate(`/notes/${id}`)}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
              />
            </div>

            {/* Right Column Pane: Active Editor Workspace */}
            <div className="flex-1 h-full overflow-hidden bg-background/30">
              {selectedNoteId ? (
                <div className="flex h-full w-full flex-col overflow-hidden animate-in fade-in duration-300">
                  <div className="min-h-0 flex-1 overflow-y-auto">
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
                /* Premium Dynamic Welcome Placeholder Card */
                <div className="flex h-full w-full flex-col items-center justify-center p-12 text-center bg-gradient-to-br from-background via-muted/5 to-background animate-in fade-in duration-500">
                  <div className="relative group mb-6">
                    <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-primary/30 to-purple-500/30 opacity-75 blur-lg transition duration-1000 group-hover:opacity-100 group-hover:duration-200 animate-pulse"></div>
                    <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-card border border-border shadow-md group-hover:scale-105 transition-transform duration-300">
                      <BookOpen className="h-9 w-9 text-primary" />
                    </div>
                    <div className="absolute top-0 right-0 rounded-full bg-primary/20 p-1.5 text-primary border border-primary/10">
                      <Sparkles className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold tracking-tight text-foreground max-w-sm">
                    No Note Selected
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground max-w-sm leading-relaxed">
                    Select a note from the left sidebar to start editing, or create a brand new one to begin typing.
                  </p>
                  <Button
                    type="button"
                    onClick={handleCreateFromWelcome}
                    disabled={createNoteMutation.isPending}
                    className="mt-6 rounded-2xl h-11 px-6 bg-primary text-primary-foreground font-semibold shadow-md shadow-primary/10 hover:shadow-lg hover:shadow-primary/20 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
                  >
                    <PenTool className="mr-2 h-4 w-4" />
                    {createNoteMutation.isPending ? 'Creating note...' : 'Create New Note'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Mobile Single-Pane Stack View (Natural stacks, clean back button) */
          <div className="h-full w-full overflow-hidden">
            {selectedNoteId ? (
              /* Mobile Editor Stack */
              <div className="flex h-full w-full flex-col overflow-hidden bg-background animate-in slide-in-from-right duration-300">
                <div className="border-b bg-card/90 px-4 py-3 flex items-center shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    className="rounded-full hover:bg-muted text-muted-foreground hover:text-foreground -ml-2"
                    onClick={() => navigate('/notes')}
                  >
                    <ChevronLeft className="mr-1 h-5 w-5" />
                    Back
                  </Button>
                  <span className="ml-3 font-semibold text-sm text-foreground truncate">Note Editor</span>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">
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
              /* Mobile List Stack */
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
        )}
      </div>
    </div>
  );
}
