import { state, resetProgress } from '../state.js';
import { loadPersistentData, saveProgress, saveSettings } from '../storage.js';
import { applyTheme, THEME_PREFERENCES } from '../theme.js';

let resetStage = 'idle';
let resetMessage = '';

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
  const persistedAsCleared = stored.totalAnswered === 0
    && stored.totalScore === 0
    && Object.keys(stored.relationshipStats ?? {}).length === 0;

  if (writeSucceeded && persistedAsCleared) {
    resetStage = 'complete';
    resetMessage = 'Past statistics were cleared and saved.';
  } else {
    resetStage = 'error';
    resetMessage = 'Statistics were cleared for this session, but could not be confirmed in browser storage. They may return after reloading.';
  }
}

export function renderSettings(container, render) {
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
    render();
  });
  themeLabel.append(themeSelect);
  preferences.append(themeLabel);

  preferences.append(el('p', {
    className: 'muted',
    text: `Default quiz type: ${state.settings.quiz.defaultMode}.`
  }));
  const debugLink = el('a', { className: 'button-link', text: 'Developer diagnostics' });
  debugLink.href = '#debug';
  preferences.append(debugLink);
  page.append(preferences);

  const dataPanel = el('div', { className: 'panel danger-zone' });
  dataPanel.append(el('h3', { text: 'Statistics' }));
  dataPanel.append(el('p', {
    text: `Saved questions answered: ${state.progress.totalAnswered}. Clearing statistics removes overall and relationship-level progress, but keeps quiz preferences and cached Pokémon.`
  }));

  if (resetStage === 'confirming') {
    const confirmPanel = el('div', { className: 'inline-confirmation' });
    confirmPanel.append(el('p', { text: 'Clear all saved quiz statistics? This cannot be undone.' }));
    const actions = el('div', { className: 'actions' });
    const cancelButton = el('button', { className: 'secondary-button', text: 'Cancel' });
    cancelButton.type = 'button';
    cancelButton.addEventListener('click', () => {
      resetStage = 'idle';
      resetMessage = '';
      render();
    });
    const confirmButton = el('button', { className: 'danger-button', text: 'Yes, clear statistics' });
    confirmButton.type = 'button';
    confirmButton.addEventListener('click', () => {
      persistResetProgress();
      render();
    });
    actions.append(cancelButton, confirmButton);
    confirmPanel.append(actions);
    dataPanel.append(confirmPanel);
  } else {
    const resetButton = el('button', { className: 'danger-button', text: 'Clear past statistics' });
    resetButton.type = 'button';
    resetButton.addEventListener('click', () => {
      resetStage = 'confirming';
      resetMessage = '';
      render();
    });
    dataPanel.append(resetButton);
  }

  if (resetMessage) {
    const status = el('p', {
      className: `settings-status ${resetStage === 'error' ? 'error' : 'success'}`,
      text: resetMessage
    });
    status.setAttribute('role', 'status');
    dataPanel.append(status);
  }

  page.append(dataPanel);
  container.replaceChildren(page);
}
