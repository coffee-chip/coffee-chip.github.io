import { TYPES, TYPE_META } from '../data/types.js';
import { getDefendingTypesAtMultiplier } from '../engine/effectiveness.js';

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

export function createUnsafeSwitchQuestion() {
  const attackingType = randomItem(TYPES);
  const correctAnswers = getDefendingTypesAtMultiplier(attackingType, 2);

  return {
    id: `choose-switch-unsafe:${attackingType}`,
    generatorId: 'choose-switch-unsafe',
    objectiveId: 'choose-switch',
    formatId: 'type-multi-select',
    prompt: `Which Pokémon types are weak to ${TYPE_META[attackingType].label} attacks?`,
    answerType: 'type-multi-select',
    choices: [...TYPES],
    correctAnswers,
    explanation: `${TYPE_META[attackingType].label} attacks deal 2× damage to the highlighted types, making them risky switch-ins.`,
    metadata: {
      battleDecision: 'choose-switch',
      outcome: 'unsafe',
      attackingType,
      multiplier: 2
    }
  };
}

// Generators own subject matter and produce normalized questions.
// Interaction formats own display and scoring behavior.
export const QUESTION_GENERATORS = {
  'choose-switch-unsafe': {
    id: 'choose-switch-unsafe',
    objectiveId: 'choose-switch',
    formatId: 'type-multi-select',
    createQuestion: createUnsafeSwitchQuestion
  }
};

export function getQuestionGenerator(generatorId) {
  const generator = QUESTION_GENERATORS[generatorId];
  if (!generator) throw new Error(`Unknown question generator: ${generatorId}`);
  return generator;
}
