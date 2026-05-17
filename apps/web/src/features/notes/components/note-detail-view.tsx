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
  const { data: note, isLoading } = useNote(noteId);

  if (isLoading || !note) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading…</div>;
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
  const isUnlocked = useNoteProtectionStore((state) => state.isUnlocked(noteId));
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

  const { presenceParticipants, isConnected: isWsConnected, sendContentUpdate, yDoc, sendDelete } = useYjsCollaboration({
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


  const isProtected = serverProtectionStatus ?? note.isProtected;
  if (isProtected && !isUnlocked) {
    return (
      <ProtectionUnlockPrompt
        noteId={noteId}
        onUnlock={() => markUnlocked(noteId)}
      />
    );
  }

  const broadcast = (s: { title?: string | undefined; isPinned?: boolean | undefined; isProtected?: boolean | undefined; labels?: string[] | undefined } = {}) => {
    if (!isCollaborativeNote) return;
    sendContentUpdate(undefined, title, s);
  };



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

  const onTitleSave = useCallback(async () => {
    await handleSaveTitle(broadcast);
  }, [handleSaveTitle, broadcast]);

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
          onUnlock={() => markUnlocked(noteId)}
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
