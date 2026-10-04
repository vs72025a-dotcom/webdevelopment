/*
 * Aurora Mind service worker.
 *
 * Registered only in production builds. It precaches the shell so the app opens
 * offline, serves hashed assets cache-first, and falls back to the cached shell
 * for navigations when the network is gone.
 *
 * Deliberately narrow: anything that is not a same-origin GET is passed straight
 * through, so provider API calls, streaming responses and WebSocket traffic are
 * never intercepted, cached or replayed. Dev-server module URLs are excluded too
 * so this file can never poison a running dev server.
 */
const VERSION = 'aurora-mind-v1';
const SHELL = ['/', '/manifest.webmanifest', '/favicon.svg', '/icon.svg', '/icon-maskable.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.includes('__vite')
  ) {
    return; // never touch the dev server
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put('/', copy)).catch(() => undefined);
          return response;
        })
        .catch(() => caches.match('/').then((hit) => hit || caches.match(request))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request).then((response) => {
        if (response && response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copy)).catch(() => undefined);
        }
        return response;
      });
    }),
  );
});
