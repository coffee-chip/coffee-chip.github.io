const listeners = new Set();

export const serviceWorkerState = {
  supported: 'serviceWorker' in navigator,
  status: 'not-registered',
  registration: null,
  waiting: null,
  version: null,
  cacheName: null,
  cacheNames: [],
  message: ''
};

function emit() {
  for (const listener of listeners) listener({ ...serviceWorkerState });
}

export function subscribeServiceWorker(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function refreshCacheNames() {
  if (!('caches' in window)) return;
  serviceWorkerState.cacheNames = await caches.keys();
}

function watchRegistration(registration) {
  serviceWorkerState.registration = registration;
  serviceWorkerState.waiting = registration.waiting;
  serviceWorkerState.status = registration.waiting ? 'update-ready' : 'active';

  registration.addEventListener('updatefound', () => {
    serviceWorkerState.status = 'updating';
    emit();
    const worker = registration.installing;
    worker?.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) {
        serviceWorkerState.waiting = registration.waiting || worker;
        serviceWorkerState.status = 'update-ready';
        emit();
      }
    });
  });
}

export async function registerServiceWorker({ autoUpdate = false } = {}) {
  if (!serviceWorkerState.supported) {
    serviceWorkerState.status = 'unsupported';
    emit();
    return null;
  }

  try {
    serviceWorkerState.status = 'registering';
    emit();
    const registration = await navigator.serviceWorker.register('./service-worker.js', { scope: './' });
    watchRegistration(registration);
    await refreshCacheNames();
    registration.active?.postMessage({ type: 'GET_VERSION' });
    if (autoUpdate) await checkForLatestVersion({ applyImmediately: true });
    emit();
    return registration;
  } catch (error) {
    serviceWorkerState.status = 'error';
    serviceWorkerState.message = error.message;
    emit();
    return null;
  }
}

navigator.serviceWorker?.addEventListener('message', event => {
  if (event.data?.type !== 'SW_VERSION') return;
  serviceWorkerState.version = event.data.version;
  serviceWorkerState.cacheName = event.data.cacheName;
  emit();
});

let refreshing = false;
navigator.serviceWorker?.addEventListener('controllerchange', () => {
  if (refreshing) return;
  refreshing = true;
  window.location.reload();
});

export async function checkForLatestVersion({ applyImmediately = false } = {}) {
  const registration = serviceWorkerState.registration || await navigator.serviceWorker?.getRegistration('./');
  if (!registration) return false;
  serviceWorkerState.status = 'checking';
  serviceWorkerState.message = '';
  emit();
  try {
    await registration.update();
    serviceWorkerState.waiting = registration.waiting;
    if (registration.waiting) {
      serviceWorkerState.status = 'update-ready';
      if (applyImmediately) applyWaitingUpdate();
    } else {
      serviceWorkerState.status = 'active';
      serviceWorkerState.message = 'You already have the latest available version.';
    }
    await refreshCacheNames();
    emit();
    return true;
  } catch (error) {
    serviceWorkerState.status = 'error';
    serviceWorkerState.message = `Update check failed: ${error.message}`;
    emit();
    return false;
  }
}

export function applyWaitingUpdate() {
  const worker = serviceWorkerState.waiting || serviceWorkerState.registration?.waiting;
  if (!worker) return false;
  serviceWorkerState.status = 'applying-update';
  emit();
  worker.postMessage({ type: 'SKIP_WAITING' });
  return true;
}

export async function clearAppCaches() {
  if (!('caches' in window)) return false;
  const names = await caches.keys();
  const appNames = names.filter(name => name.startsWith('pokemon-type-trainer-shell-'));
  const results = await Promise.all(appNames.map(name => caches.delete(name)));
  await refreshCacheNames();
  serviceWorkerState.message = results.every(Boolean) ? 'App cache cleared. Reload while online to rebuild it.' : 'Some cache entries could not be cleared.';
  emit();
  return results.every(Boolean);
}

export async function getServiceWorkerDiagnostics() {
  await refreshCacheNames();
  return { ...serviceWorkerState };
}
