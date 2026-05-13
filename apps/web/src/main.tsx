import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';
import { useOfflineSyncStore } from './stores/offline-sync.store';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

// Initialize service worker and offline sync
async function initOfflineSupport() {
  // Register service worker for offline support
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register(
        '/service-worker.js',
        { scope: '/' },
      );
      // eslint-disable-next-line no-console
      console.log('Service Worker registered:', registration);
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }

  // Initialize IndexedDB for sync queue persistence
  try {
    await useOfflineSyncStore.getState().initDb();
    await useOfflineSyncStore.getState().loadSyncQueue();
  } catch (error) {
    console.error('Failed to initialize offline sync:', error);
  }
}

initOfflineSupport().catch((err) => {
  console.error('Failed to initialize offline support:', err);
});

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
