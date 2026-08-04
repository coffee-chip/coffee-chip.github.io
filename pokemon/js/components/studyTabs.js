import { state } from '../state.js';

const TAB_LABELS = {
  pokemon: 'Pokémon',
  offense: 'Attack matchups',
  defense: 'Defense matchups'
};

export function enhanceStudyTabs(root) {
  if (state.route !== 'study') return;
  const controls = root.querySelector('.study-controls');
  const modeSelect = controls?.querySelector('select');
  const modeLabel = modeSelect?.closest('label');
  if (!controls || !modeSelect || !modeLabel || controls.querySelector('.study-tabs')) return;

  const tabs = document.createElement('div');
  tabs.className = 'study-tabs';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Study mode');

  for (const mode of ['pokemon', 'offense', 'defense']) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'study-tab';
    button.textContent = TAB_LABELS[mode];
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(state.study.mode === mode));
    button.addEventListener('click', () => {
      if (state.study.mode === mode) return;
      modeSelect.value = mode;
      modeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    tabs.append(button);
  }

  controls.prepend(tabs);
  modeLabel.remove();
  controls.classList.add('study-controls-with-tabs');
}
