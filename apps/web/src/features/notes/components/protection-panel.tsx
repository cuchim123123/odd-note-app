import { useState } from 'react';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { Lock } from 'lucide-react';
import { setNotePassword, removeNotePassword, verifyNotePassword } from '../api/notes.api';
import { useUpdateNote } from '../api/notes.api';

export function ProtectionUnlockPrompt({ noteId, onUnlock }: { noteId: string; onUnlock: () => void }) {
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border bg-background p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-full bg-muted p-3 text-muted-foreground"><Lock className="h-5 w-5" /></div>
          <div><h2 className="text-lg font-semibold">Protected</h2><p className="text-sm text-muted-foreground">Enter password.</p></div>
        </div>
        <div className="space-y-3">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
          {message && <p className="text-sm text-destructive">{message}</p>}
          <div className="flex gap-2">
            <Button type="button" className="flex-1" onClick={async () => {
              try {
                const r = await verifyNotePassword(noteId, password.trim());
                if (!r.verified) { setMessage('Wrong password.'); return; }
                onUnlock();
                setPassword('');
              } catch { setMessage('Wrong password.'); }
            }}>Unlock</Button>
            <Button type="button" variant="outline" onClick={() => setPassword('')}>Clear</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProtectionPanel({
  noteId,
  mode,
  onClose,
  onProtected,
  onUnprotected,
}: {
  noteId: string;
  mode: 'protect' | 'remove';
  onClose: () => void;
  onProtected: () => void;
  onUnprotected: () => void;
  onUnlock: () => void;
  onLock: () => void;
}) {
  const updateMutation = useUpdateNote(noteId);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  if (mode === 'protect') {
    return (
      <div className="border-b bg-muted/30 px-4 py-4 sm:px-6">
        <div className="space-y-3 rounded-2xl border bg-card p-5 shadow-sm">
          <h3 className="font-semibold">Protect this note</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <Input type="password" placeholder="Confirm" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
          {message && <p className="text-sm text-destructive">{message}</p>}
          <div className="flex gap-2">
            <Button type="button" onClick={async () => {
              const pw = password.trim();
              const cpw = confirmPassword.trim();
              if (!pw) { setMessage('Enter password.'); return; }
              if (pw !== cpw) { setMessage('Passwords do not match.'); return; }
              try {
                await setNotePassword(noteId, pw);
                await updateMutation.mutateAsync({ isProtected: true });
                onProtected();
                onClose();
              } catch { setMessage('Failed to protect.'); }
            }} disabled={updateMutation.isPending}>Enable</Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b bg-muted/30 px-4 py-4 sm:px-6">
      <div className="space-y-3 rounded-2xl border bg-card p-5 shadow-sm">
        <h3 className="font-semibold">Remove protection</h3>
        <Input type="password" placeholder="Enter current password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {message && <p className="text-sm text-destructive">{message}</p>}
        <div className="flex gap-2">
          <Button type="button" onClick={async () => {
            try {
              await removeNotePassword(noteId, password.trim());
              await updateMutation.mutateAsync({ isProtected: false });
              onUnprotected();
              onClose();
            } catch { setMessage('Wrong password.'); }
          }} disabled={updateMutation.isPending}>Remove</Button>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}
