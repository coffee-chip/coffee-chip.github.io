import { state, resetProgress } from '../state.js';
import { getCachedDataCounts, getPersistentDataSnapshot, saveProgress, saveSettings } from '../storage.js';
import { setGameVersionGroup } from '../data/gameSelection.js';
import { applyTheme, APPEARANCE_PREFERENCES, PALETTE_THEMES } from '../theme.js';
import { renderDeveloperOverlay } from '../developerOverlay.js';
import { clearGameDataCache } from '../data/pokemonRepository.js';
import { GAME_VERSION_GROUPS } from '../data/gameVersions.js';
import { serviceWorkerState, subscribeServiceWorker, checkForLatestVersion, applyWaitingUpdate, clearAppCaches } from '../serviceWorker.js';

let resetStage = 'idle';
let resetMessage = '';
let serviceMessage = '';
let pokemonCacheMessage = '';
let currentRender = null;
let cachedDataCounts = null;
let cachedDataCountsLoading = false;
subscribeServiceWorker(() => { if (state.route === 'settings' && currentRender) currentRender(); });

function el(tag, options = {}) { const node = document.createElement(tag); if (options.className) node.className = options.className; if (options.text) node.textContent = options.text; return node; }
function toggle(label, checked, onChange) { const field = el('label', { className: 'toggle-field' }); const input = document.createElement('input'); input.type = 'checkbox'; input.setAttribute('role', 'switch'); input.checked = checked; input.addEventListener('change', () => onChange(input.checked)); field.append(input, el('span', { text: label })); return field; }
function totalSavedQuestions(progress = state.progress) { return Object.values(progress.quizStats ?? {}).reduce((sum, stat) => sum + (stat.questionCount ?? 0), 0); }

function persistResetProgress() {
  resetProgress();
  const writeSucceeded = saveProgress(state.progress);
  const stored = getPersistentDataSnapshot().progress;
  const cleared = totalSavedQuestions(stored) === 0
    && Object.keys(stored.relationshipStats ?? {}).length === 0
    && Object.keys(stored.pokemonRecognitionStats ?? {}).length === 0;
  resetStage = writeSucceeded && cleared ? 'complete' : 'error';
  resetMessage = resetStage === 'complete'
    ? 'Past statistics were cleared and saved.'
    : 'Statistics could not be cleared.';
}

function refreshCachedDataCounts(render) {
  if (cachedDataCounts || cachedDataCountsLoading) return;
  cachedDataCountsLoading = true;
  getCachedDataCounts()
    .then(counts => {
      cachedDataCounts = counts;
      if (state.route === 'settings') render();
    })
    .catch(error => console.warn('Could not count cached Pokémon data.', error))
    .finally(() => { cachedDataCountsLoading = false; });
}

function cacheSummary() {
  if (!cachedDataCounts) return 'Cached Pokémon data: loading…';
  return `Cached Pokémon: ${cachedDataCounts.pokemon} · Cached moves: ${cachedDataCounts.moves} · Autocomplete indexes: ${cachedDataCounts.nameIndexes}`;
}

function statusLabel() {
  const labels = { unsupported: 'Unsupported', 'not-registered': 'Not registered', registering: 'Registering', active: 'Active', checking: 'Checking for updates', updating: 'Downloading update', 'update-ready': 'Update ready', 'applying-update': 'Applying update', error: 'Error' };
  return labels[serviceWorkerState.status] ?? serviceWorkerState.status;
}

function appendGameDataControl(panel, render) {
  const gameLabel = el('label', { className: 'settings-field' });
  gameLabel.append(el('span', { text: 'Game' }));
  const gameSelect = el('select');
  let currentGeneration = null;
  let group = null;
  for (const game of GAME_VERSION_GROUPS) {
    if (game.generation !== currentGeneration) {
      currentGeneration = game.generation;
      group = document.createElement('optgroup');
      group.label = currentGeneration;
      gameSelect.append(group);
    }
    const option = document.createElement('option');
    option.value = game.id;
    option.textContent = game.label;
    option.selected = state.settings.gameVersionGroup === game.id;
    group.append(option);
  }
  gameSelect.addEventListener('change', async () => {
    gameSelect.disabled = true;
    await setGameVersionGroup(gameSelect.value);
    cachedDataCounts = { pokemon: 0, moves: 0, nameIndexes: 0 };
    render();
  });
  gameLabel.append(gameSelect);
  panel.append(gameLabel);
}

function appendAppearanceControls(panel) {
  const paletteLabel = el('label', { className: 'settings-field' });
  paletteLabel.append(el('span', { text: 'Color theme' }));
  const paletteSelect = el('select');
  const paletteLabels = { classic: 'Classic' };
  for (const palette of PALETTE_THEMES) {
    const option = document.createElement('option');
    option.value = palette;
    option.textContent = paletteLabels[palette] ?? palette;
    option.selected = state.settings.paletteTheme === palette;
    paletteSelect.append(option);
  }
  paletteSelect.addEventListener('change', () => {
    state.settings.paletteTheme = paletteSelect.value;
    applyTheme(state.settings.paletteTheme, state.settings.appearance);
    saveSettings(state.settings);
  });
  paletteLabel.append(paletteSelect);

  const appearanceLabel = el('label', { className: 'settings-field' });
  appearanceLabel.append(el('span', { text: 'Appearance' }));
  const appearanceSelect = el('select');
  const appearanceLabels = { system: 'Follow device', light: 'Light', dark: 'Dark' };
  for (const preference of APPEARANCE_PREFERENCES) {
    const option = document.createElement('option');
    option.value = preference;
    option.textContent = appearanceLabels[preference];
    option.selected = state.settings.appearance === preference;
    appearanceSelect.append(option);
  }
  appearanceSelect.addEventListener('change', () => {
    state.settings.appearance = appearanceSelect.value;
    applyTheme(state.settings.paletteTheme, state.settings.appearance);
    saveSettings(state.settings);
  });
  appearanceLabel.append(appearanceSelect);
  panel.append(paletteLabel, appearanceLabel);
}

export function renderSettings(container, render) {
  currentRender = render;
  refreshCachedDataCounts(render);
  const page = el('section', { className: 'page' });

  const preferences = el('div', { className: 'panel settings-section' });
  preferences.append(el('h3', { text: 'Preferences' }));
  appendGameDataControl(preferences, render);
  appendAppearanceControls(preferences);
  preferences.append(el('p', { className: 'muted', text: `Default quiz type: ${state.settings.quiz.defaultMode}.` }));
  const debugLink = el('a', { className: 'button-link', text: 'Developer diagnostics' });
  debugLink.href = '#debug';
  preferences.append(debugLink);
  page.append(preferences);

  const developerPanel = el('div', { className: 'panel settings-section' });
  developerPanel.append(el('h3', { text: 'Developer tools' }));
  developerPanel.append(el('p', { text: `Service worker: ${statusLabel()}` }));
  developerPanel.append(el('p', { className: 'muted', text: `Installed version: ${serviceWorkerState.version ?? 'Unknown'} · App caches: ${serviceWorkerState.cacheNames.length}` }));
  developerPanel.append(toggle('Show developer status overlay', state.settings.developer.showOverlay, checked => {
    state.settings.developer.showOverlay = checked;
    saveSettings(state.settings);
    renderDeveloperOverlay();
  }));
  developerPanel.append(toggle('Show application errors in an overlay', state.settings.developer.showErrorOverlay, checked => {
    state.settings.developer.showErrorOverlay = checked;
    saveSettings(state.settings);
    window.pokemonErrorOverlay?.setEnabled(checked);
    testErrorButton.disabled = !checked;
  }));
  const testErrorButton = el('button', { className: 'secondary-button', text: 'Test error overlay' });
  testErrorButton.type = 'button';
  testErrorButton.disabled = !state.settings.developer.showErrorOverlay;
  testErrorButton.addEventListener('click', () => window.pokemonErrorOverlay?.showTestError());
  developerPanel.append(testErrorButton);
  developerPanel.append(toggle('Automatically check for and apply updates on launch', state.settings.developer.autoUpdateOnLaunch, checked => { state.settings.developer.autoUpdateOnLaunch = checked; saveSettings(state.settings); }));

  const updateActions = el('div', { className: 'actions' });
  const checkButton = el('button', { className: 'primary-button', text: 'Get latest version' });
  checkButton.type = 'button';
  checkButton.disabled = !serviceWorkerState.supported || ['checking', 'updating', 'applying-update'].includes(serviceWorkerState.status);
  checkButton.addEventListener('click', async () => { serviceMessage = ''; await checkForLatestVersion(); serviceMessage = serviceWorkerState.message; render(); });
  updateActions.append(checkButton);
  if (serviceWorkerState.status === 'update-ready') {
    const applyButton = el('button', { className: 'primary-button', text: 'Update now' });
    applyButton.type = 'button';
    applyButton.addEventListener('click', () => applyWaitingUpdate());
    updateActions.append(applyButton);
  }
  const clearButton = el('button', { className: 'secondary-button', text: 'Clear app cache' });
  clearButton.type = 'button';
  clearButton.addEventListener('click', async () => { await clearAppCaches(); serviceMessage = serviceWorkerState.message; render(); });
  updateActions.append(clearButton);
  developerPanel.append(updateActions);

  developerPanel.append(el('p', { className: 'muted', text: cacheSummary() }));
  const clearPokemonButton = el('button', { className: 'secondary-button', text: 'Clear Pokémon cache' });
  clearPokemonButton.type = 'button';
  clearPokemonButton.addEventListener('click', async () => {
    clearPokemonButton.disabled = true;
    try {
      await clearGameDataCache();
      cachedDataCounts = { pokemon: 0, moves: 0, nameIndexes: 0 };
      pokemonCacheMessage = 'Pokémon records, move data, and autocomplete names were cleared.';
    } catch (error) {
      console.warn('Could not clear cached Pokémon data.', error);
      pokemonCacheMessage = 'Pokémon cache could not be cleared.';
    }
    render();
  });
  developerPanel.append(clearPokemonButton);

  if (serviceMessage || serviceWorkerState.message) { const status = el('p', { className: 'settings-status', text: serviceMessage || serviceWorkerState.message }); status.setAttribute('role', 'status'); developerPanel.append(status); }
  if (pokemonCacheMessage) { const status = el('p', { className: 'settings-status', text: pokemonCacheMessage }); status.setAttribute('role', 'status'); developerPanel.append(status); }
  page.append(developerPanel);

  const dataPanel = el('div', { className: 'panel danger-zone' });
  dataPanel.append(el('h3', { text: 'Statistics' }));
  dataPanel.append(el('p', { text: `Saved questions answered: ${totalSavedQuestions()}. Clearing statistics removes quiz, matchup, and Pokémon recognition progress, but keeps quiz preferences and cached Pokémon.` }));
  if (resetStage === 'confirming') {
    const confirmPanel = el('div', { className: 'inline-confirmation' });
    confirmPanel.append(el('p', { text: 'Clear all saved quiz statistics? This cannot be undone.' }));
    const actions = el('div', { className: 'actions' });
    const cancelButton = el('button', { className: 'secondary-button', text: 'Cancel' });
    cancelButton.type = 'button'; cancelButton.addEventListener('click', () => { resetStage = 'idle'; resetMessage = ''; render(); });
    const confirmButton = el('button', { className: 'danger-button', text: 'Yes, clear statistics' });
    confirmButton.type = 'button'; confirmButton.addEventListener('click', () => { persistResetProgress(); render(); });
    actions.append(cancelButton, confirmButton); confirmPanel.append(actions); dataPanel.append(confirmPanel);
  } else {
    const resetButton = el('button', { className: 'danger-button', text: 'Clear past statistics' });
    resetButton.type = 'button'; resetButton.addEventListener('click', () => { resetStage = 'confirming'; resetMessage = ''; render(); }); dataPanel.append(resetButton);
  }
  if (resetMessage) { const status = el('p', { className: `settings-status ${resetStage === 'error' ? 'error' : 'success'}`, text: resetMessage }); status.setAttribute('role', 'status'); dataPanel.append(status); }
  page.append(dataPanel);
  container.replaceChildren(page);
}
