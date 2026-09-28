const CACHE_NAME = 'piggy-budget-v4';
const CACHE_PREFIX = 'piggy-budget-';
const APP_FILES = [
  './',
  './index.html',
  './settings.html',
  './transactions.html',
  './styles.css',
  './app.js',
  './budget.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(
      names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
        .map((name) => caches.delete(name))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  event.respondWith(fetch(request).catch(async () =>
    (await caches.match(request, { ignoreSearch: true })) ||
    (request.mode === 'navigate' ? caches.match('./index.html') : Response.error())
  ));
});
