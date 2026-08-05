const APP_VERSION = '2026.08.05.2';
const CACHE_PREFIX = 'pokemon-type-trainer-shell-';
const CACHE_NAME = `${CACHE_PREFIX}${APP_VERSION}`;
const CORE_ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './css/color-tokens.css',
  './css/service-worker.css',
  './css/developer-overlay.css',
  './css/progress.css',
  './css/mnemonics.css',
  './css/pokemon-lookup.css',
  './css/study-navigation.css',
  './css/quiz-pokemon.css',
  './js/errorOverlayBootstrap.js',
  './js/app.js',
  './js/appValidation.js',
  './js/serviceWorker.js',
  './js/developerOverlay.js',
  './js/theme.js',
  './js/state.js',
  './js/storage.js',
  './js/relationships.js',
  './js/api/pokeApi.js',
  './js/components/typeBadge.js',
  './js/components/mnemonicBadge.js',
  './js/components/pokemonAutocomplete.js',
  './js/components/pokemonMatchups.js',
  './js/components/pokemonMatchupEnhancer.js',
  './js/components/pokemonEvolutionControls.js',
  './js/components/studyTabs.js',
  './js/components/quizRecognitionSettings.js',
  './js/components/quizAutoScroll.js',
  './js/data/types.js',
  './js/data/mnemonics.js',
  './js/data/pokemonRepository.js',
  './js/quiz/generators.js',
  './js/quiz/modes.js',
  './js/quiz/scoring.js',
  './js/quiz/validation.js',
  './js/views/index.js',
  './js/views/quiz.js',
  './js/views/study.js',
  './js/views/progress.js',
  './js/views/settings.js',
  './js/views/debug.js',
  './manifest.webmanifest',
  './icons/app-icon.svg'
];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS))); });
self.addEventListener('activate', event => { event.waitUntil((async () => { const names = await caches.keys(); await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map(name => caches.delete(name))); await self.clients.claim(); })()); });
self.addEventListener('message', event => { if (event.data?.type === 'SKIP_WAITING') self.skipWaiting(); if (event.data?.type === 'GET_VERSION') event.source?.postMessage({ type: 'SW_VERSION', version: APP_VERSION, cacheName: CACHE_NAME }); });
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => { try { const response = await fetch(request); const cache = await caches.open(CACHE_NAME); cache.put('./index.html', response.clone()); return response; } catch { return (await caches.match('./index.html')) || (await caches.match('./')); } })());
    return;
  }
  event.respondWith((async () => { const cached = await caches.match(request); const network = fetch(request).then(async response => { if (response.ok) { const cache = await caches.open(CACHE_NAME); cache.put(request, response.clone()); } return response; }).catch(() => null); return cached || (await network) || Response.error(); })());
});
