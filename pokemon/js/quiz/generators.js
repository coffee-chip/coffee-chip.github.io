import { TYPES, TYPE_META } from '../data/types.js';
import { getMultiplier } from '../engine/effectiveness.js';
import { createRelationship } from '../relationships.js';

function randomItem(items) { return items[Math.floor(Math.random() * items.length)]; }
function randomDistinctTypes(count) {
  const copy = [...TYPES];
  const result = [];
  while (result.length < count) result.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  return result;
}
function questionRelationship(attackingType, defendingType, answer, allowedOutcomes) {
  return createRelationship(attackingType, defendingType, { answer, allowedOutcomes });
}
function labelTypes(types) { return types.map(type => TYPE_META[type].label).join(' / '); }

export const MOVE_CRITERIA = {
  'more-effective': {
    id: 'more-effective',
    label: 'more effective than neutral',
    matches: multiplier => multiplier > 1,
    prompt: defendingTypes => `Which move types are more effective than neutral against ${labelTypes(defendingTypes)}?`,
    explanation: defendingTypes => `The highlighted move types deal more than 1× damage to ${labelTypes(defendingTypes)}.`
  },
  'not-very-effective': {
    id: 'not-very-effective',
    label: 'less effective than neutral',
    matches: multiplier => multiplier < 1,
    prompt: defendingTypes => `Which move types are less effective than neutral against ${labelTypes(defendingTypes)}?`,
    explanation: defendingTypes => `The highlighted move types deal less than 1× damage to ${labelTypes(defendingTypes)}.`
  }
};

export function createUnsafeSwitchQuestion({ defenderCount = 1 } = {}) {
  const attackingTypes = randomDistinctTypes(defenderCount);
  const isDual = attackingTypes.length === 2;
  const correctAnswers = TYPES.filter(defendingType =>
    attackingTypes.some(attackingType => getMultiplier(attackingType, [defendingType]) > 1)
  );
  const relationships = [];
  for (const defendingType of TYPES) {
    const componentMatches = attackingTypes.map(attackingType => ({
      attackingType,
      matches: getMultiplier(attackingType, [defendingType]) > 1
    }));
    const overallCorrect = componentMatches.some(item => item.matches);
    for (const item of componentMatches) {
      if (item.matches) {
        relationships.push(questionRelationship(item.attackingType, defendingType, defendingType, ['correct', 'missed']));
      } else if (!overallCorrect) {
        relationships.push(questionRelationship(item.attackingType, defendingType, defendingType, ['false-selection']));
      }
    }
  }
  return {
    id: `choose-switch-unsafe:${attackingTypes.join('-')}`,
    generatorId: 'choose-switch-unsafe',
    objectiveId: 'choose-switch',
    formatId: 'type-multi-select',
    prompt: isDual
      ? `Which single Pokémon types are weak to at least one of ${labelTypes(attackingTypes)} attacks?`
      : `Which Pokémon types are weak to ${labelTypes(attackingTypes)} attacks?`,
    answerType: 'type-multi-select',
    choices: [...TYPES],
    correctAnswers,
    relationships,
    explanation: isDual
      ? `The highlighted types take more than 1× damage from at least one of ${labelTypes(attackingTypes)}.`
      : `${labelTypes(attackingTypes)} attacks deal 2× damage to the highlighted types, making them risky switch-ins.`,
    metadata: { battleDecision: 'choose-switch', criterion: 'more-effective', outcome: 'unsafe', attackingTypes, attackerTypeCount: attackingTypes.length }
  };
}

export function createChooseMoveQuestion({ criterion = 'more-effective', defenderCount = 1, generatorId = 'choose-move-more-effective' } = {}) {
  const criterionDefinition = MOVE_CRITERIA[criterion];
  if (!criterionDefinition) throw new Error(`Unknown choose-move criterion: ${criterion}`);
  if (![1, 2].includes(defenderCount)) throw new Error('Choose-move questions support one or two defending types.');
  const defendingTypes = randomDistinctTypes(defenderCount);
  const correctAnswers = TYPES.filter(attackingType => criterionDefinition.matches(getMultiplier(attackingType, defendingTypes)));
  const relationships = [];
  for (const attackingType of TYPES) {
    const combinedMatches = criterionDefinition.matches(getMultiplier(attackingType, defendingTypes));
    const components = defendingTypes.map(defendingType => ({
      defendingType,
      matches: criterionDefinition.matches(getMultiplier(attackingType, [defendingType]))
    }));
    for (const component of components) {
      if (combinedMatches && component.matches) {
        relationships.push(questionRelationship(attackingType, component.defendingType, attackingType, ['correct', 'missed']));
      } else if (!combinedMatches && components.every(item => !item.matches)) {
        relationships.push(questionRelationship(attackingType, component.defendingType, attackingType, ['false-selection']));
      }
    }
  }
  return {
    id: `${generatorId}:${criterion}:${defendingTypes.join('-')}`,
    generatorId,
    objectiveId: 'choose-move',
    formatId: 'type-multi-select',
    prompt: criterionDefinition.prompt(defendingTypes),
    answerType: 'type-multi-select',
    choices: [...TYPES],
    correctAnswers,
    relationships,
    explanation: criterionDefinition.explanation(defendingTypes),
    metadata: { battleDecision: 'choose-move', criterion, defendingTypes, defenderCount, threshold: criterion === 'more-effective' ? '>1' : '<1' }
  };
}

const chooseMoveMoreEffectiveConfig = { criterion: 'more-effective', defenderCount: 1 };

export const QUESTION_GENERATORS = {
  'choose-switch-unsafe': {
    id: 'choose-switch-unsafe', objectiveId: 'choose-switch', formatId: 'type-multi-select',
    createQuestion: options => createUnsafeSwitchQuestion(options)
  },
  'choose-move-more-effective': {
    id: 'choose-move-more-effective', objectiveId: 'choose-move', formatId: 'type-multi-select', config: chooseMoveMoreEffectiveConfig,
    createQuestion: options => createChooseMoveQuestion({ ...chooseMoveMoreEffectiveConfig, ...options, generatorId: 'choose-move-more-effective' })
  }
};

export function getQuestionGenerator(generatorId) {
  const generator = QUESTION_GENERATORS[generatorId];
  if (!generator) throw new Error(`Unknown question generator: ${generatorId}`);
  return generator;
}
