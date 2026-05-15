import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import { revokeShareAccess } from '@/lib/api/notes';

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

  const revokeMutation = useMutation({
    mutationFn: (shareId: string) => revokeShareAccess(shareId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['note', noteId] });
    },
    onError: (err: Error | null) => {
      console.warn('Failed to revoke access:', err?.message);
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share Note</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
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
              <Select
                value={permission}
                onValueChange={(v) => setPermission(v as 'READ' | 'EDIT')}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="READ">View</SelectItem>
                  <SelectItem value="EDIT">Edit</SelectItem>
                </SelectContent>
              </Select>
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
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {shares.map((share) => (
                  <div
                    key={share.id}
                    className="flex items-center justify-between rounded-lg border bg-gray-50 p-2 text-sm"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{share.email}</div>
                      <div className="text-xs text-gray-500">
                        {share.permission === 'READ' ? 'Can view' : 'Can edit'} •{' '}
                        {new Date(share.sharedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={() => revokeMutation.mutate(share.id)}
                      disabled={revokeMutation.isPending}
                      className="p-1 hover:text-red-600 transition-colors"
                      title="Revoke access"
                    >
                      <X className="h-4 w-4" />
                    </button>
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
      </DialogContent>
    </Dialog>
  );
}
