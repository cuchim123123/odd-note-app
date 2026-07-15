import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { useLogout, useResendVerification } from '@/features/auth/api/auth.api';
import { NotificationCenter } from '@/components/NotificationCenter';
import { LogOut, Settings as SettingsIcon, BookOpen, BadgeCheck, ChevronDown } from 'lucide-react';
import { useRealtimeNotifications } from '@/features/notifications/hooks/useRealtimeNotifications';

export function DashboardLayout() {
  useRealtimeNotifications(); // Start global realtime notification socket listener
  
  const user = useAuthStore((state) => state.user);
  const logoutMutation = useLogout();
  const resendMutation = useResendVerification();
  const navigate = useNavigate();
  
  const isUnverified = Boolean(user && !user.isEmailVerified);
  
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (countdown <= 0) return;
    const interval = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [countdown]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Link to="/notes" className="flex shrink-0 items-center transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/20 rounded-lg px-1.5 py-1">
            <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-primary via-primary/95 to-primary/85 bg-clip-text text-transparent">
              OddNote
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <NotificationCenter />
            
            {/* Premium Profile Dropdown Menu */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 rounded-full border bg-card pl-2 pr-3 py-1.5 text-sm shadow-sm transition-all hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                aria-expanded={isDropdownOpen}
                aria-haspopup="true"
              >
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
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground hidden sm:inline">Logged in as </span>
                  <span className="font-semibold text-foreground max-w-[120px] truncate">{user?.displayName || user?.email}</span>
                  <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground/75 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-2xl border border-border/80 bg-popover p-2 text-popover-foreground shadow-xl shadow-black/10 backdrop-blur-md animate-in fade-in slide-in-from-top-3 duration-200 z-50">
                  <div className="px-3 py-2.5">
                    <p className="text-xs font-semibold text-muted-foreground">Signed in as</p>
                    <p className="truncate text-sm font-bold text-foreground mt-0.5">{user?.displayName}</p>
                    <p className="truncate text-[11px] text-muted-foreground mt-0.5">{user?.email}</p>
                  </div>
                  <div className="h-px bg-border/60 my-1.5" />
                  <div className="space-y-0.5">
                    <Link
                      to="/notes"
                      onClick={() => setIsDropdownOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-all hover:bg-accent hover:text-foreground font-medium"
                    >
                      <BookOpen className="h-4 w-4" />
                      Notes
                    </Link>
                    <Link
                      to="/settings"
                      onClick={() => setIsDropdownOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-all hover:bg-accent hover:text-foreground font-medium"
                    >
                      <SettingsIcon className="h-4 w-4" />
                      Settings
                    </Link>
                  </div>
                  <div className="h-px bg-border/60 my-1.5" />
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      handleLogout();
                    }}
                    disabled={logoutMutation.isPending}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-destructive hover:bg-destructive/10 transition-all"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {isUnverified ? (
        <div className="border-b bg-amber-500/10 text-amber-700 dark:text-amber-400">
          <div className="container flex items-center justify-between py-3 text-sm font-medium">
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
          </div>
        </div>
      ) : null}

      <main className="container py-6">
        <Outlet />
      </main>
    </div>
  );
}
