const CACHE_VERSION = 'architecture-2';
const CACHE_NAME = `piggy-budget-${CACHE_VERSION}`;
const CACHE_PREFIX = 'piggy-budget-';

const APP_FILES = [
  './',
  './index.html',
  './settings.html',
  './manage-categories.html',
  './transactions.html',
  './styles.css',
  './core.js',
  './home.js',
  './manage.js',
  './history.js',
  './settings.js',
  './budget.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/settings.svg',
  './icons/edit.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(
        APP_FILES.map(path => new Request(new URL(path, self.registration.scope), { cache: 'reload' }))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names
          .filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
          .map(name => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    !url.pathname.startsWith(new URL(self.registration.scope).pathname)
  ) return;

  event.respondWith(
    fetch(request).catch(async () =>
      (await caches.match(request, { ignoreSearch: true })) ||
      (request.mode === 'navigate' ? caches.match('./index.html') : Response.error())
    )
  );
});
