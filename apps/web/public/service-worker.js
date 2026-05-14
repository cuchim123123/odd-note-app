 

/**
 * Service Worker for offline-first PWA support
 * - Caches app shell (CSS, JS, HTML)
 * - Network-first for API calls with fallback to IndexedDB
 * - Background sync for offline changes
 */

const CACHE_VERSION = 'v2';
const CACHE_NAMES = {
  shell: `odd-note-app-shell-${CACHE_VERSION}`,
  api: `odd-note-app-api-${CACHE_VERSION}`,
  images: `odd-note-app-images-${CACHE_VERSION}`,
};

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
];

const API_ROUTES = ['/api/'];
const IMAGE_ROUTES = ['/images/', '.png', '.jpg', '.jpeg', '.gif', '.svg'];

function isHtmlRequest(request) {
  return (
    request.mode === 'navigate' ||
    request.destination === 'document' ||
    request.headers.get('accept')?.includes('text/html')
  );
}

// Install event: cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAMES.shell).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {
        // Fail silently if assets aren't cached during install
        // They'll be cached on first use
        return undefined;
      });
    }),
  );
  self.skipWaiting();
});

// Activate event: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!Object.values(CACHE_NAMES).includes(cacheName)) {
            return caches.delete(cacheName);
          }
        }),
      );
    }),
  );
  self.clients.claim();
});

// Fetch event: network-first for API, cache-first for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and non-http(s)
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // API routes: network-first with IndexedDB fallback
  if (API_ROUTES.some((route) => url.pathname.startsWith(route))) {
    event.respondWith(networkFirstWithDb(request));
    return;
  }

  // HTML/navigation requests: network-first so reloads get the latest UI
  if (isHtmlRequest(request)) {
    event.respondWith(networkFirstForShell(request));
    return;
  }

  // Image routes: cache-first
  if (IMAGE_ROUTES.some((route) => url.pathname.includes(route))) {
    event.respondWith(cacheFirstWithNetwork(request, CACHE_NAMES.images));
    return;
  }

  // Shell assets: cache-first
  event.respondWith(cacheFirstWithNetwork(request, CACHE_NAMES.shell));
});

// Network-first strategy with IndexedDB fallback
async function networkFirstWithDb(request) {
  try {
    const response = await fetch(request);
    // Cache successful API responses
    if (response.ok && request.method === 'GET') {
      const cache = await caches.open(CACHE_NAMES.api);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Network failed: try cache, then IndexedDB
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Try to return data from IndexedDB for notes queries
    if (request.url.includes('/api/notes')) {
      const data = await getFromDb();
      if (data) {
        return new Response(JSON.stringify(data), {
          headers: { 'Content-Type': 'application/json', 'X-From-Db': 'true' },
        });
      }
    }

    return new Response('Offline - no cached data available', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  }
}

// Cache-first strategy with network fallback
async function cacheFirstWithNetwork(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline - no cached asset', { status: 503 });
  }
}

// Network-first strategy for the app shell so normal reloads see fresh UI
async function networkFirstForShell(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAMES.shell);
      cache.put('/index.html', response.clone());
      cache.put('/', response.clone());
    }
    return response;
  } catch {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    const fallbackResponse = (await caches.match('/index.html')) || (await caches.match('/'));
    if (fallbackResponse) {
      return fallbackResponse;
    }

    return new Response('Offline - no cached asset', { status: 503 });
  }
}

// IndexedDB helpers for offline data persistence
async function getFromDb() {
  return new Promise((resolve) => {
    const request = indexedDB.open('odd-note-app', 3);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('notes')) {
        db.createObjectStore('notes', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('syncQueue')) {
        const queueStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
        queueStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
      if (!db.objectStoreNames.contains('metadata')) {
        db.createObjectStore('metadata', { keyPath: 'key' });
      }
    };

    request.onsuccess = (e) => {
      const db = e.target.result;
      try {
        const tx = db.transaction('notes', 'readonly');
        const store = tx.objectStore('notes');
        const query = store.getAll();

        query.onsuccess = () => {
          resolve(query.result);
        };
        query.onerror = () => {
          resolve(null);
        };
      } catch (err) {
        console.error('SW: DB transaction failed', err);
        resolve(null);
      }
    };
    request.onerror = () => {
      resolve(null);
    };
  });
}

// Background sync for offline changes (when connection restored)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-notes') {
    event.waitUntil(syncOfflineChanges());
  }
});

async function syncOfflineChanges() {
  // This would sync pending note changes from IndexedDB to backend
  // Implementation depends on sync queue structure stored in IndexedDB
}

// Push notifications for shared note updates (future enhancement)
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New update',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
  };
  event.waitUntil(self.registration.showNotification('odd-note-app', options));
});
