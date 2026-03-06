/* Attende-x Service Worker — sw.js
 * Handles: install prompt, offline fallback, asset caching
 * Strategy: Cache-first for static assets, network-first for API/socket
 */

const CACHE_NAME   = 'Attende-x-v1';
const OFFLINE_URL  = './offline.html';

// Assets to pre-cache on install
const PRECACHE = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// ── Install ────────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache what we can — ignore failures for optional resources
      return Promise.allSettled(
        PRECACHE.map(url => cache.add(url).catch(() => {}))
      );
    }).then(() => self.skipWaiting())
  );
});

// ── Activate ───────────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch strategy ─────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never intercept: API calls, socket.io, external, non-GET
  if (
    event.request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/socket.io') ||
    url.pathname.startsWith('/health') ||
    url.pathname.startsWith('/verify') ||
    !url.origin.includes(self.location.origin.replace(/:\d+$/, ''))
  ) {
    return; // Let it pass through normally
  }

  // For navigation requests (page loads): Network-first → cache → offline page
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          // Cache fresh page
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          const offline = await caches.match(OFFLINE_URL);
          if (offline) return offline;
          // Last resort: return cached index.html for SPA routing
          return caches.match('/index.html');
        })
    );
    return;
  }

  // For static assets (JS, CSS, images, fonts): Cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return res;
      }).catch(() => {
        // Return nothing for assets — browser handles gracefully
      });
    })
  );
});

// ── Push notifications (optional — for future meeting reminders) ───────────────
self.addEventListener('push', event => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title || 'Attende-x', {
        body:    data.body    || 'You have a new notification',
        icon:    data.icon    || '/icons/icon-192.png',
        badge:   '/icons/icon-72.png',
        tag:     data.tag     || 'Attende-x',
        data:    data.url     || '/',
        actions: data.actions || [],
        vibrate: [200, 100, 200],
      })
    );
  } catch {}
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});