import { TYPES, TYPE_META } from '../data/types.js';
import { getMultiplier } from '../engine/effectiveness.js';
import { createRelationship } from '../relationships.js';
import { getPokemon } from '../data/pokemonRepository.js';
import { state } from '../state.js';

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

export const POKEMON_POOLS = {
  'gen-1': { id: 'gen-1', label: 'Generation 1', minId: 1, maxId: 151 },
  'gen-2': { id: 'gen-2', label: 'Generation 2', minId: 152, maxId: 251 },
  'gen-3': { id: 'gen-3', label: 'Generation 3', minId: 252, maxId: 386 },
  'gen-1-3': { id: 'gen-1-3', label: 'Generations 1–3', minId: 1, maxId: 386 }
};

export const POKEMON_SAMPLING_STRATEGIES = {
  adaptive: { id: 'adaptive', label: 'Adaptive' },
  random: { id: 'random', label: 'Random' }
};

function idsForPool(poolId) {
  const pool = POKEMON_POOLS[poolId] ?? POKEMON_POOLS['gen-1'];
  return Array.from({ length: pool.maxId - pool.minId + 1 }, (_, index) => pool.minId + index);
}

function recencyMultiplier(pokemonId, recentPokemonIds) {
  const distance = recentPokemonIds.length - 1 - recentPokemonIds.lastIndexOf(pokemonId);
  if (distance < 0) return 1;
  if (distance === 0) return 0;
  if (distance <= 2) return 0.15;
  if (distance <= 4) return 0.5;
  return 1;
}

export function getPokemonSamplingWeight(pokemonId, recentPokemonIds = []) {
  const stats = state.progress.pokemonRecognitionStats?.[String(pokemonId)];
  const attempts = stats?.attempts ?? 0;
  const earnedScore = stats?.earnedScore ?? 0;
  const alpha = 1;
  const beta = 1;
  const mastery = (earnedScore + alpha) / (attempts + alpha + beta);
  const base = 0.15;
  const unseenBonus = 2 / (attempts + 1);
  const errorPriority = 3 * (1 - mastery);
  const uncertaintyPriority = 1.5 / Math.sqrt(attempts + 1);
  return (base + unseenBonus + errorPriority + uncertaintyPriority)
    * recencyMultiplier(pokemonId, recentPokemonIds);
}

function weightedRandomId(ids, recentPokemonIds) {
  let candidates = ids.map(id => ({ id, weight: getPokemonSamplingWeight(id, recentPokemonIds) }));
  if (!candidates.some(candidate => candidate.weight > 0)) {
    candidates = ids.map(id => ({ id, weight: getPokemonSamplingWeight(id, []) }));
  }
  const total = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
  let target = Math.random() * total;
  for (const candidate of candidates) {
    target -= candidate.weight;
    if (target <= 0) return candidate.id;
  }
  return candidates[candidates.length - 1].id;
}

export const MOVE_CRITERIA = {
  'more-effective': {
    id: 'more-effective', label: 'more effective than neutral', matches: multiplier => multiplier > 1,
    prompt: defendingTypes => `Which move types are more effective than neutral against ${labelTypes(defendingTypes)}?`,
    explanation: defendingTypes => `The highlighted move types deal more than 1× damage to ${labelTypes(defendingTypes)}.`
  },
  'not-very-effective': {
    id: 'not-very-effective', label: 'less effective than neutral', matches: multiplier => multiplier < 1,
    prompt: defendingTypes => `Which move types are less effective than neutral against ${labelTypes(defendingTypes)}?`,
    explanation: defendingTypes => `The highlighted move types deal less than 1× damage to ${labelTypes(defendingTypes)}.`
  }
};

export function createUnsafeSwitchQuestion({ defenderCount = 1 } = {}) {
  const attackingTypes = randomDistinctTypes(defenderCount);
  const isDual = attackingTypes.length === 2;
  const correctAnswers = TYPES.filter(defendingType => attackingTypes.some(attackingType => getMultiplier(attackingType, [defendingType]) > 1));
  const relationships = [];
  for (const defendingType of TYPES) {
    const componentMatches = attackingTypes.map(attackingType => ({ attackingType, matches: getMultiplier(attackingType, [defendingType]) > 1 }));
    const overallCorrect = componentMatches.some(item => item.matches);
    for (const item of componentMatches) {
      if (item.matches) relationships.push(questionRelationship(item.attackingType, defendingType, defendingType, ['correct', 'missed']));
      else if (!overallCorrect) relationships.push(questionRelationship(item.attackingType, defendingType, defendingType, ['false-selection']));
    }
  }
  return {
    id: `choose-switch-unsafe:${attackingTypes.join('-')}`, generatorId: 'choose-switch-unsafe', objectiveId: 'choose-switch',
    formatId: 'type-multi-select',
    prompt: isDual ? `Which single Pokémon types are weak to at least one of ${labelTypes(attackingTypes)} attacks?` : `Which Pokémon types are weak to ${labelTypes(attackingTypes)} attacks?`,
    answerType: 'type-multi-select', choices: [...TYPES], correctAnswers, relationships,
    explanation: isDual ? `The highlighted types take more than 1× damage from at least one of ${labelTypes(attackingTypes)}.` : `${labelTypes(attackingTypes)} attacks deal 2× damage to the highlighted types, making them risky switch-ins.`,
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
    const components = defendingTypes.map(defendingType => ({ defendingType, matches: criterionDefinition.matches(getMultiplier(attackingType, [defendingType])) }));
    for (const component of components) {
      if (combinedMatches && component.matches) relationships.push(questionRelationship(attackingType, component.defendingType, attackingType, ['correct', 'missed']));
      else if (!combinedMatches && components.every(item => !item.matches)) relationships.push(questionRelationship(attackingType, component.defendingType, attackingType, ['false-selection']));
    }
  }
  return {
    id: `${generatorId}:${criterion}:${defendingTypes.join('-')}`, generatorId, objectiveId: 'choose-move', formatId: 'type-multi-select',
    prompt: criterionDefinition.prompt(defendingTypes), answerType: 'type-multi-select', choices: [...TYPES], correctAnswers, relationships,
    explanation: criterionDefinition.explanation(defendingTypes),
    metadata: { battleDecision: 'choose-move', criterion, defendingTypes, defenderCount, threshold: criterion === 'more-effective' ? '>1' : '<1' }
  };
}

export async function createPokemonTypeRecognitionQuestion({ poolId = 'gen-1', samplingStrategy = 'adaptive', recentPokemonIds = [] } = {}) {
  const ids = idsForPool(poolId);
  const id = samplingStrategy === 'random'
    ? randomItem(ids)
    : weightedRandomId(ids, recentPokemonIds);
  const { pokemon } = await getPokemon(id);
  return {
    id: `recognize-pokemon-type:${pokemon.id}:${Date.now()}`,
    generatorId: 'recognize-pokemon-type',
    objectiveId: 'recognize-pokemon-type',
    formatId: 'type-multi-select',
    prompt: `What type or types is ${pokemon.displayName}?`,
    answerType: 'type-multi-select',
    choices: [...TYPES],
    correctAnswers: [...pokemon.types],
    relationships: [],
    display: { kind: 'pokemon', pokemon },
    metadata: { pokemonId: pokemon.id, pokemonName: pokemon.name, pool: poolId, samplingStrategy }
  };
}

const chooseMoveMoreEffectiveConfig = { criterion: 'more-effective', defenderCount: 1 };

export const QUESTION_GENERATORS = {
  'choose-switch-unsafe': { id: 'choose-switch-unsafe', objectiveId: 'choose-switch', formatId: 'type-multi-select', createQuestion: options => createUnsafeSwitchQuestion(options) },
  'choose-move-more-effective': { id: 'choose-move-more-effective', objectiveId: 'choose-move', formatId: 'type-multi-select', config: chooseMoveMoreEffectiveConfig, createQuestion: options => createChooseMoveQuestion({ ...chooseMoveMoreEffectiveConfig, ...options, generatorId: 'choose-move-more-effective' }) },
  'recognize-pokemon-type': { id: 'recognize-pokemon-type', objectiveId: 'recognize-pokemon-type', formatId: 'type-multi-select', async: true, createQuestion: options => createPokemonTypeRecognitionQuestion(options) }
};

export function getQuestionGenerator(generatorId) {
  const generator = QUESTION_GENERATORS[generatorId];
  if (!generator) throw new Error(`Unknown question generator: ${generatorId}`);
  return generator;
}
