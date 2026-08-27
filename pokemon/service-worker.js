const APP_VERSION = '2026.08.27.6';
const CACHE_PREFIX = 'pokemon-type-trainer-shell-';
const CACHE_NAME = `${CACHE_PREFIX}${APP_VERSION}`;
const CORE_ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './css/page-header.css',
  './css/color-tokens.css',
  './css/service-worker.css',
  './css/developer-overlay.css',
  './css/progress.css',
  './css/mnemonics.css',
  './css/pokemon-lookup.css',
  './css/pokemon-moves.css',
  './css/study-navigation.css',
  './css/quiz-pokemon.css',
  './css/teams.css',
  './css/owned-pokemon.css',
  './css/team-member-controls.css',
  './css/team-actions-menu.css',
  './css/team-rival.css',
  './js/errorOverlayBootstrap.js',
  './js/app.js',
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
  './js/components/pokemonLevelUpMoves.js',
  './js/components/pokemonEncounterLocations.js',
  './js/components/pokemonEvolutionControls.js',
  './js/components/overflowMenuButton.js',
  './js/components/pokemonTeamMenu.js',
  './js/components/pokemonStudyNavigation.js',
  './js/components/teamOverviewNavigation.js',
  './js/components/teamActionsMenu.js',
  './js/components/teamMemberStudyLink.js',
  './js/components/teamRivalLink.js',
  './js/components/studyTabs.js',
  './js/components/quizAutoScroll.js',
  './js/data/types.js',
  './js/data/mnemonics.js',
  './js/data/gameVersions.js',
  './js/data/gameSelection.js',
  './js/data/pokemonRecognition.js',
  './js/data/moveRepository.js',
  './js/data/starredMoveRepository.js',
  './js/data/pokemonRepository.js',
  './js/data/pokemonInstanceRepository.js',
  './js/data/teamRepository.js',
  './js/engine/pokemonAdvantage.js',
  './js/engine/effectiveness.js',
  './js/quiz/battleScenarioQuestions.js',
  './js/quiz/battleScenarioExplanations.js',
  './js/quiz/generators.js',
  './js/quiz/displays.js',
  './js/quiz/modes.js',
  './js/quiz/scoring.js',
  './js/views/index.js',
  './js/views/quiz.js',
  './js/views/study.js',
  './js/views/teams.js',
  './js/views/ownedPokemon.js',
  './js/views/ownedPokemonDetail.js',
  './js/views/teamDetail.js',
  './js/views/progress.js',
  './js/views/settings.js',
  './js/views/debug.js',
  './js/router.js',
  './manifest.webmanifest',
  './icons/app-icon.svg',
  './icons/drag-handle.svg'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS)));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => { if (event.data?.type === 'SKIP_WAITING') self.skipWaiting(); if (event.data?.type === 'GET_VERSION') event.source?.postMessage({ type: 'SW_VERSION', version: APP_VERSION, cacheName: CACHE_NAME }); });
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    // A controlled client always receives the HTML from its active worker's
    // immutable shell. This prevents new HTML from importing old cached modules.
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      return (await cache.match('./index.html')) || (await cache.match('./')) || fetch(request);
    })());
    return;
  }
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Search only the active version cache and never rewrite shell entries at
    // runtime. A release is installed atomically or not activated at all.
    return (await cache.match(request)) || fetch(request);
  })());
});
