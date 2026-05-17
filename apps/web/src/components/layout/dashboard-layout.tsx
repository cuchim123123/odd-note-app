import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuthStore } from '../../features/auth/stores/auth.store';
import { useLogout, useResendVerification } from '../../features/auth/api/auth.api';
import { Button } from '../ui/button';
import { NotificationCenter } from '../NotificationCenter';
import { Sparkles, LogOut, Settings as SettingsIcon, BookOpen, BadgeCheck, ChevronRight } from 'lucide-react';
import { useRealtimeNotifications } from '../../features/notifications/hooks/useRealtimeNotifications';

export function DashboardLayout() {
  useRealtimeNotifications(); // Start global realtime notification socket listener
  
  const user = useAuthStore((state) => state.user);
  const logoutMutation = useLogout();
  const resendMutation = useResendVerification();
  const navigate = useNavigate();
  
  const isUnverified = Boolean(user && !user.isEmailVerified);
  
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const interval = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [countdown]);

  const handleResendBanner = async () => {
    if (!user?.email || countdown > 0) return;
    try {
      await resendMutation.mutateAsync(user.email);
      setResendStatus('Sent! Check inbox');
      setCountdown(60);
      setTimeout(() => setResendStatus(null), 5000);
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      setResendStatus(msg || 'Failed');
      setTimeout(() => setResendStatus(null), 5000);
    }
  };

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    navigate('/auth/login');
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Link to="/notes" className="flex shrink-0 items-center gap-3 rounded-full border bg-card px-3 py-2 shadow-sm transition-transform hover:-translate-y-0.5">
            <div className="flex shrink-0 h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
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
            <div className="hidden items-center gap-2 rounded-full border bg-card pl-2 pr-3 py-1 text-sm shadow-sm sm:flex">
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.displayName}
                  className="h-6 w-6 rounded-full object-cover border border-border"
                />
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {user ? user.displayName.trim().charAt(0).toUpperCase() : 'U'}
                </div>
              )}
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Logged in as </span>
                <span className="font-medium">{user?.displayName || user?.email}</span>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout} disabled={logoutMutation.isPending} aria-label="Logout from your account" className="rounded-full">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {isUnverified ? (
        <div className="border-b bg-amber-500/10 text-amber-700 dark:text-amber-400">
          <div className="container flex flex-col gap-2 py-3 text-sm font-medium sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-amber-600" />
              <span>Your account is not verified yet. Check your email to unlock all features.</span>
              <button
                type="button"
                onClick={handleResendBanner}
                disabled={resendMutation.isPending || countdown > 0}
                className="underline hover:text-amber-900 dark:hover:text-amber-200 transition-colors disabled:no-underline disabled:opacity-60 ml-1 font-semibold"
              >
                {resendMutation.isPending ? 'Sending...' : countdown > 0 ? `Resend in ${countdown}s` : 'Resend verification email'}
              </button>
              {resendStatus && (
                <span className="ml-2 font-semibold text-emerald-600 dark:text-emerald-400">
                  {resendStatus}
                </span>
              )}
            </div>
            <Link to="/auth/login" className="inline-flex items-center gap-1 text-amber-700 hover:text-amber-900 transition-colors self-start sm:self-auto">
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
