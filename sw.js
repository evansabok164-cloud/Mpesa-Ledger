// sw.js
// Caches the app shell (HTML/manifest/icons) so the app opens instantly
// and works offline for the UI. Firestore data and API calls are never
// cached here — they always go straight to the network, since this is
// live financial data that must never show stale.

const CACHE_NAME = 'mpesa-ledger-v1';
const SHELL_FILES = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Never cache Firestore, Google APIs, or our own backend calls —
  // this data must always be live.
  if (
    url.includes('firestore.googleapis.com') ||
    url.includes('googleapis.com') ||
    url.includes('/api/')
  ) {
    return; // let the browser handle it normally
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
