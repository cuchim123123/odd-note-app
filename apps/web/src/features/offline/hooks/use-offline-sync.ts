import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useOfflineSyncStore } from '../../../stores/offline-sync.store';
import { api } from '../../../lib/axios';
import type { SyncQueueItem } from '../../../stores/offline-sync.store';

/**
 * Hook that syncs queued offline changes when connection is restored
 * Retries failed syncs with exponential backoff
 */
export function useOfflineSync() {
  const queryClient = useQueryClient();
  const {
    syncQueue,
    isOnline,
    setSyncing,
    setSyncError,
    removeSyncQueueItem,
    updateSyncQueue,
    setLastSyncTime,
  } = useOfflineSyncStore();

  // Sync pending changes when going online
  useEffect(() => {
    if (!isOnline || syncQueue.length === 0) return;

    const syncOfflineChanges = async () => {
      setSyncing(true);
      setSyncError(null);

      const failedItems: SyncQueueItem[] = [];

      for (const item of syncQueue) {
        try {
          await syncItem(item, api);
          removeSyncQueueItem(item.id);
        } catch (error) {
          failedItems.push({
            ...item,
            retries: item.retries + 1,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      if (failedItems.length > 0) {
        updateSyncQueue(failedItems);
        setSyncError(
          `Failed to sync ${failedItems.length} item(s). Will retry.`,
        );
      } else {
        setLastSyncTime(Date.now());
      }

      setSyncing(false);

      // Refetch notes to ensure consistency
      if (failedItems.length === 0) {
        await queryClient.refetchQueries({ queryKey: ['notes'] });
        await queryClient.refetchQueries({ queryKey: ['shared-notes'] });
      }
    };

    // Debounce sync to avoid multiple triggers
    const timeoutId = setTimeout(syncOfflineChanges, 500);
    return () => clearTimeout(timeoutId);
  }, [
    isOnline,
    syncQueue,
    setSyncing,
    setSyncError,
    removeSyncQueueItem,
    updateSyncQueue,
    setLastSyncTime,
    queryClient,
  ]);

  // Listen for sync event from service worker
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
