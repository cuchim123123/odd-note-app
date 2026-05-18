import { useEffect } from 'react';
import { api } from '../../../lib/axios';
import { useAuthStore } from '../stores/auth.store';

export function AuthSessionBootstrap() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const accessToken = useAuthStore((state) => state.accessToken);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const updateUser = useAuthStore((state) => state.updateUser);

  useEffect(() => {
    if (!hasHydrated || !isAuthenticated || !accessToken) {
      return;
    }

    let cancelled = false;

    const syncUser = async () => {
      try {
        const response = await api.get<{ user: { id: string; email: string; displayName: string; role: 'USER' | 'ADMIN'; isEmailVerified: boolean } }>('/auth/me');
        if (!cancelled) {
          updateUser(response.data.user);
        }
      } catch {
        // The axios interceptor handles refresh/logout on auth failures.
      }
    };

    void syncUser();

    // Listen for tab focus to instantly update verification / profile state (e.g. after verifying in another tab or device)
    const handleFocus = () => {
      void syncUser();
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', handleFocus);
    };
  }, [accessToken, hasHydrated, isAuthenticated, updateUser]);

  return null;
}