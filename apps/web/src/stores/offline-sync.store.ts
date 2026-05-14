import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export interface OfflineNote {
  id: string;
  title: string;
  content: string;
  labels: string[];
  isPinned: boolean;
  isPasswordProtected: boolean;
  viewType: 'read' | 'edit';
  updatedAt: string;
}

export interface SyncQueueItem {
  id: string;
  type: 'create' | 'update' | 'delete' | 'share';
  noteId?: string;
  payload: Record<string, unknown>;
  timestamp: number;
  retries: number;
  error?: string;
}

interface OfflineSyncState {
  // Offline cache
  cachedNotes: Map<string, OfflineNote>;
  syncQueue: SyncQueueItem[];

  // Sync state
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime: number | null;
  syncError: string | null;

  // Actions
  addToSyncQueue: (item: SyncQueueItem) => void;
  removeSyncQueueItem: (id: string) => void;
  clearSyncQueue: () => void;
  updateSyncQueue: (items: SyncQueueItem[]) => void;
  setSyncing: (syncing: boolean) => void;
  setOnline: (online: boolean) => void;
  setSyncError: (error: string | null) => void;
  setLastSyncTime: (time: number) => void;

  // Cache actions
  setCachedNote: (note: OfflineNote) => void;
  removeCachedNote: (noteId: string) => void;
  getCachedNote: (noteId: string) => OfflineNote | undefined;
  getAllCachedNotes: () => OfflineNote[];
  clearCache: () => void;

  // IndexedDB persistence
  initDb: () => Promise<void>;
  persistSyncQueue: () => Promise<void>;
  loadSyncQueue: () => Promise<void>;
}

export const useOfflineSyncStore = create<OfflineSyncState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        cachedNotes: new Map(),
        syncQueue: [],
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
        isSyncing: false,
        lastSyncTime: null,
        syncError: null,

        // Sync queue actions
        addToSyncQueue: (item: SyncQueueItem) => {
          set((state) => ({
            syncQueue: [...state.syncQueue, item],
          }));
          get().persistSyncQueue();
        },

        removeSyncQueueItem: (id: string) => {
          set((state) => ({
            syncQueue: state.syncQueue.filter((item) => item.id !== id),
          }));
          get().persistSyncQueue();
        },

        clearSyncQueue: () => {
          set({ syncQueue: [] });
          get().persistSyncQueue();
        },

        updateSyncQueue: (items: SyncQueueItem[]) => {
          set({ syncQueue: items });
          get().persistSyncQueue();
        },

        setSyncing: (syncing: boolean) => {
          set({ isSyncing: syncing });
        },

        setOnline: (online: boolean) => {
          set({ isOnline: online });

          if (
            online &&
            get().syncQueue.length > 0 &&
            typeof window !== 'undefined'
          ) {
            window.dispatchEvent(new Event('offline-sync-ready'));
          }
        },

        setSyncError: (error: string | null) => {
          set({ syncError: error });
        },

        setLastSyncTime: (time: number) => {
          set({ lastSyncTime: time });
        },

        // Cache actions
        setCachedNote: (note: OfflineNote) => {
          set((state) => {
            const newMap = new Map(state.cachedNotes);
            newMap.set(note.id, note);
            return { cachedNotes: newMap };
          });
        },

        removeCachedNote: (noteId: string) => {
          set((state) => {
            const newMap = new Map(state.cachedNotes);
            newMap.delete(noteId);
            return { cachedNotes: newMap };
          });
        },

        getCachedNote: (noteId: string) => {
          return get().cachedNotes.get(noteId);
        },

        getAllCachedNotes: () => {
          return Array.from(get().cachedNotes.values());
        },

        clearCache: () => {
          set({ cachedNotes: new Map() });
        },

        // IndexedDB persistence
        initDb: async () => {
          return new Promise((resolve, reject) => {
            const request = indexedDB.open('odd-note-app', 3);

            request.onerror = () => {
              console.error('IndexedDB open failed:', request.error);
              reject(request.error);
            };

            request.onsuccess = () => {
              resolve();
            };

            request.onupgradeneeded = (event) => {
              const db = (event.target as IDBOpenDBRequest).result;

              // Create notes store
              if (!db.objectStoreNames.contains('notes')) {
                db.createObjectStore('notes', { keyPath: 'id' });
              }

              // Create sync queue store
              if (!db.objectStoreNames.contains('syncQueue')) {
                const queueStore = db.createObjectStore('syncQueue', {
                  keyPath: 'id',
                });
                queueStore.createIndex('timestamp', 'timestamp', {
                  unique: false,
                });
              }

              // Create metadata store
              if (!db.objectStoreNames.contains('metadata')) {
                db.createObjectStore('metadata', { keyPath: 'key' });
              }
            };
          });
        },

        persistSyncQueue: async () => {
          if (!('indexedDB' in window)) return;

          try {
            const db = await new Promise<IDBDatabase>((resolve, reject) => {
              const request = indexedDB.open('odd-note-app', 3);
              request.onsuccess = () => resolve(request.result);
              request.onerror = () => reject(request.error);
            });

            const tx = db.transaction('syncQueue', 'readwrite');
            const store = tx.objectStore('syncQueue');

            // Clear old queue
            await new Promise<void>((resolve, reject) => {
              const clearReq = store.clear();
              clearReq.onsuccess = () => resolve();
              clearReq.onerror = () => reject(clearReq.error);
            });

            // Write current queue
            for (const item of get().syncQueue) {
              await new Promise<void>((resolve, reject) => {
                const addReq = store.add(item);
                addReq.onsuccess = () => resolve();
                addReq.onerror = () => reject(addReq.error);
              });
            }

            db.close();
          } catch (error) {
            console.error('Failed to persist sync queue:', error);
          }
        },

        loadSyncQueue: async () => {
          if (!('indexedDB' in window)) return;

          try {
            const db = await new Promise<IDBDatabase>((resolve, reject) => {
              const request = indexedDB.open('odd-note-app', 3);
              request.onsuccess = () => resolve(request.result);
              request.onerror = () => reject(request.error);
            });

            const tx = db.transaction('syncQueue', 'readonly');
            const store = tx.objectStore('syncQueue');

            const items = await new Promise<SyncQueueItem[]>(
              (resolve, reject) => {
                const getReq = store.getAll();
                getReq.onsuccess = () => {
                  resolve(getReq.result as SyncQueueItem[]);
                };
                getReq.onerror = () => reject(getReq.error);
              },
            );

            set({ syncQueue: items });
            db.close();
          } catch (error) {
            console.error('Failed to load sync queue:', error);
          }
        },
      }),
      {
        name: 'offline-sync-store',
        // Don't persist Map/sync queue to localStorage (use IndexedDB instead)
        partialize: (state) => ({
          lastSyncTime: state.lastSyncTime,
          isOnline: state.isOnline,
        }),
      },
    ),
  ),
);

// Listen for online/offline events
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useOfflineSyncStore.setState({ isOnline: true });
  });

  window.addEventListener('offline', () => {
    useOfflineSyncStore.setState({ isOnline: false });
  });
}
