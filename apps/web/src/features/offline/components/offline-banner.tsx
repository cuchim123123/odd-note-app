import { useEffect } from 'react';
import { useOfflineSyncStore } from '../../../stores/offline-sync.store';

export function OfflineDetectionProvider() {
  const { setOnline } = useOfflineSyncStore();

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
    };

    const handleOffline = () => {
      setOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Set initial state
    setOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setOnline]);

  return null;
}

export function OfflineBanner() {
  const { isOnline, syncQueue, isSyncing } = useOfflineSyncStore();

  if (isOnline && !isSyncing) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
      <div className="mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          {!isOnline ? (
            <>
              <span className="inline-block h-2 w-2 rounded-full bg-yellow-600" />
              <span>
                You're offline. Changes will be synced when you're back online.
              </span>
            </>
          ) : (
            <>
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-600" />
              <span>
                Syncing {syncQueue.length} pending change
                {syncQueue.length !== 1 ? 's' : ''}...
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
