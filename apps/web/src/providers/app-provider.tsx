import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuthStore } from '../features/auth/stores/auth.store';
import { api } from '../lib/axios';

type AppProviderProps = {
  children: ReactNode;
};

function AuthBootstrap() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const accessToken = useAuthStore((state) => state.accessToken);
  const updateUser = useAuthStore((state) => state.updateUser);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
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

    return () => {
      cancelled = true;
    };
  }, [accessToken, isAuthenticated, updateUser]);

  return null;
}

export function AppProvider({ children }: AppProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthBootstrap />
      {children}
    </QueryClientProvider>
  );
}
