import { state } from './state.js';
import { serviceWorkerState, subscribeServiceWorker } from './serviceWorker.js';

const APP_BUILD = '2026.08.03.7';
let overlay = null;
let unsubscribe = null;

function line(label, value) {
  const row = document.createElement('div');
  row.className = 'developer-overlay-row';
  const key = document.createElement('span');
  key.textContent = label;
  const val = document.createElement('strong');
  val.textContent = String(value);
  row.append(key, val);
  return row;
}

function updateOverlay() {
  if (!overlay) return;
  overlay.replaceChildren(
    line('App', APP_BUILD),
    line('Route', state.route),
    line('Hash', location.hash || '(none)'),
    line('Online', navigator.onLine ? 'Yes' : 'No'),
    line('SW status', serviceWorkerState.status),
    line('SW version', serviceWorkerState.version ?? 'Unknown'),
    line('Controlled', navigator.serviceWorker?.controller ? 'Yes' : 'No'),
    line('Caches', serviceWorkerState.cacheNames.length)
  );
}

export function renderDeveloperOverlay() {
  const enabled = state.settings.developer.showOverlay === true;
  if (!enabled) {
    overlay?.remove();
    overlay = null;
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    return;
  }

  if (!overlay) {
    overlay = document.createElement('aside');
    overlay.className = 'developer-overlay';
    overlay.setAttribute('aria-label', 'Developer status overlay');
    document.body.append(overlay);
    unsubscribe = subscribeServiceWorker(updateOverlay);
  }
  updateOverlay();
}

window.addEventListener('online', updateOverlay);
window.addEventListener('offline', updateOverlay);
window.addEventListener('hashchange', updateOverlay);
navigator.serviceWorker?.addEventListener('controllerchange', updateOverlay);
