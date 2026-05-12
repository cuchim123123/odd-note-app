import { useTheme } from '../../../providers/theme-provider';
import { useAuthStore } from '../../auth/stores/auth.store';
import { useNotePreferencesStore, type NoteFontSize } from '../stores/note-preferences.store';
import { useLabelManagementStore } from '../stores/label-management.store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Label } from '../../../components/ui/label';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { Moon, Sun, Laptop } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getSortedNotes } from '../../notes/api/notes.api';

const noteFontSizeLabels: Record<NoteFontSize, string> = {
  sm: 'Small',
  base: 'Medium',
  lg: 'Large',
};

export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const user = useAuthStore((state) => state.user);
  const noteFontSize = useNotePreferencesStore((state) => state.noteFontSize);
  const setNoteFontSize = useNotePreferencesStore((state) => state.setNoteFontSize);
  const labels = useLabelManagementStore((state) => state.labels);
  const syncLabels = useLabelManagementStore((state) => state.syncLabels);
  const addLabel = useLabelManagementStore((state) => state.addLabel);
  const renameLabel = useLabelManagementStore((state) => state.renameLabel);
  const deleteLabel = useLabelManagementStore((state) => state.deleteLabel);
  const [newLabel, setNewLabel] = useState('');
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (labels.length === 0) {
      syncLabels(getSortedNotes().flatMap((note) => note.labels));
    }
  }, [labels.length, syncLabels]);

  const labelOptions = useMemo(() => labels, [labels]);

  const handleAddLabel = () => {
    addLabel(newLabel);
    setNewLabel('');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account settings and preferences.</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Update your personal information.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input id="displayName" defaultValue={user?.displayName} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" defaultValue={user?.email} disabled />
              <p className="text-xs text-muted-foreground">Your email address cannot be changed right now.</p>
            </div>
            <Button>Save changes</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Customize the look and feel of the application.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Theme</Label>
              <div className="flex gap-2">
                <Button 
                  variant={theme === 'light' ? 'default' : 'outline'} 
                  onClick={() => setTheme('light')}
                  className="w-full sm:w-auto"
                >
                  <Sun className="w-4 h-4 mr-2" />
                  Light
                </Button>
                <Button 
                  variant={theme === 'dark' ? 'default' : 'outline'} 
                  onClick={() => setTheme('dark')}
                  className="w-full sm:w-auto"
                >
                  <Moon className="w-4 h-4 mr-2" />
                  Dark
                </Button>
                <Button 
                  variant={theme === 'system' ? 'default' : 'outline'} 
                  onClick={() => setTheme('system')}
                  className="w-full sm:w-auto"
                >
                  <Laptop className="w-4 h-4 mr-2" />
                  System
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
            <CardDescription>Adjust how your notes are displayed while editing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Note font size</Label>
              <div className="flex flex-wrap gap-2">
                {(['sm', 'base', 'lg'] as NoteFontSize[]).map((size) => (
                  <Button
                    key={size}
                    type="button"
                    variant={noteFontSize === size ? 'default' : 'outline'}
                    onClick={() => setNoteFontSize(size)}
                    className="w-full sm:w-auto"
                    aria-pressed={noteFontSize === size}
                  >
                    {noteFontSizeLabels[size]}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Labels</CardTitle>
            <CardDescription>Manage the labels available for filtering your notes.</CardDescription>
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
                    <div key={label} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center">
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
                          onClick={() => {
                            renameLabel(label, draftValue);
                            setRenameDrafts((current) => {
                              const next = { ...current };
                              delete next[label];
                              return next;
                            });
                          }}
                        >
                          Rename
                        </Button>
                        <Button type="button" variant="destructive" onClick={() => deleteLabel(label)}>
                          Delete
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
