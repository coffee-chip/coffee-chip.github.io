import { getQuestionGenerator } from './generators.js';
import { state } from '../state.js';

export const PRACTICE_PRESETS = {
  'select-all': {
    id: 'select-all', label: 'Switch-in safety · Select all', objectiveIds: ['choose-switch'], formatIds: ['type-multi-select'], generatorIds: ['choose-switch-unsafe']
  },
  'choose-move-select-all': {
    id: 'choose-move-select-all', label: 'Choose a move · Select all', objectiveIds: ['choose-move'], formatIds: ['type-multi-select'], generatorIds: ['choose-move-more-effective']
  },
  'pokemon-type-recognition': {
    id: 'pokemon-type-recognition', label: 'Recognize Pokémon types', objectiveIds: ['recognize-pokemon-type'], formatIds: ['type-multi-select'], generatorIds: ['recognize-pokemon-type']
  }
};

export const QUIZ_MODES = PRACTICE_PRESETS;

export function getQuizMode(modeId) {
  const preset = PRACTICE_PRESETS[modeId];
  if (!preset) throw new Error(`Unknown practice preset: ${modeId}`);
  return preset;
}

function recentMetadataValues(field) {
  const completed = state.quiz.session.results
    .map(result => result.metadata?.[field])
    .filter(value => value !== undefined && value !== null);
  const current = state.quiz.question?.metadata?.[field];
  return [...completed, ...(current !== undefined && current !== null ? [current] : [])].slice(-5);
}

function presetOptions(modeId) {
  const settings = state.settings.quiz.modes[modeId] ?? {};
  if (modeId === 'pokemon-type-recognition') {
    return {
      poolId: settings.pokemonPool ?? 'gen-1',
      samplingStrategy: settings.samplingStrategy ?? 'adaptive',
      recentPokemonIds: recentMetadataValues('pokemonId').map(Number).filter(Number.isInteger)
    };
  }
  return {
    samplingStrategy: settings.samplingStrategy ?? 'adaptive',
    recentPromptKeys: recentMetadataValues('promptKey').filter(value => typeof value === 'string')
  };
}

export async function createQuestionForMode(modeId, options = {}) {
  const { mixDualTypes = false, dualTypeChance = 0.35 } = options;
  const preset = getQuizMode(modeId);
  const generatorId = preset.generatorIds[Math.floor(Math.random() * preset.generatorIds.length)];
  const generator = getQuestionGenerator(generatorId);
  const useDualTypes = mixDualTypes && Math.random() < dualTypeChance;
  const question = await generator.createQuestion({
    ...options,
    ...presetOptions(modeId),
    defenderCount: useDualTypes ? 2 : 1
  });

  if (!preset.objectiveIds.includes(question.objectiveId)) {
    throw new Error(`Generator ${generatorId} produced objective ${question.objectiveId}, which is not allowed by preset ${modeId}.`);
  }
  if (!preset.formatIds.includes(question.formatId)) {
    throw new Error(`Generator ${generatorId} produced format ${question.formatId}, which is not allowed by preset ${modeId}.`);
  }
  return question;
}
