import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useUpdateNoteShare, useDeleteNoteShare } from '../api/notes.api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, AlertTriangle, Loader2, Trash2 } from 'lucide-react';

type SharingModalProps = {
  isOpen: boolean;
  onClose: () => void;
  noteId: string;
  shares: Array<{
    id: string;
    recipientEmail: string;
    recipientDisplayName?: string;
    permission: 'READ' | 'EDIT';
    createdAt: string;
    updatedAt: string;
  }>;
  onShare: (email: string, permission: 'READ' | 'EDIT') => Promise<void>;
};

type Tab = 'invite' | 'participants';

export function SharingModal({
  isOpen,
  onClose,
  noteId,
  shares,
  onShare,
}: SharingModalProps) {
  const [tab, setTab] = useState<Tab>('invite');
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<'READ' | 'EDIT'>('READ');
  const [error, setError] = useState('');
  const queryClient = useQueryClient();
  const updateShareMutation = useUpdateNoteShare(noteId);
  const deleteShareMutation = useDeleteNoteShare(noteId);

  const shareMutation = useMutation({
    mutationFn: async () => {
      setError('');
      if (!email.trim()) {
        throw new Error('Email is required');
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error('Invalid email format');
      }
      await onShare(email, permission);
    },
    onSuccess: () => {
      setEmail('');
      setPermission('READ');
      setError('');
      queryClient.invalidateQueries({ queryKey: ['notes', noteId, 'shares'] });
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to share note');
    },
  });

  const handleUpdatePermission = async (shareId: string, newPermission: 'READ' | 'EDIT') => {
    try {
      await updateShareMutation.mutateAsync({ shareId, input: { permission: newPermission } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to update permission';
      setError(msg);
    }
  };

  const handleDeleteShare = async (shareId: string) => {
    try {
      await deleteShareMutation.mutateAsync(shareId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to remove share';
      setError(msg);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full max-h-[500px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold text-lg">Share Note</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b bg-gray-50">
          <button
            onClick={() => setTab('invite')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              tab === 'invite'
                ? 'border-b-2 border-blue-500 text-blue-600 bg-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Invite
          </button>
          <button
            onClick={() => setTab('participants')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              tab === 'participants'
                ? 'border-b-2 border-blue-500 text-blue-600 bg-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Participants ({shares.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'invite' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Invite via Email</label>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="user@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={shareMutation.isPending}
                    className="flex-1"
                  />
                  <select
                    value={permission}
                    onChange={(e) => setPermission(e.target.value as 'READ' | 'EDIT')}
                    disabled={shareMutation.isPending}
                    className="px-3 py-2 border rounded-md text-sm bg-white"
                  >
                    <option value="READ">View</option>
                    <option value="EDIT">Edit</option>
                  </select>
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-xs text-red-600">
                    <AlertTriangle className="h-3 w-3" />
                    {error}
                  </div>
                )}

                <Button
                  onClick={() => shareMutation.mutate()}
                  disabled={shareMutation.isPending || !email}
                  size="sm"
                  className="w-full"
                >
                  {shareMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sharing...
                    </>
                  ) : (
                    'Share'
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {shares.length > 0 ? (
                shares.map((share) => (
                  <div
                    key={share.id}
                    className="rounded-lg border bg-gray-50 p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm break-all">{share.recipientEmail}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(share.createdAt).toLocaleDateString([], {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteShare(share.id)}
                        disabled={deleteShareMutation.isPending}
                        className="p-1 hover:bg-red-50 rounded text-red-600 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Permission selector */}
                    <select
                      value={share.permission}
                      onChange={(e) =>
                        handleUpdatePermission(share.id, e.target.value as 'READ' | 'EDIT')
                      }
                      disabled={updateShareMutation.isPending}
                      className="w-full px-2 py-1.5 border rounded text-sm bg-white"
                    >
                      <option value="READ">Can view</option>
                      <option value="EDIT">Can edit</option>
                    </select>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed bg-gray-50 p-3 text-center text-sm text-gray-500">
                  No participants yet. Invite someone to collaborate.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
