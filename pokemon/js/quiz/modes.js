import { getQuestionGenerator } from './generators.js';

// A practice preset chooses learning objectives, interaction formats, and generators.
// The persisted key remains "quiz mode" for compatibility, but the concept is a preset.
export const PRACTICE_PRESETS = {
  'select-all': {
    id: 'select-all',
    label: 'Switch-in safety · Select all',
    objectiveIds: ['choose-switch'],
    formatIds: ['type-multi-select'],
    generatorIds: ['choose-switch-unsafe']
  },
  'choose-move-select-all': {
    id: 'choose-move-select-all',
    label: 'Choose a move · Select all',
    objectiveIds: ['choose-move'],
    formatIds: ['type-multi-select'],
    generatorIds: ['choose-move-more-effective']
  }
};

// Compatibility alias while surrounding state/storage naming is migrated incrementally.
export const QUIZ_MODES = PRACTICE_PRESETS;

export function getQuizMode(modeId) {
  const preset = PRACTICE_PRESETS[modeId];
  if (!preset) throw new Error(`Unknown practice preset: ${modeId}`);
  return preset;
}

export function createQuestionForMode(modeId) {
  const preset = getQuizMode(modeId);
  const generatorId = preset.generatorIds[Math.floor(Math.random() * preset.generatorIds.length)];
  const generator = getQuestionGenerator(generatorId);
  const question = generator.createQuestion();

  if (!preset.objectiveIds.includes(question.objectiveId)) {
    throw new Error(`Generator ${generatorId} produced objective ${question.objectiveId}, which is not allowed by preset ${modeId}.`);
  }
  if (!preset.formatIds.includes(question.formatId)) {
    throw new Error(`Generator ${generatorId} produced format ${question.formatId}, which is not allowed by preset ${modeId}.`);
  }

  return question;
}
