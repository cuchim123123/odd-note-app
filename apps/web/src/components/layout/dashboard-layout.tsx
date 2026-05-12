import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../features/auth/stores/auth.store';
import { useLogout } from '../../features/auth/api/auth.api';
import { Button } from '../ui/button';
import { Sparkles, LogOut, Settings as SettingsIcon, Book } from 'lucide-react';

export function DashboardLayout() {
  const user = useAuthStore((state) => state.user);
  const logoutMutation = useLogout();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    navigate('/auth/login');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold">
            <Sparkles className="w-5 h-5 text-primary" />
            <span>odd note</span>
          </Link>
          
          <nav className="flex items-center gap-4 text-sm font-medium">
            <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <Book className="w-4 h-4" />
              Notes
            </Link>
            <Link to="/settings" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <SettingsIcon className="w-4 h-4" />
              Settings
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            <div className="text-sm hidden sm:block">
              <span className="text-muted-foreground">Logged in as </span>
              <span className="font-medium">{user?.displayName || user?.email}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout} disabled={logoutMutation.isPending}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>
      
      <main className="flex-1 container py-6 h-[calc(100vh-3.5rem)]">
        <Outlet />
      </main>
    </div>
  );
}
