import { useTheme } from '../../../providers/theme-provider';
import { useAuthStore } from '../../auth/stores/auth.store';
import { useNotePreferencesStore, type NoteFontSize } from '../stores/note-preferences.store';
import { useLabelManagementStore } from '../stores/label-management.store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Label } from '../../../components/ui/label';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { Monitor, Palette, Sparkles, Sun, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useRenameLabel, useDeleteLabel, useNotes } from '../../notes/api/notes.api';
import { api } from '../../../lib/axios';
import { AvatarUpload } from './avatar-upload';
import { ChangePasswordForm } from './change-password-form';

const noteFontSizeLabels: Record<NoteFontSize, string> = {
  sm: 'Compact',
  base: 'Comfortable',
  lg: 'Spacious',
};

export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const noteFontSize = useNotePreferencesStore((state) => state.noteFontSize);
  const setNoteFontSize = useNotePreferencesStore((state) => state.setNoteFontSize);
  const noteColor = useNotePreferencesStore((state) => state.noteColor);
  const setNoteColor = useNotePreferencesStore((state) => state.setNoteColor);
  const labels = useLabelManagementStore((state) => state.labels);
  const syncLabels = useLabelManagementStore((state) => state.syncLabels);
  const addLabel = useLabelManagementStore((state) => state.addLabel);
  const renameLabel = useLabelManagementStore((state) => state.renameLabel);
  const deleteLabel = useLabelManagementStore((state) => state.deleteLabel);
  const [newLabel, setNewLabel] = useState('');
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const { data: notes = [] } = useNotes();
  const renameLabelMutation = useRenameLabel();
  const deleteLabelMutation = useDeleteLabel();

  useEffect(() => {
    if (labels.length === 0 && notes.length > 0) {
      syncLabels(notes.flatMap((note) => note.labels || []));
    }
  }, [labels.length, syncLabels, notes]);

  const labelOptions = useMemo(() => labels, [labels]);

  const handleAddLabel = () => {
    addLabel(newLabel);
    setNewLabel('');
  };

  const handleSaveProfile = async () => {
    const trimmed = displayName.trim();
    if (!trimmed) return;
    setProfileSaving(true);
    setProfileMessage(null);
    try {
      const response = await api.patch('/auth/profile', { displayName: trimmed });
      if (user) {
        updateUser({ displayName: response.data.displayName ?? trimmed });
      }
      setProfileMessage('Profile saved.');
    } catch {
      setProfileMessage('Failed to save profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  const noteColorOptions = [
    { value: 'default', label: 'Default', className: 'bg-white dark:bg-slate-900 border-2' },
    { value: 'yellow', label: 'Sunrise', className: 'bg-amber-100 dark:bg-amber-900/40 border-2 border-amber-200 dark:border-amber-800' },
    { value: 'green', label: 'Mint', className: 'bg-emerald-100 dark:bg-emerald-900/40 border-2 border-emerald-200 dark:border-emerald-800' },
    { value: 'blue', label: 'Sky', className: 'bg-sky-100 dark:bg-sky-900/40 border-2 border-sky-200 dark:border-sky-800' },
    { value: 'pink', label: 'Rose', className: 'bg-rose-100 dark:bg-rose-900/40 border-2 border-rose-200 dark:border-rose-800' },
    { value: 'purple', label: 'Lavender', className: 'bg-violet-100 dark:bg-violet-900/40 border-2 border-violet-200 dark:border-violet-800' },
  ] as const;

  const themeOptions = [
    { value: 'light' as const, label: 'Light', icon: Sun, description: 'Bright and crisp everywhere.' },
    { value: 'dark' as const, label: 'Dark', icon: Palette, description: 'Deep, immersive dark mode.' },
    { value: 'system' as const, label: 'System', icon: Monitor, description: 'Adapts to your device settings.' },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="rounded-3xl border bg-card p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)] backdrop-blur">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-primary/10 p-3 text-primary shadow-sm">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            <p className="max-w-2xl text-muted-foreground">Personalize your workspace, keep your notes comfortable to read, and shape the app around your workflow.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserRound className="h-5 w-5 text-primary" />Profile</CardTitle>
            <CardDescription>Update your display name and review the account email.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <AvatarUpload />
            <div className="space-y-2">
              <Label htmlFor="displayName">Display name</Label>
              <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" defaultValue={user?.email} disabled />
              <p className="text-xs text-muted-foreground">Your email address cannot be changed right now.</p>
            </div>
            {profileMessage ? <p className="text-sm text-muted-foreground">{profileMessage}</p> : null}
            <Button onClick={handleSaveProfile} disabled={profileSaving}>
              {profileSaving ? 'Saving...' : 'Save changes'}
            </Button>
          </CardContent>
        </Card>

        <ChangePasswordForm />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5 text-primary" />Appearance</CardTitle>
            <CardDescription>Keep the interface bright and tailor the reading experience.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              <Label>Theme</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                {themeOptions.map((option) => {
                  const Icon = option.icon;
                  const active = theme === option.value;

                  return (
                    <Button
                      key={option.value}
                      type="button"
                      variant={active ? 'default' : 'outline'}
                      onClick={() => setTheme(option.value)}
                      className="h-auto justify-start rounded-2xl px-4 py-4 text-left"
                    >
                      <div className="flex items-start gap-3">
                        <div className="rounded-full bg-white/20 p-2">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-semibold">{option.label}</div>
                          <div className={active ? 'text-primary-foreground/80' : 'text-muted-foreground'}>{option.description}</div>
                        </div>
                      </div>
                    </Button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
            <CardDescription>Adjust how your notes are displayed while editing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Note font size</Label>
              <div className="flex flex-wrap gap-2">
                {(['sm', 'base', 'lg'] as NoteFontSize[]).map((size) => (
                  <Button
                    key={size}
                    type="button"
                    variant={noteFontSize === size ? 'default' : 'outline'}
                    onClick={() => setNoteFontSize(size)}
                    className="rounded-full"
                    aria-pressed={noteFontSize === size}
                  >
                    {noteFontSizeLabels[size]}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Note color</Label>
              <div className="flex flex-wrap gap-3">
                {noteColorOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setNoteColor(option.value)}
                    className={`h-11 w-11 rounded-2xl border transition-all ${option.className} ${noteColor === option.value ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : 'border-border/80'}`}
                    aria-label={option.label}
                    aria-pressed={noteColor === option.value}
                    title={option.label}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Choose a calm background tint for note cards.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Labels</CardTitle>
            <CardDescription>Manage labels used for filtering and organizing notes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={newLabel}
                onChange={(event) => setNewLabel(event.target.value)}
                placeholder="New label"
                aria-label="New label name"
              />
              <Button type="button" onClick={handleAddLabel} className="sm:w-auto">
                Add label
              </Button>
            </div>

            {labelOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No labels yet.</p>
            ) : (
              <div className="space-y-3">
                {labelOptions.map((label) => {
                  const draftValue = renameDrafts[label] ?? label;

                  return (
                    <div key={label} className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-background/80 p-4 sm:flex-row sm:items-center">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
                        <Input
                          value={draftValue}
                          onChange={(event) =>
                            setRenameDrafts((current) => ({ ...current, [label]: event.target.value }))
                          }
                          aria-label={`Rename ${label}`}
                        />
                      </div>
                      <div className="flex gap-2 self-start sm:self-end">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={renameLabelMutation.isPending}
                          onClick={async () => {
                            const trimmedDraft = draftValue.trim();
                            if (!trimmedDraft || trimmedDraft === label) return;
                            
                            try {
                              await renameLabelMutation.mutateAsync({ oldName: label, newName: trimmedDraft });
                              renameLabel(label, trimmedDraft);
                              setRenameDrafts((current) => {
                                const next = { ...current };
                                delete next[label];
                                return next;
                              });
                            } catch (error) {
                              console.error('Failed to rename label:', error);
                            }
                          }}
                        >
                          {renameLabelMutation.isPending && renameLabelMutation.variables?.oldName === label ? 'Saving...' : 'Rename'}
                        </Button>
                        <Button 
                          type="button" 
                          variant="destructive" 
                          disabled={deleteLabelMutation.isPending}
                          onClick={async () => {
                            try {
                              await deleteLabelMutation.mutateAsync(label);
                              deleteLabel(label);
                            } catch (error) {
                              console.error('Failed to delete label:', error);
                            }
                          }}
                        >
                          {deleteLabelMutation.isPending && deleteLabelMutation.variables === label ? 'Deleting...' : 'Delete'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
