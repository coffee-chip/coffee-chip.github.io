import { state, getQuizModeSettings } from '../state.js';
import { saveSettings } from '../storage.js';
import { POKEMON_POOLS, SAMPLING_STRATEGIES } from '../quiz/generators.js';

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
  if (!form || form.querySelector('.quiz-sampling-setting')) return;

  const modeSelect = form.querySelector('select');
  const startButton = form.querySelector('button');
  if (!modeSelect || !startButton) return;

  const recognitionSettings = getQuizModeSettings('pokemon-type-recognition');
  recognitionSettings.pokemonPool ??= 'gen-1';

  const poolSelect = createSelect(POKEMON_POOLS, recognitionSettings.pokemonPool);
  const strategySelect = createSelect(SAMPLING_STRATEGIES, getQuizModeSettings(modeSelect.value).samplingStrategy ?? 'adaptive');
  const poolField = createField('Pokémon pool', poolSelect, 'quiz-recognition-pool');
  const strategyField = createField('Sampling', strategySelect, 'quiz-sampling-setting');

  function updateForMode() {
    const modeId = modeSelect.value;
    const settings = getQuizModeSettings(modeId);
    settings.samplingStrategy ??= 'adaptive';
    strategySelect.value = settings.samplingStrategy;
    poolField.hidden = modeId !== 'pokemon-type-recognition';
  }

  poolSelect.addEventListener('change', () => {
    getQuizModeSettings('pokemon-type-recognition').pokemonPool = poolSelect.value;
    saveSettings(state.settings);
  });
  strategySelect.addEventListener('change', () => {
    getQuizModeSettings(modeSelect.value).samplingStrategy = strategySelect.value;
    saveSettings(state.settings);
  });
  modeSelect.addEventListener('change', updateForMode);

  form.insertBefore(poolField, startButton);
  form.insertBefore(strategyField, startButton);
  updateForMode();
}
