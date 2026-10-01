// Service Worker for offline support and push notifications

const CACHE_NAME = 'pirokaapp-v1';
const ASSETS_CACHE = 'pirokaapp-assets-v1';

const CACHE_URLS = [
  '/',
  '/offline',
  '/_next/static/runtime/main.js',
  '/_next/static/chunks/pages/index.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CACHE_URLS).catch((err) => {
        console.warn('Cache install failed:', err);
      });
    })
  );

  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== ASSETS_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );

  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and external requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // API calls - network first with fallback to offline queue
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const cache = caches.open(CACHE_NAME);
          cache.then((c) => c.put(request, response.clone()));
          return response;
        })
        .catch(() => {
          return caches.match(request);
        })
    );
    return;
  }

  // Assets - cache first
  event.respondWith(
    caches.match(request).then((response) => {
      if (response) {
        return response;
      }

      return fetch(request)
        .then((response) => {
          const cache = caches.open(ASSETS_CACHE);
          cache.then((c) => c.put(request, response.clone()));
          return response;
        })
        .catch(() => {
          // Return offline page for navigation
          if (request.mode === 'navigate') {
            return caches.match('/offline');
          }
          return null;
        });
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body,
    icon: data.icon || '/icon.svg',
    badge: data.badge || '/badge.svg',
    tag: data.tag || 'default',
    data: data.data || {},
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data.url || '/app';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        if (windowClients[i].url === urlToOpen) {
          return windowClients[i].focus();
        }
      }
      return clients.openWindow(urlToOpen);
    })
  );
});
