import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Grid2x2, List } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { NoteDetailView } from './note-detail-view';
import { NoteList } from './note-list';

type ViewMode = 'grid' | 'list';

/**
 * NoteDashboard: Main notes routing component
 * - Shows list view at /notes
 * - Shows detail view at /notes/:noteId
 * - Delegates rendering to focused sub-components
 */
export function NoteDashboard() {
  const navigate = useNavigate();
  const params = useParams<{ noteId?: string }>();
  const noteId = params.noteId;
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Handle window resize for responsive layout
  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Detail view: show editor
  if (noteId) {
    return (
      <div className="h-screen flex flex-col">
        <NoteDetailView
          noteId={noteId}
          onBack={() => navigate('/notes')}
        />
      </div>
    );
  }

  // List view: show all notes with grid/list toggle
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="border-b bg-white px-4 md:px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Notes</h1>
          <Button
            onClick={() => navigate('/notes/new')}
            size="sm"
          >
            <Plus className="mr-2 h-4 w-4" />
            New
          </Button>
        </div>

        {/* View mode toggle */}
        {!isMobileView && (
          <div className="flex gap-1 border rounded-lg p-1 bg-gray-100 w-fit">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <Grid2x2 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <NoteList
          viewMode={viewMode}
          onSelectNote={(id) => navigate(`/notes/${id}`)}
        />
      </div>
    </div>
  );
}
