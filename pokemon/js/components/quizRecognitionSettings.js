import { state, getQuizModeSettings } from '../state.js';
import { saveSettings } from '../storage.js';
import { POKEMON_POOLS, POKEMON_SAMPLING_STRATEGIES } from '../quiz/generators.js';

function createSelect(options, value) {
  const select = document.createElement('select');
  for (const optionDefinition of Object.values(options)) {
    const option = document.createElement('option');
    option.value = optionDefinition.id;
    option.textContent = optionDefinition.label;
    option.selected = optionDefinition.id === value;
    select.append(option);
  }
  return select;
}

function createField(labelText, select, className) {
  const label = document.createElement('label');
  label.className = className;
  const text = document.createElement('span');
  text.textContent = labelText;
  label.append(text, select);
  return label;
}

export function enhanceQuizRecognitionSettings(root) {
  if (state.route !== 'quiz' || state.quiz.status !== 'idle') return;
  const form = root.querySelector('.quiz-setup');
  if (!form || form.querySelector('.quiz-recognition-pool')) return;

  const modeSelect = form.querySelector('select');
  const startButton = form.querySelector('button');
  if (!modeSelect || !startButton) return;

  const modeSettings = getQuizModeSettings('pokemon-type-recognition');
  modeSettings.pokemonPool ??= 'gen-1';
  modeSettings.samplingStrategy ??= 'adaptive';

  const poolSelect = createSelect(POKEMON_POOLS, modeSettings.pokemonPool);
  const strategySelect = createSelect(POKEMON_SAMPLING_STRATEGIES, modeSettings.samplingStrategy);
  const poolField = createField('Pokémon pool', poolSelect, 'quiz-recognition-pool');
  const strategyField = createField('Sampling', strategySelect, 'quiz-recognition-sampling');

  function updateVisibility() {
    const visible = modeSelect.value === 'pokemon-type-recognition';
    poolField.hidden = !visible;
    strategyField.hidden = !visible;
  }

  poolSelect.addEventListener('change', () => {
    getQuizModeSettings('pokemon-type-recognition').pokemonPool = poolSelect.value;
    saveSettings(state.settings);
  });
  strategySelect.addEventListener('change', () => {
    getQuizModeSettings('pokemon-type-recognition').samplingStrategy = strategySelect.value;
    saveSettings(state.settings);
  });
  modeSelect.addEventListener('change', updateVisibility);

  form.insertBefore(poolField, startButton);
  form.insertBefore(strategyField, startButton);
  updateVisibility();
}
