import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../features/auth/stores/auth.store';
import { useLogout } from '../../features/auth/api/auth.api';
import { Button } from '../ui/button';
import { NotificationCenter } from '../NotificationCenter';
import { Sparkles, LogOut, Settings as SettingsIcon, BookOpen, BadgeCheck, ChevronRight } from 'lucide-react';

export function DashboardLayout() {
  const user = useAuthStore((state) => state.user);
  const logoutMutation = useLogout();
  const navigate = useNavigate();
  const isUnverified = Boolean(user && !user.isEmailVerified);

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    navigate('/auth/login');
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-white/70 bg-white/85 backdrop-blur-xl supports-[backdrop-filter]:bg-white/70">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Link to="/notes" className="flex items-center gap-3 rounded-full border border-border/70 bg-white px-3 py-2 shadow-sm transition-transform hover:-translate-y-0.5">
            <div className="rounded-full bg-primary/10 p-2 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="hidden sm:flex sm:flex-col sm:leading-tight">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Odd Note</span>
              <span className="font-bold tracking-tight">Write with calm focus</span>
            </div>
          </Link>

          <nav className="flex items-center gap-2 text-sm font-medium">
            <Link to="/notes" className="flex items-center gap-2 rounded-full px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20">
              <BookOpen className="h-4 w-4" />
              Notes
            </Link>
            <Link to="/settings" className="flex items-center gap-2 rounded-full px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20">
              <SettingsIcon className="h-4 w-4" />
              Settings
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <NotificationCenter />
            <div className="hidden rounded-full border border-border/70 bg-white px-3 py-2 text-sm shadow-sm sm:block">
              <span className="text-muted-foreground">Logged in as </span>
              <span className="font-medium">{user?.displayName || user?.email}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout} disabled={logoutMutation.isPending} aria-label="Logout from your account" className="rounded-full">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {isUnverified ? (
        <div className="border-b border-amber-200 bg-amber-50 text-amber-950">
          <div className="container flex items-center justify-between gap-3 py-3 text-sm font-medium">
            <div className="flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-amber-700" />
              Your account is not verified yet. Check your email to unlock the verified state.
            </div>
            <Link to="/auth/login" className="inline-flex items-center gap-1 text-amber-700 transition-colors hover:text-amber-900">
              <span>Back to login</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      ) : null}

      <main className="container py-6">
        <Outlet />
      </main>
    </div>
  );
}
