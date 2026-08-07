import { getQuestionGenerator } from './generators.js';
import { getBattleScenarioGenerator } from './battleScenarioQuestions.js';
import { state } from '../state.js';

export const PRACTICE_PRESETS = {
  'pokemon-type-recognition': {
    id: 'pokemon-type-recognition',
    label: 'Pokémon type recognition',
    objectiveIds: ['recognize-pokemon-type'],
    formatIds: ['type-multi-select'],
    generatorIds: ['recognize-pokemon-type']
  },
  'battle-scenario': {
    id: 'battle-scenario',
    label: 'Battle scenario',
    objectiveIds: ['battle-scenario'],
    formatIds: ['type-multi-select', 'single-select'],
    generatorIds: ['battle-types', 'battle-pokemon']
  },
  'two-way-combat': {
    id: 'two-way-combat',
    label: 'Two-way combat',
    objectiveIds: ['choose-switch', 'choose-move'],
    formatIds: ['type-multi-select'],
    generatorIds: [
      'choose-switch-unsafe',
      'choose-switch-safe',
      'choose-move-more-effective',
      'choose-move-less-effective'
    ]
  },
  'choose-switch': {
    id: 'choose-switch',
    label: 'Choose a switch-in',
    objectiveIds: ['choose-switch'],
    formatIds: ['type-multi-select'],
    generatorIds: ['choose-switch-unsafe', 'choose-switch-safe']
  },
  'choose-move': {
    id: 'choose-move',
    label: 'Choose a move',
    objectiveIds: ['choose-move'],
    formatIds: ['type-multi-select'],
    generatorIds: ['choose-move-more-effective', 'choose-move-less-effective']
  }
};

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
  if (modeId === 'battle-scenario') {
    return { poolId: settings.pokemonPool ?? 'gen-1' };
  }
  return {
    samplingStrategy: settings.samplingStrategy ?? 'adaptive',
    recentPromptKeys: recentMetadataValues('promptKey').filter(value => typeof value === 'string')
  };
}

function generatorIdsForMode(modeId, preset) {
  const settings = state.settings.quiz.modes[modeId] ?? {};
  const effectiveness = settings.effectiveness ?? 'both';

  if (modeId === 'battle-scenario') {
    const answers = settings.answers ?? 'both';
    if (answers === 'types') return ['battle-types'];
    if (answers === 'pokemon') return ['battle-pokemon'];
  }
  if (modeId === 'choose-switch') {
    if (effectiveness === 'weak') return ['choose-switch-unsafe'];
    if (effectiveness === 'resistant') return ['choose-switch-safe'];
  }
  if (modeId === 'choose-move') {
    if (effectiveness === 'more') return ['choose-move-more-effective'];
    if (effectiveness === 'less') return ['choose-move-less-effective'];
  }
  return preset.generatorIds;
}

function getGenerator(generatorId) {
  return getBattleScenarioGenerator(generatorId) ?? getQuestionGenerator(generatorId);
}

export async function createQuestionForMode(modeId, options = {}) {
  const { mixDualTypes = false, dualTypeChance = 0.2 } = options;
  const preset = getQuizMode(modeId);
  const generatorIds = generatorIdsForMode(modeId, preset);
  const generatorId = generatorIds[Math.floor(Math.random() * generatorIds.length)];
  const generator = getGenerator(generatorId);
  const useDualTypes = mixDualTypes && Math.random() < dualTypeChance;
  const question = await generator.createQuestion({
    ...options,
    ...presetOptions(modeId),
    defenderCount: useDualTypes ? 2 : 1,
    attackerCount: useDualTypes ? 2 : 1
  });

  if (!preset.objectiveIds.includes(question.objectiveId)) {
    throw new Error(`Generator ${generatorId} produced objective ${question.objectiveId}, which is not allowed by preset ${modeId}.`);
  }
  if (!preset.formatIds.includes(question.formatId)) {
    throw new Error(`Generator ${generatorId} produced format ${question.formatId}, which is not allowed by preset ${modeId}.`);
  }
  return question;
}
