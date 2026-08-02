import { state, resetProgress } from '../state.js';
import { saveProgress } from '../storage.js';

function el(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text) node.textContent = options.text;
  return node;
}

export function renderSettings(container, render) {
  const page = el('section', { className: 'page' });
  page.append(el('h2', { text: 'Settings' }));

  const preferences = el('div', { className: 'panel' });
  preferences.append(el('h3', { text: 'Preferences' }));
  preferences.append(el('p', {
    text: `Theme preference: ${state.settings.theme}. Default quiz type: ${state.settings.quiz.defaultMode}.`
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

  const resetButton = el('button', { className: 'danger-button', text: 'Clear past statistics' });
  resetButton.type = 'button';
  resetButton.addEventListener('click', () => {
    const confirmed = window.confirm(
      'Clear all saved quiz statistics? This cannot be undone. Quiz settings and cached Pokémon will be kept.'
    );
    if (!confirmed) return;

    resetProgress();
    const saved = saveProgress(state.progress);
    if (!saved) {
      window.alert('Statistics were cleared for this session, but could not be saved. They may return after reloading.');
    }
    render();
  });

  dataPanel.append(resetButton);
  page.append(dataPanel);
  container.replaceChildren(page);
}
