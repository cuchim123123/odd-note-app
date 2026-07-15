import { useState } from 'react';
import { PasswordInput } from '@/components/ui/password-input';
import { Button } from '@/components/ui/button';
import { Lock, Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { setNotePassword, removeNotePassword, verifyNotePassword } from '@/features/notes/api/notes.api';
import { useUpdateNote } from '@/features/notes/api/notes.api';

export function ProtectionUnlockPrompt({ noteId, onUnlock }: { noteId: string; onUnlock: (token?: string) => void }) {
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
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
          {message && <p className="text-sm text-destructive">{message}</p>}
          <div className="flex gap-2">
            <Button type="button" className="flex-1" onClick={async () => {
              try {
                const r = await verifyNotePassword(noteId, password.trim());
                if (!r.verified) { setMessage('Wrong password.'); return; }
                onUnlock(r.unlockToken);
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
  onUnlock: (token?: string) => void;
  onLock: () => void;
}) {
  const updateMutation = useUpdateNote(noteId);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const [subMode, setSubMode] = useState<'disable' | 'change'>('disable');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [success, setSuccess] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  if (mode === 'protect') {
    return (
      <div className="border-b bg-muted/30 px-4 py-4 sm:px-6">
        <div className="space-y-3 rounded-2xl border bg-card p-5 shadow-sm">
          <h3 className="font-semibold">Protect this note</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <PasswordInput placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <PasswordInput placeholder="Confirm" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
          {message && <p className="text-sm text-destructive">{message}</p>}
          <div className="flex gap-2">
            <Button type="button" onClick={async () => {
              const pw = password.trim();
              const cpw = confirmPassword.trim();
              if (!pw) { setMessage('Enter password.'); return; }
              if (pw.length < 4) { setMessage('Password must be at least 4 characters long.'); return; }
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

  const handleUpdatePassword = async () => {
    const currentPw = password.trim();
    const newPw = newPassword.trim();
    const confirmPw = confirmNewPassword.trim();

    if (!currentPw) {
      setMessage('Enter current password.');
      return;
    }
    if (!newPw) {
      setMessage('Enter new password.');
      return;
    }
    if (newPw.length < 4) {
      setMessage('New password must be at least 4 characters long.');
      return;
    }
    if (newPw !== confirmPw) {
      setMessage('New passwords do not match.');
      return;
    }

    setIsUpdating(true);
    setMessage(null);
    setSuccess(null);

    try {
      // 1. Verify old password
      const verifyRes = await verifyNotePassword(noteId, currentPw);
      if (!verifyRes.verified) {
        setMessage('Incorrect current password.');
        setIsUpdating(false);
        return;
      }

      // 2. Set new password
      await setNotePassword(noteId, newPw);
      
      setSuccess('Password updated successfully!');
      setPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Failed to change note password', err);
      setMessage('Failed to change password.');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="border-b bg-muted/30 px-4 py-4 sm:px-6">
      <div className="space-y-3 rounded-2xl border bg-card p-5 shadow-sm">
        {/* Sleek active tabs control block */}
        <div className="flex border-b border-border/40 gap-2 mb-2">
          <button 
            type="button" 
            className={cn(
              "px-4 py-2 text-xs font-semibold rounded-t-xl transition-all border-b-2",
              subMode === 'disable' 
                ? "border-primary text-primary bg-primary/5" 
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
            onClick={() => { setSubMode('disable'); setMessage(null); setSuccess(null); setPassword(''); }}
          >
            Disable Lock
          </button>
          <button 
            type="button" 
            className={cn(
              "px-4 py-2 text-xs font-semibold rounded-t-xl transition-all border-b-2",
              subMode === 'change' 
                ? "border-primary text-primary bg-primary/5" 
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
            onClick={() => { setSubMode('change'); setMessage(null); setSuccess(null); setPassword(''); }}
          >
            Change Password
          </button>
        </div>

        {subMode === 'disable' ? (
          <>
            <h3 className="font-semibold text-sm">Remove protection</h3>
            <PasswordInput placeholder="Enter current password" value={password} onChange={(e) => setPassword(e.target.value)} />
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
          </>
        ) : (
          <>
            <h3 className="font-semibold text-sm">Change password</h3>
            <div className="space-y-3">
              <PasswordInput placeholder="Current password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={isUpdating} />
              <div className="grid gap-3 sm:grid-cols-2">
                <PasswordInput placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={isUpdating} />
                <PasswordInput placeholder="Confirm new password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} disabled={isUpdating} />
              </div>
            </div>
            
            {message && <p className="text-sm text-destructive">{message}</p>}
            {success && (
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm">
                <CheckCircle2 className="h-4 w-4 shrink-0 animate-bounce" />
                <span>{success}</span>
              </div>
            )}
            
            <div className="flex gap-2">
              <Button type="button" onClick={handleUpdatePassword} disabled={isUpdating}>
                {isUpdating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Password'
                )}
              </Button>
              <Button type="button" variant="outline" onClick={onClose} disabled={isUpdating}>Cancel</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
