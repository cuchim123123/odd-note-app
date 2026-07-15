import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { AuthSessionBootstrap } from '@/features/auth/components/auth-session-bootstrap';
import {
  OfflineDetectionProvider,
  OfflineBanner,
} from '@/features/offline/components/offline-banner';
import { useOfflineSync } from '@/features/offline/hooks/use-offline-sync';
import { ToastProvider } from '@/components/ui/toast';

type AppProviderProps = { children: ReactNode };

function OfflineSyncInitializer() {
  useOfflineSync();
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
      <OfflineDetectionProvider />
      <OfflineSyncInitializer />
      <AuthSessionBootstrap />
      <OfflineBanner />
      <ToastProvider>
        {children}
      </ToastProvider>
    </QueryClientProvider>
  );
}
