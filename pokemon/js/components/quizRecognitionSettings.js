import { state, getQuizModeSettings } from '../state.js';
import { saveSettings } from '../storage.js';
import { POKEMON_POOLS, SAMPLING_STRATEGIES } from '../quiz/generators.js';
import { normalizeQuizModeId } from '../quiz/modes.js';

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

const EFFECTIVENESS_OPTIONS = {
  'choose-switch': [
    { id: 'weak', label: 'Weak' },
    { id: 'resistant', label: 'Resistant or immune' },
    { id: 'both', label: 'Both' }
  ],
  'choose-move': [
    { id: 'more', label: 'More effective' },
    { id: 'less', label: 'Resisted or immune' },
    { id: 'both', label: 'Both' }
  ]
};

function populateEffectivenessSelect(select, modeId, selectedValue) {
  select.replaceChildren();
  for (const definition of EFFECTIVENESS_OPTIONS[modeId] ?? []) {
    const option = document.createElement('option');
    option.value = definition.id;
    option.textContent = definition.label;
    option.selected = definition.id === selectedValue;
    select.append(option);
  }
}

export function enhanceQuizRecognitionSettings(root) {
  if (state.route !== 'quiz' || state.quiz.status !== 'idle') return;
  const form = root.querySelector('.quiz-setup');
  if (!form || form.querySelector('.quiz-sampling-setting')) return;

  const modeSelect = form.querySelector('select');
  const startButton = form.querySelector('button');
  if (!modeSelect || !startButton) return;

  const normalizedModeId = normalizeQuizModeId(state.quiz.mode);
  if (normalizedModeId !== state.quiz.mode) {
    state.quiz.mode = normalizedModeId;
    state.settings.quiz.defaultMode = normalizedModeId;
    getQuizModeSettings(normalizedModeId);
    saveSettings(state.settings);
  }
  modeSelect.value = normalizedModeId;

  const recognitionSettings = getQuizModeSettings('pokemon-type-recognition');
  recognitionSettings.pokemonPool ??= 'gen-1';

  const poolSelect = createSelect(POKEMON_POOLS, recognitionSettings.pokemonPool);
  const strategySelect = createSelect(SAMPLING_STRATEGIES, getQuizModeSettings(normalizedModeId).samplingStrategy ?? 'adaptive');
  const effectivenessSelect = document.createElement('select');
  const poolField = createField('Pokémon pool', poolSelect, 'quiz-recognition-pool');
  const strategyField = createField('Sampling', strategySelect, 'quiz-sampling-setting');
  const effectivenessField = createField('Effectiveness', effectivenessSelect, 'quiz-effectiveness-setting');

  function updateForMode() {
    const modeId = normalizeQuizModeId(modeSelect.value);
    const settings = getQuizModeSettings(modeId);
    settings.samplingStrategy ??= 'adaptive';
    strategySelect.value = settings.samplingStrategy;
    poolField.hidden = modeId !== 'pokemon-type-recognition';
    effectivenessField.hidden = modeId === 'pokemon-type-recognition';
    if (!effectivenessField.hidden) {
      settings.effectiveness ??= 'both';
      populateEffectivenessSelect(effectivenessSelect, modeId, settings.effectiveness);
    }
    const dualNote = root.querySelector('.quiz-dual-note');
    if (dualNote) dualNote.textContent = 'When enabled, about one in five questions uses dual types; single-type questions remain mixed in.';
  }

  poolSelect.addEventListener('change', () => {
    getQuizModeSettings('pokemon-type-recognition').pokemonPool = poolSelect.value;
    saveSettings(state.settings);
  });
  strategySelect.addEventListener('change', () => {
    getQuizModeSettings(normalizeQuizModeId(modeSelect.value)).samplingStrategy = strategySelect.value;
    saveSettings(state.settings);
  });
  effectivenessSelect.addEventListener('change', () => {
    getQuizModeSettings(normalizeQuizModeId(modeSelect.value)).effectiveness = effectivenessSelect.value;
    saveSettings(state.settings);
  });
  modeSelect.addEventListener('change', updateForMode);

  form.insertBefore(poolField, startButton);
  form.insertBefore(effectivenessField, startButton);
  form.insertBefore(strategyField, startButton);
  updateForMode();
}
