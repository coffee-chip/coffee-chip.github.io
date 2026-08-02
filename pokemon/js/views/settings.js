import { state, resetProgress } from '../state.js';
import { loadPersistentData, saveProgress, saveSettings } from '../storage.js';
import { applyTheme, THEME_PREFERENCES } from '../theme.js';
import {
  serviceWorkerState,
  subscribeServiceWorker,
  checkForLatestVersion,
  applyWaitingUpdate,
  clearAppCaches
} from '../serviceWorker.js';

let resetStage = 'idle';
let resetMessage = '';
let serviceMessage = '';
let unsubscribe = null;

function el(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text) node.textContent = options.text;
  return node;
}

function persistResetProgress() {
  resetProgress();
  const writeSucceeded = saveProgress(state.progress);
  const stored = loadPersistentData().progress;
  const persistedAsCleared = stored.totalAnswered === 0 && stored.totalScore === 0 && Object.keys(stored.relationshipStats ?? {}).length === 0;
  if (writeSucceeded && persistedAsCleared) {
    resetStage = 'complete';
    resetMessage = 'Past statistics were cleared and saved.';
  } else {
    resetStage = 'error';
    resetMessage = 'Statistics were cleared for this session, but could not be confirmed in browser storage. They may return after reloading.';
  }
}

function statusLabel() {
  const labels = {
    unsupported: 'Unsupported',
    'not-registered': 'Not registered',
    registering: 'Registering',
    active: 'Active',
    checking: 'Checking for updates',
    updating: 'Downloading update',
    'update-ready': 'Update ready',
    'applying-update': 'Applying update',
    error: 'Error'
  };
  return labels[serviceWorkerState.status] ?? serviceWorkerState.status;
}

export function renderSettings(container, render) {
  if (unsubscribe) unsubscribe();
  unsubscribe = subscribeServiceWorker(() => {
    if (state.route === 'settings') render();
  });

  const page = el('section', { className: 'page' });
  page.append(el('h2', { text: 'Settings' }));

  const preferences = el('div', { className: 'panel settings-section' });
  preferences.append(el('h3', { text: 'Preferences' }));
  const themeLabel = el('label', { className: 'settings-field' });
  themeLabel.append(el('span', { text: 'Theme' }));
  const themeSelect = el('select');
  const labels = { system: 'Follow device', light: 'Light', dark: 'Dark' };
  for (const preference of THEME_PREFERENCES) {
    const option = document.createElement('option');
    option.value = preference;
    option.textContent = labels[preference];
    option.selected = state.settings.theme === preference;
    themeSelect.append(option);
  }
  themeSelect.addEventListener('change', () => {
    state.settings.theme = themeSelect.value;
    applyTheme(state.settings.theme);
    saveSettings(state.settings);
  });
  themeLabel.append(themeSelect);
  preferences.append(themeLabel);
  preferences.append(el('p', { className: 'muted', text: `Default quiz type: ${state.settings.quiz.defaultMode}.` }));
  const debugLink = el('a', { className: 'button-link', text: 'Developer diagnostics' });
  debugLink.href = '#debug';
  preferences.append(debugLink);
  page.append(preferences);

  const developerPanel = el('div', { className: 'panel settings-section' });
  developerPanel.append(el('h3', { text: 'App updates and cache' }));
  developerPanel.append(el('p', { text: `Service worker: ${statusLabel()}` }));
  developerPanel.append(el('p', { className: 'muted', text: `Installed version: ${serviceWorkerState.version ?? 'Unknown'} · App caches: ${serviceWorkerState.cacheNames.length}` }));

  const autoLabel = el('label', { className: 'toggle-field' });
  const auto = document.createElement('input');
  auto.type = 'checkbox';
  auto.checked = state.settings.developer.autoUpdateOnLaunch;
  auto.addEventListener('change', () => {
    state.settings.developer.autoUpdateOnLaunch = auto.checked;
    saveSettings(state.settings);
  });
  autoLabel.append(auto, el('span', { text: 'Automatically check for and apply updates on launch' }));
  developerPanel.append(autoLabel);

  const updateActions = el('div', { className: 'actions' });
  const checkButton = el('button', { text: 'Get latest version' });
  checkButton.type = 'button';
  checkButton.disabled = !serviceWorkerState.supported || ['checking', 'updating', 'applying-update'].includes(serviceWorkerState.status);
  checkButton.addEventListener('click', async () => {
    serviceMessage = '';
    await checkForLatestVersion();
    serviceMessage = serviceWorkerState.message;
    render();
  });
  updateActions.append(checkButton);

  if (serviceWorkerState.status === 'update-ready') {
    const applyButton = el('button', { text: 'Update now' });
    applyButton.type = 'button';
    applyButton.addEventListener('click', () => applyWaitingUpdate());
    updateActions.append(applyButton);
  }

  const clearButton = el('button', { className: 'secondary-button', text: 'Clear app cache' });
  clearButton.type = 'button';
  clearButton.addEventListener('click', async () => {
    const onlineWarning = navigator.onLine ? '' : ' You are offline, so the app may not reopen until you reconnect.';
    const confirmed = window.confirm(`Clear cached app files? Quiz statistics and preferences will be kept.${onlineWarning}`);
    if (!confirmed) return;
    await clearAppCaches();
    serviceMessage = serviceWorkerState.message;
    render();
  });
  updateActions.append(clearButton);
  developerPanel.append(updateActions);

  if (serviceMessage || serviceWorkerState.message) {
    const status = el('p', { className: 'settings-status', text: serviceMessage || serviceWorkerState.message });
    status.setAttribute('role', 'status');
    developerPanel.append(status);
  }
  page.append(developerPanel);

  const dataPanel = el('div', { className: 'panel danger-zone' });
  dataPanel.append(el('h3', { text: 'Statistics' }));
  dataPanel.append(el('p', { text: `Saved questions answered: ${state.progress.totalAnswered}. Clearing statistics removes overall and relationship-level progress, but keeps quiz preferences and cached Pokémon.` }));
  if (resetStage === 'confirming') {
    const confirmPanel = el('div', { className: 'inline-confirmation' });
    confirmPanel.append(el('p', { text: 'Clear all saved quiz statistics? This cannot be undone.' }));
    const actions = el('div', { className: 'actions' });
    const cancelButton = el('button', { className: 'secondary-button', text: 'Cancel' });
    cancelButton.type = 'button';
    cancelButton.addEventListener('click', () => { resetStage = 'idle'; resetMessage = ''; render(); });
    const confirmButton = el('button', { className: 'danger-button', text: 'Yes, clear statistics' });
    confirmButton.type = 'button';
    confirmButton.addEventListener('click', () => { persistResetProgress(); render(); });
    actions.append(cancelButton, confirmButton);
    confirmPanel.append(actions);
    dataPanel.append(confirmPanel);
  } else {
    const resetButton = el('button', { className: 'danger-button', text: 'Clear past statistics' });
    resetButton.type = 'button';
    resetButton.addEventListener('click', () => { resetStage = 'confirming'; resetMessage = ''; render(); });
    dataPanel.append(resetButton);
  }
  if (resetMessage) {
    const status = el('p', { className: `settings-status ${resetStage === 'error' ? 'error' : 'success'}`, text: resetMessage });
    status.setAttribute('role', 'status');
    dataPanel.append(status);
  }
  page.append(dataPanel);
  container.replaceChildren(page);
}
