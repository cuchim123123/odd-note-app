import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useOfflineSyncStore } from '../../../stores/offline-sync.store';
import { api } from '../../../lib/axios';
import type { SyncQueueItem } from '../../../stores/offline-sync.store';

const MAX_SYNC_RETRIES = 3;

/**
 * Hook that syncs queued offline changes when connection is restored
 * Retries failed syncs with bounded attempts.
 */
export function useOfflineSync() {
  const queryClient = useQueryClient();
  const syncingRef = useRef(false);
  const {
    syncQueue,
    isOnline,
    isSyncing,
    setSyncing,
    setSyncError,
    updateSyncQueue,
    setLastSyncTime,
  } = useOfflineSyncStore();

  useEffect(() => {
    if (!isOnline || syncQueue.length === 0 || isSyncing || syncingRef.current) {
      return;
    }

    syncingRef.current = true;

    const syncOfflineChanges = async () => {
      setSyncing(true);
      setSyncError(null);

      const retryableItems: SyncQueueItem[] = [];
      let discardedCount = 0;

      try {
        for (const item of syncQueue) {
          try {
            await syncItem(item, api);
          } catch (error) {
            const nextRetryCount = item.retries + 1;
            if (nextRetryCount >= MAX_SYNC_RETRIES) {
              discardedCount += 1;
              continue;
            }

            retryableItems.push({
              ...item,
              retries: nextRetryCount,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }

        if (retryableItems.length > 0) {
          updateSyncQueue(retryableItems);
          const retryMessage = `Failed to sync ${retryableItems.length} item(s). Will retry.`;
          setSyncError(discardedCount > 0 ? `${retryMessage} Dropped ${discardedCount} item(s) after repeated failures.` : retryMessage);
          return;
        }

        updateSyncQueue([]);
        setLastSyncTime(Date.now());

        if (discardedCount > 0) {
          setSyncError(`Dropped ${discardedCount} item(s) after repeated sync failures.`);
        }

        await queryClient.refetchQueries({ queryKey: ['notes'] });
        await queryClient.refetchQueries({ queryKey: ['shared-notes'] });
      } finally {
        setSyncing(false);
        syncingRef.current = false;
      }
    };

    const timeoutId = setTimeout(() => {
      void syncOfflineChanges();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [
    isOnline,
    syncQueue,
    isSyncing,
    setSyncing,
    setSyncError,
    updateSyncQueue,
    setLastSyncTime,
    queryClient,
  ]);

  useEffect(() => {
    const handleSyncReady = () => {
      if (isOnline && syncQueue.length > 0) {
        window.dispatchEvent(new Event('offline-sync-triggered'));
      }
    };

    window.addEventListener('offline-sync-ready', handleSyncReady);
    return () => {
      window.removeEventListener('offline-sync-ready', handleSyncReady);
    };
  }, [isOnline, syncQueue]);
}

/**
 * Sync a single queued item to the backend
 */
async function syncItem(item: SyncQueueItem, apiClient: typeof api) {
  switch (item.type) {
    case 'create': {
      const { noteId, ...payload } = item.payload;
      void noteId;
      return apiClient.post('/api/notes', payload);
    }

    case 'update': {
      const { noteId } = item.payload;
      if (!noteId) throw new Error('Missing noteId for update');
      return apiClient.patch(`/api/notes/${noteId}`, item.payload);
    }

    case 'delete': {
      const { noteId } = item.payload;
      if (!noteId) throw new Error('Missing noteId for delete');
      return apiClient.delete(`/api/notes/${noteId}`);
    }

    case 'share': {
      const { noteId, recipientEmail, permission } = item.payload;
      if (!noteId) throw new Error('Missing noteId for share');
      return apiClient.post(`/api/notes/${noteId}/share`, {
        recipientEmail,
        permission,
      });
    }

    default:
      throw new Error(`Unknown sync type: ${item.type}`);
  }
}
