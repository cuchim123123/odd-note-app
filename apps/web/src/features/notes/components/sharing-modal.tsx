import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, AlertTriangle, Loader2 } from 'lucide-react';

type SharingModalProps = {
  isOpen: boolean;
  onClose: () => void;
  noteId: string;
  shares: Array<{
    id: string;
    email: string;
    permission: 'READ' | 'EDIT';
    sharedAt: string;
  }>;
  onShare: (email: string, permission: 'READ' | 'EDIT') => Promise<void>;
};

export function SharingModal({
  isOpen,
  onClose,
  noteId,
  shares,
  onShare,
}: SharingModalProps) {
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<'READ' | 'EDIT'>('READ');
  const [error, setError] = useState('');
  const queryClient = useQueryClient();

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
      queryClient.invalidateQueries({ queryKey: ['note', noteId] });
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to share note');
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full max-h-96 flex flex-col">
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Share Input Section */}
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

          {/* Current Shares List */}
          {shares.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Shared With</label>
              <div className="space-y-2">
                {shares.map((share) => (
                  <div
                    key={share.id}
                    className="rounded-lg border bg-gray-50 p-2 text-sm"
                  >
                    <div className="font-medium">{share.email}</div>
                    <div className="text-xs text-gray-500">
                      {share.permission === 'READ' ? 'Can view' : 'Can edit'} •{' '}
                      {new Date(share.sharedAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {shares.length === 0 && (
            <div className="rounded-lg border border-dashed bg-gray-50 p-3 text-center text-sm text-gray-500">
              Not shared yet. Invite someone to collaborate.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
