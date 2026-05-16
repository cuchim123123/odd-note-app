import type { ReactNode } from 'react';
import type { Note } from '@odd-note-app/validation';

type SharedByProfile = {
  id: string;
  email: string;
  displayName: string;
};

export type ProtectedNote = Note & {
  accessMode?: 'owner' | 'shared';
  sharedPermission?: 'READ' | 'EDIT';
  sharedBy?: SharedByProfile;
};

type ProtectedNoteRouteProps = {
  note: ProtectedNote | null;
  isLoading: boolean;
  currentUserId: string | null;
  onUnauthorized: () => void;
  children: ReactNode;
};

/**
 * ProtectedNoteRoute: Guards access to notes based on ownership and shared permissions
 * - Owner: Full access
 * - Shared with EDIT: Can view and edit
 * - Shared with READ: Can view only
 * - No access: Redirect/show error
 */
export function ProtectedNoteRoute({
  note,
  isLoading,
  currentUserId,
  onUnauthorized,
  children,
}: ProtectedNoteRouteProps) {
  // Still loading
  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading…</div>;
  }

  // Note not found
  if (!note) {
    return (
      <div className="p-8 text-center space-y-2">
        <p className="text-muted-foreground">Note not found</p>
        <button
          onClick={onUnauthorized}
          className="text-blue-600 hover:underline text-sm"
        >
          Go back to notes
        </button>
      </div>
    );
  }

  // Check ownership and permissions
  const isOwner = note.accessMode === undefined || note.accessMode !== 'shared';
  const isSharedAccess = note.accessMode === 'shared';

  // Owner can access their own note
  if (isOwner) {
    return <>{children}</>;
  }

  // Shared access: check if user has permission
  if (isSharedAccess && note.sharedPermission) {
    // Both READ and EDIT can access (EDIT can do everything, READ can only view)
    return <>{children}</>;
  }

  // No valid access - show permission denied
  return (
    <div className="p-8 text-center space-y-4">
      <div className="space-y-2">
        <p className="font-semibold text-destructive">Access Denied</p>
        <p className="text-muted-foreground">
          You don't have permission to access this note.
          {isSharedAccess && note.sharedBy && (
            <span> This note is owned by {note.sharedBy.displayName}.</span>
          )}
        </p>
      </div>
      <button
        onClick={onUnauthorized}
        className="text-blue-600 hover:underline text-sm"
      >
        Go back to notes
      </button>
    </div>
  );
}
