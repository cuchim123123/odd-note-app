import { useTheme } from '../../../providers/theme-provider';
import { useAuthStore } from '../../auth/stores/auth.store';
import { useNotePreferencesStore, type NoteFontSize } from '../stores/note-preferences.store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Label } from '../../../components/ui/label';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { Moon, Sun, Laptop } from 'lucide-react';

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
      </div>
    </div>
  );
}
