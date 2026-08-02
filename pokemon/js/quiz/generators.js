import { TYPES, TYPE_META } from '../data/types.js';
import { getDefendingTypesAtMultiplier, getMultiplier } from '../engine/effectiveness.js';

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

const MOVE_CRITERIA = {
  'more-effective': {
    id: 'more-effective',
    label: 'more effective than neutral',
    matches: multiplier => multiplier > 1,
    prompt: defendingTypes => {
      const defenderLabel = defendingTypes.map(type => TYPE_META[type].label).join(' / ');
      return `Which move types are more effective than neutral against ${defenderLabel}?`;
    },
    explanation: defendingTypes => {
      const defenderLabel = defendingTypes.map(type => TYPE_META[type].label).join(' / ');
      return `The highlighted move types deal more than 1× damage to ${defenderLabel}.`;
    }
  },
  'not-very-effective': {
    id: 'not-very-effective',
    label: 'less effective than neutral',
    matches: multiplier => multiplier < 1,
    prompt: defendingTypes => {
      const defenderLabel = defendingTypes.map(type => TYPE_META[type].label).join(' / ');
      return `Which move types are less effective than neutral against ${defenderLabel}?`;
    },
    explanation: defendingTypes => {
      const defenderLabel = defendingTypes.map(type => TYPE_META[type].label).join(' / ');
      return `The highlighted move types deal less than 1× damage to ${defenderLabel}.`;
    }
  }
};

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

export function createChooseMoveQuestion({
  criterion = 'more-effective',
  defenderCount = 1,
  generatorId = 'choose-move-more-effective'
} = {}) {
  const criterionDefinition = MOVE_CRITERIA[criterion];
  if (!criterionDefinition) throw new Error(`Unknown choose-move criterion: ${criterion}`);
  if (defenderCount !== 1) {
    throw new Error('Only single-type choose-move questions are implemented currently.');
  }

  const defendingTypes = [randomItem(TYPES)];
  const correctAnswers = TYPES.filter(attackingType =>
    criterionDefinition.matches(getMultiplier(attackingType, defendingTypes))
  );

  return {
    id: `${generatorId}:${criterion}:${defendingTypes.join('-')}`,
    generatorId,
    objectiveId: 'choose-move',
    formatId: 'type-multi-select',
    prompt: criterionDefinition.prompt(defendingTypes),
    answerType: 'type-multi-select',
    choices: [...TYPES],
    correctAnswers,
    explanation: criterionDefinition.explanation(defendingTypes),
    metadata: {
      battleDecision: 'choose-move',
      criterion,
      defendingTypes,
      defenderCount,
      threshold: criterion === 'more-effective' ? '>1' : '<1'
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
  },
  'choose-move-more-effective': {
    id: 'choose-move-more-effective',
    objectiveId: 'choose-move',
    formatId: 'type-multi-select',
    config: {
      criterion: 'more-effective',
      defenderCount: 1
    },
    createQuestion() {
      return createChooseMoveQuestion({
        ...this.config,
        generatorId: this.id
      });
    }
  }
};

export function getQuestionGenerator(generatorId) {
  const generator = QUESTION_GENERATORS[generatorId];
  if (!generator) throw new Error(`Unknown question generator: ${generatorId}`);
  return generator;
}
