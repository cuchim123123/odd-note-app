import React, { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { Doc as YDoc } from 'yjs';
import type { Editor } from '@tiptap/react';
import {
  useNote,
  useUpdateNote,
  useDeleteNote,
  useNoteShares,
  useCreateNoteShare,
  NOTES_KEYS,
  type NoteDetailItem,
  useUploadNoteImage,
} from '../api/notes.api';
import { NoteEditor } from './note-editor';
import { NoteToolbar } from './note-toolbar';
import { ProtectionPanel, ProtectionUnlockPrompt } from './protection-panel';
import { SharingModal } from './sharing-modal';
import { LabelManagementModal } from './label-management-modal';
import { Button } from '../../../components/ui/button';
import { useNoteProtectionStore } from '../stores/note-protection.store';
import { useYjsCollaboration } from '../hooks/useYjsCollaboration';
import { ProtectedNoteRoute, type ProtectedNote } from './protected-note-route';
import { useNoteDraftAndAutoSave } from '../hooks/use-note-draft-autosave';

function getYDocDebugId(yDoc?: YDoc | null): string {
  const debugDoc = yDoc as YDoc & { guid?: string | number; clientID?: string | number };
  return String(debugDoc?.guid ?? debugDoc?.clientID ?? 'unknown');
}

export function NoteDetailView({ noteId, onDeleted }: { noteId: string; onDeleted: () => void }) {
  const { data: note, isLoading, isError } = useNote(noteId);
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-sm font-medium text-muted-foreground animate-pulse">Loading note content…</p>
        </div>
      </div>
    );
  }

  if (isError || !note) {
    return (
      <div className="flex h-full items-center justify-center p-8 bg-gradient-to-br from-background via-muted/10 to-background">
        <div className="w-full max-w-md rounded-3xl border bg-card p-8 text-center shadow-[0_24px_80px_rgba(15,23,42,0.08)] dark:shadow-[0_24px_80px_rgba(0,0,0,0.4)] animate-in fade-in zoom-in-95 duration-300">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive shadow-inner">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-8 w-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
          </div>
          <h2 className="mt-6 text-xl font-bold tracking-tight text-foreground">Note Not Found</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            The note you are trying to access does not exist, has been deleted, or you do not have permission to view it.
          </p>
          <div className="mt-8 flex flex-col gap-2">
            <Button 
              type="button" 
              className="w-full rounded-full bg-primary py-2.5 font-medium shadow-md shadow-primary/20 transition-all hover:shadow-lg hover:shadow-primary/30" 
              onClick={() => navigate('/notes')}
            >
              Back to notes
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <NoteDetailContent 
      key={note.id}
      note={note} 
      noteId={noteId} 
      onDeleted={onDeleted} 
    />
  );
}

function NoteDetailContent({ 
  note, 
  noteId, 
  onDeleted 
}: { 
  note: NoteDetailItem; 
  noteId: string; 
  onDeleted: () => void 
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  // Stabilize permissions to prevent UI flickering during cache updates
  const { isOwnedNote, isSharedNote, canEditContent, canManageShares, isCollaborativeNote } = React.useMemo(() => {
    const owned = note.accessMode === 'owner' || (!note.accessMode && !note.sharedPermission && !note.isShared);
    const shared = Boolean(note.isShared || note.accessMode === 'shared');
    const perm = (note as NoteDetailItem).sharedPermission;
    
    // Owners can always edit/manage; recipients check their permission field
    const canEdit = owned || perm === 'EDIT';
    const canManage = owned;
    
    // Even READ-only users should be in collaboration mode to see real-time updates
    const collaborative = shared;

    return { 
      isOwnedNote: owned, 
      isSharedNote: shared, 
      canEditContent: canEdit, 
      canManageShares: canManage,
      isCollaborativeNote: collaborative
    };
  }, [note.id, note.accessMode, note.sharedPermission, note.isShared]); // Re-calculate if permission fields change

  const { data: shares = [] } = useNoteShares(isOwnedNote ? noteId : null);
  const updateMutation = useUpdateNote(noteId);
  const { mutateAsync: updateNote, isPending: isSaving } = updateMutation;
  const createShareMutation = useCreateNoteShare(noteId);
  const deleteMutation = useDeleteNote(noteId);

  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const isUnlocked = useNoteProtectionStore((state) => state.unlockedNoteIds.includes(noteId));
  const markUnlocked = useNoteProtectionStore((state) => state.markUnlocked);
  const markLocked = useNoteProtectionStore((state) => state.markLocked);

  const [editor, setEditor] = useState<Editor | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const uploadImageMutation = useUploadNoteImage();

  const handleImageFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0 || !editor) return;

    setIsUploadingImage(true);
    try {
      const uploadPromises = files.map(async (file) => {
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`File ${file.name} is too large. Max size is 10MB.`);
        }
        const res = await uploadImageMutation.mutateAsync(file);
        return res.url;
      });
      
      const urls = await Promise.all(uploadPromises);

      let chain = editor.chain().focus();
      for (const url of urls) {
        chain = chain.setImage({ src: url }).createParagraphNear();
      }
      chain.run();
      
      setContent(editor.getHTML());
    } catch (err: unknown) {
      console.error('Failed to upload image(s):', err);
      alert(err instanceof Error ? err.message : 'Failed to upload one or more images.');
    } finally {
      setIsUploadingImage(false);
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
    }
  };

  const {
    title,
    content,
    setContent,
    isDirty,
    lastSavedAt,
    saveError,
    isSavingLocal,
    serverProtectionStatus,
    setServerProtectionStatus,
    handleTitleChange,
    handleSaveTitle,
    handleRemoteContentUpdate,
  } = useNoteDraftAndAutoSave({
    noteId,
    note,
    canEditContent,
    isCollaborativeNote: Boolean(isCollaborativeNote),
    updateNote,
    markLocked,
  });

  const [protectionMode, setProtectionMode] = useState<'idle' | 'protect' | 'remove'>('idle');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [labelManagementOpen, setLabelManagementOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const { presenceParticipants, isConnected: isWsConnected, sendContentUpdate, yDoc, sendDelete, isSynced } = useYjsCollaboration({
    noteId: isCollaborativeNote ? noteId : null,
    enabled: Boolean(isCollaborativeNote),
    onRemoteContentUpdate: handleRemoteContentUpdate,
    onNoteDeleted: (id) => {
      console.warn('[NoteDetailView] Note deleted by owner, redirecting...', id);
      navigate('/notes');
    },
    onPermissionsUpdated: () => {
      console.warn('[NoteDetailView] Permissions updated, refetching...');
      queryClient.invalidateQueries({ queryKey: NOTES_KEYS.detail(noteId) });
    },
  });


  const broadcast = useCallback((s: { title?: string | undefined; isPinned?: boolean | undefined; isProtected?: boolean | undefined; labels?: string[] | undefined } = {}) => {
    if (!isCollaborativeNote) return;
    sendContentUpdate(undefined, title, s);
  }, [isCollaborativeNote, sendContentUpdate, title]);

  const onTitleSave = useCallback(async () => {
    await handleSaveTitle(broadcast);
  }, [handleSaveTitle, broadcast]);

  const isProtected = serverProtectionStatus ?? note.isProtected;
  if (isProtected && !isUnlocked) {
    return (
      <ProtectionUnlockPrompt
        noteId={noteId}
        onUnlock={(token) => markUnlocked(noteId, token)}
      />
    );
  }

  const handleToggleLabel = async (label: string) => {
    if (!note || !canEditContent) return;
    const currentLabels = note.labels || [];
    const nextLabels = currentLabels.includes(label)
      ? currentLabels.filter((l) => l !== label)
      : [...currentLabels, label];
    
    try {
      const updated = await updateNote({ labels: nextLabels });
      broadcast({ labels: updated.labels });
    } catch {
      // Silently fail
    }
  };

  const onUnauthorized = () => navigate('/notes');

  return (
    <ProtectedNoteRoute note={note as ProtectedNote | null} isLoading={false} onUnauthorized={onUnauthorized}>
      <div className="flex h-full flex-col overflow-hidden rounded-3xl border bg-card shadow-[0_24px_80px_rgba(15,23,42,0.12)] dark:shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
      <NoteToolbar
        note={note}
        title={title}
        onTitleChange={handleTitleChange}
        isDirty={isDirty}
        isSaving={isSavingLocal || isSaving || isUploadingImage}
        lastSavedAt={lastSavedAt}
        saveError={saveError}
        isCollaborativeNote={isCollaborativeNote}
        isWsConnected={isWsConnected}
        presenceParticipants={presenceParticipants}
        canEditContent={canEditContent}
        canManageShares={canManageShares}
        imageInputRef={imageInputRef}
        onImageFileChange={handleImageFileChange}
        onOpenSharing={() => setShareModalOpen(true)}
        onOpenProtection={(mode) => setProtectionMode(mode)}
        onPin={async () => {
          try {
            const u = await updateNote({ isPinned: !note.isPinned });
            broadcast({ isPinned: u.isPinned ?? true });
          } catch {
            // Handle error silently
          }
        }}
        onDelete={() => setDeleteConfirmOpen(true)}
        isSharedNote={isSharedNote}
        onToggleLabel={handleToggleLabel}
        onOpenLabelManagement={() => setLabelManagementOpen(true)}
        onSaveTitle={onTitleSave}
      />

      {deleteConfirmOpen && (
        <div className="border-b bg-muted/30 px-4 py-4 sm:px-6">
          <div className="rounded-2xl border border-destructive/20 bg-card p-5 shadow-sm">
            <h3 className="font-semibold text-destructive">Delete?</h3>
            <p className="mt-1 text-sm text-muted-foreground">Cannot undo.</p>
            <div className="mt-4 flex gap-2">
              <Button 
                type="button" 
                variant="destructive" 
                onClick={async () => { 
                  try {
                    await deleteMutation.mutateAsync(); 
                    if (isOwnedNote) sendDelete(); 
                    setDeleteConfirmOpen(false); 
                    onDeleted(); 
                  } catch (e) {
                    console.error('Failed to delete note', e);
                    setDeleteConfirmOpen(false);
                  }
                }} 
                disabled={deleteMutation.isPending}
              >
                Delete
              </Button>
              <Button type="button" variant="outline" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {protectionMode !== 'idle' && (
        <ProtectionPanel
          noteId={noteId}
          mode={protectionMode}
          onClose={() => setProtectionMode('idle')}
          onProtected={() => {
            setServerProtectionStatus(true);
            broadcast({ isProtected: true });
          }}
          onUnprotected={() => {
            setServerProtectionStatus(false);
            broadcast({ isProtected: false });
          }}
          onUnlock={(token) => markUnlocked(noteId, token)}
          onLock={() => markLocked(noteId)}
        />
      )}

      {canManageShares && shareModalOpen && (
        <SharingModal
          isOpen={shareModalOpen}
          noteId={noteId}
          shares={shares ?? []}
          onShare={async (email, permission) => {
            await createShareMutation.mutateAsync({ recipientEmail: email, permission });
            setShareModalOpen(false);
          }}
          onClose={() => setShareModalOpen(false)}
        />
      )}

      {labelManagementOpen && (
        <LabelManagementModal
          isOpen={labelManagementOpen}
          onClose={() => setLabelManagementOpen(false)}
        />
      )}

      <div className="flex-1 overflow-y-auto bg-gradient-to-b from-muted/20 to-card p-4 sm:p-8">
        <div className="mx-auto max-w-4xl">
          <NoteEditor
            key={yDoc ? `y-${getYDocDebugId(yDoc)}` : `no-y-${noteId ?? 'none'}`}
            content={content}
            readOnly={!canEditContent}
            onInsertImage={() => imageInputRef.current?.click()}
            syncKey={note?.id ?? noteId}
            collaborative={Boolean(isCollaborativeNote)}
            yDoc={yDoc ?? undefined}
            isOwner={isOwnedNote}
            isSynced={isSynced}
            onEditorInit={setEditor}
            {...(canEditContent ? {
              onChange: setContent,
            } : {})}
          />
        </div>
      </div>
      </div>
    </ProtectedNoteRoute>
  );
}
