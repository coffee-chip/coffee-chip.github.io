import { state } from '../state.js';
import { STORAGE_VERSION, getCachedDataCounts, getPersistentDataSnapshot, getStorageStatus } from '../storage.js';
import { getServiceWorkerDiagnostics } from '../serviceWorker.js';

function el(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text) node.textContent = options.text;
  return node;
}

function row(label, value, status = '') {
  const node = el('div', { className: `diagnostic-row ${status}`.trim() });
  node.append(el('span', { text: label }), el('strong', { text: String(value) }));
  return node;
}

function savedQuestionCount(progress) {
  return Object.values(progress.quizStats ?? {}).reduce((sum, stat) => sum + (stat.questionCount ?? 0), 0);
}

let debugLoadToken = 0;

export function renderDebug(container) {
  const token = ++debugLoadToken;
  const page = el('section', { className: 'page' });
  const back = el('a', { className: 'back-link', text: '← Back to settings' });
  back.href = '#settings';
  page.append(back, el('p', { className: 'panel muted', text: 'Loading diagnostics…' }));
  container.replaceChildren(page);

  void loadDiagnostics(page, back, token).catch(error => {
    if (token !== debugLoadToken || state.route !== 'debug' || !page.isConnected) return;
    page.replaceChildren(back, el('p', { className: 'panel pokemon-lookup-error', text: error?.message ?? 'Could not load diagnostics.' }));
  });
}

async function loadDiagnostics(page, back, token) {
  const [sw, cacheCounts] = await Promise.all([getServiceWorkerDiagnostics(), getCachedDataCounts()]);
  if (token !== debugLoadToken || state.route !== 'debug' || !page.isConnected) return;
  const saved = getPersistentDataSnapshot();
  const persistence = getStorageStatus();

  const worker = el('div', { className: 'panel diagnostic-panel' });
  worker.append(el('h3', { text: 'Service worker' }));
  worker.append(row('Supported', sw.supported ? 'Yes' : 'No', sw.supported ? 'ok' : 'bad'));
  worker.append(row('Status', sw.status, sw.status === 'error' ? 'bad' : 'ok'));
  worker.append(row('Installed version', sw.version ?? 'Unknown'));
  worker.append(row('Active cache', sw.cacheName ?? 'Unknown'));
  worker.append(row('Waiting update', sw.waiting ? 'Yes' : 'No'));
  worker.append(row('Known app caches', sw.cacheNames.length));
  for (const cacheName of sw.cacheNames) worker.append(row('Cache', cacheName));
  const storage = el('div', { className: 'panel diagnostic-panel' });
  storage.append(el('h3', { text: 'Persistent data' }));
  storage.append(row('Schema version', STORAGE_VERSION, 'ok'));
  storage.append(row('Backend', persistence.backend, persistence.backend === 'indexeddb' ? 'ok' : 'bad'));
  storage.append(row('App-state writes', persistence.appState, persistence.appState === 'error' ? 'bad' : 'ok'));
  storage.append(row('Pending app-state writes', persistence.pendingAppStateWrites));
  storage.append(row('Pending cache writes', persistence.pendingCacheWrites));
  storage.append(row('Last durable state save', persistence.lastAppStateCommit ?? 'Not yet'));
  if (persistence.lastError) storage.append(row('Last storage error', `${persistence.lastError.scope}: ${persistence.lastError.message}`, 'bad'));
  storage.append(row('Auto-update on launch', state.settings.developer.autoUpdateOnLaunch ? 'On' : 'Off'));
  storage.append(row('Saved questions', savedQuestionCount(saved.progress)));
  storage.append(row('Cached Pokémon', cacheCounts.pokemon));
  storage.append(row('Cached moves', cacheCounts.moves));
  storage.append(row('Autocomplete indexes', cacheCounts.nameIndexes));
  page.replaceChildren(back, worker, storage);
}
