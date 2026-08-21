import { TYPE_META } from '../data/types.js';
import { getActiveTypes, getMultiplier } from '../engine/effectiveness.js';
import { createRelationship } from '../relationships.js';
import { getPokemon } from '../data/pokemonRepository.js';
import { state } from '../state.js';
import { getGameVersionGroup, getNationalDexLimitForGeneration, getNationalDexLimitForVersionGroup } from '../data/gameVersions.js';

function randomItem(items) { return items[Math.floor(Math.random() * items.length)]; }
function addRelationship(relationships, attackingType, defendingType, answer, allowedOutcomes) {
  const relationship = createRelationship(attackingType, defendingType, { answer, allowedOutcomes });
  if (relationship.key) relationships.push(relationship);
}
function labelTypes(types) { return types.map(type => TYPE_META[type].label).join(' / '); }
function combinations(items, count, start = 0, prefix = [], result = []) {
  if (prefix.length === count) { result.push(prefix); return result; }
  for (let index = start; index <= items.length - (count - prefix.length); index += 1) {
    combinations(items, count, index + 1, [...prefix, items[index]], result);
  }
  return result;
}
function shuffled(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}
function weightedRandom(items, weightFor) {
  let candidates = shuffled(items).map(item => {
    const rawWeight = Number(weightFor(item));
    return { item, weight: Number.isFinite(rawWeight) ? Math.max(0, rawWeight) : 0 };
  });
  if (!candidates.some(candidate => candidate.weight > 0)) {
    candidates = candidates.map(candidate => ({ ...candidate, weight: 1 }));
  }
  const total = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
  if (!Number.isFinite(total) || total <= 0) return randomItem(items);
  let target = Math.random() * total;
  for (const candidate of candidates) {
    if (target < candidate.weight) return candidate.item;
    target -= candidate.weight;
  }
  return randomItem(candidates).item;
}
function recencyMultiplier(key, recentKeys) {
  const distance = recentKeys.length - 1 - recentKeys.lastIndexOf(key);
  if (distance < 0) return 1;
  if (distance === 0) return 0;
  if (distance <= 2) return 0.15;
  if (distance <= 4) return 0.5;
  return 1;
}

export const SAMPLING_STRATEGIES = {
  adaptive: { id: 'adaptive', label: 'Adaptive' },
  random: { id: 'random', label: 'Random' }
};
export const POKEMON_SAMPLING_STRATEGIES = SAMPLING_STRATEGIES;

const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];

export function getPokemonPoolsForVersionGroup(versionGroup = state.settings.gameVersionGroup) {
  const generationNumber = getGameVersionGroup(versionGroup).generationNumber;
  const pools = [];
  let minId = 1;
  for (let generation = 1; generation <= generationNumber; generation += 1) {
    const maxId = getNationalDexLimitForGeneration(generation);
    pools.push({
      id: `gen-${generation}`,
      label: `Generation ${ROMAN_NUMERALS[generation - 1]}`,
      minId,
      maxId
    });
    minId = maxId + 1;
  }
  if (generationNumber > 1) {
    pools.push({
      id: 'available',
      label: `Generations I–${ROMAN_NUMERALS[generationNumber - 1]}`,
      minId: 1,
      maxId: getNationalDexLimitForVersionGroup(versionGroup)
    });
  }
  return pools;
}

export function getPokemonIdsForPool(poolId, versionGroup = state.settings.gameVersionGroup) {
  const pools = getPokemonPoolsForVersionGroup(versionGroup);
  const pool = pools.find(candidate => candidate.id === poolId) ?? pools.at(-1);
  return Array.from({ length: pool.maxId - pool.minId + 1 }, (_, index) => pool.minId + index);
}

export function getPokemonSamplingWeight(pokemonId, recentPokemonIds = []) {
  const stats = state.progress.pokemonRecognitionStats?.[String(pokemonId)];
  const attempts = stats?.attempts ?? 0;
  const earnedScore = stats?.earnedScore ?? 0;
  const mastery = (earnedScore + 1) / (attempts + 2);
  const priority = 0.15 + 2 / (attempts + 1) + 3 * (1 - mastery) + 1.5 / Math.sqrt(attempts + 1);
  return priority * recencyMultiplier(pokemonId, recentPokemonIds);
}

function relationshipPriority(attackingType, defendingType) {
  if (getMultiplier(attackingType, [defendingType]) === 1) return null;
  const relationship = createRelationship(attackingType, defendingType);
  const stats = state.progress.relationshipStats?.[relationship.key];
  const attempts = stats?.attempts ?? 0;
  const earnedScore = stats?.earnedScore ?? 0;
  const mastery = (earnedScore + 1) / (attempts + 2);
  return 0.15 + 2 / (attempts + 1) + 3 * (1 - mastery) + 1.5 / Math.sqrt(attempts + 1);
}

function matchupCandidateWeight(types, direction, recentPromptKeys) {
  const priorities = [];
  if (direction === 'attacking') {
    for (const attackingType of types) for (const defendingType of getActiveTypes()) {
      const priority = relationshipPriority(attackingType, defendingType);
      if (priority !== null) priorities.push(priority);
    }
  } else {
    for (const defendingType of types) for (const attackingType of getActiveTypes()) {
      const priority = relationshipPriority(attackingType, defendingType);
      if (priority !== null) priorities.push(priority);
    }
  }
  const promptKey = `${direction}:${types.join('+')}`;
  if (!priorities.length) return 0.15 * recencyMultiplier(promptKey, recentPromptKeys);
  const mean = priorities.reduce((sum, value) => sum + value, 0) / priorities.length;
  const weakest = Math.max(...priorities);
  return (0.65 * mean + 0.35 * weakest) * recencyMultiplier(promptKey, recentPromptKeys);
}

function choosePromptTypes(count, direction, samplingStrategy, recentPromptKeys) {
  const candidates = combinations(getActiveTypes(), count);
  if (samplingStrategy === 'random') return randomItem(candidates);
  return weightedRandom(candidates, types => matchupCandidateWeight(types, direction, recentPromptKeys));
}

export const MOVE_CRITERIA = {
  'more-effective': {
    id: 'more-effective',
    label: 'more effective than neutral',
    matches: multiplier => multiplier > 1,
    prompt: defendingTypes => `Which move types are more effective than neutral against ${labelTypes(defendingTypes)}?`
  },
  'less-effective': {
    id: 'less-effective',
    label: 'less effective than neutral',
    matches: multiplier => multiplier < 1,
    prompt: defendingTypes => `Which move types are less effective than neutral against ${labelTypes(defendingTypes)}?`
  }
};

export const SWITCH_CRITERIA = {
  unsafe: {
    id: 'unsafe',
    label: 'weak',
    qualifies: multipliers => multipliers.some(multiplier => multiplier > 1),
    componentMatches: multiplier => multiplier > 1,
    prompt: attackingTypes => attackingTypes.length === 1
      ? `Which Pokémon types are weak to ${labelTypes(attackingTypes)} attacks?`
      : `Which single Pokémon types are weak to at least one of ${labelTypes(attackingTypes)} attacks?`
  },
  safe: {
    id: 'safe',
    label: 'resistant or immune',
    qualifies: multipliers => multipliers.every(multiplier => multiplier < 1),
    componentMatches: multiplier => multiplier < 1,
    prompt: attackingTypes => attackingTypes.length === 1
      ? `Which Pokémon types resist or are immune to ${labelTypes(attackingTypes)} attacks?`
      : `Which single Pokémon types resist or are immune to all of ${labelTypes(attackingTypes)} attacks?`
  }
};

export function createChooseSwitchQuestion({
  criterion = 'unsafe',
  attackerCount = 1,
  defenderCount,
  generatorId = criterion === 'safe' ? 'choose-switch-safe' : 'choose-switch-unsafe',
  samplingStrategy = 'adaptive',
  recentPromptKeys = []
} = {}) {
  const criterionDefinition = SWITCH_CRITERIA[criterion];
  if (!criterionDefinition) throw new Error(`Unknown choose-switch criterion: ${criterion}`);
  const count = defenderCount ?? attackerCount;
  if (![1, 2].includes(count)) throw new Error('Choose-switch questions support one or two attacking types.');
  const attackingTypes = choosePromptTypes(count, 'attacking', samplingStrategy, recentPromptKeys);
  const correctAnswers = getActiveTypes().filter(defendingType => {
    const multipliers = attackingTypes.map(attackingType => getMultiplier(attackingType, [defendingType]));
    return criterionDefinition.qualifies(multipliers);
  });
  const relationships = [];
  for (const defendingType of getActiveTypes()) {
    const components = attackingTypes.map(attackingType => {
      const multiplier = getMultiplier(attackingType, [defendingType]);
      return { attackingType, multiplier, matches: criterionDefinition.componentMatches(multiplier) };
    });
    const overallCorrect = criterionDefinition.qualifies(components.map(component => component.multiplier));
    for (const component of components) {
      if (overallCorrect && component.matches) {
        addRelationship(relationships, component.attackingType, defendingType, defendingType, ['correct', 'missed']);
      } else if (!overallCorrect && !component.matches) {
        addRelationship(relationships, component.attackingType, defendingType, defendingType, ['false-selection']);
      }
    }
  }
  const promptKey = `attacking:${attackingTypes.join('+')}`;
  return {
    id: `${generatorId}:${criterion}:${attackingTypes.join('-')}`,
    generatorId,
    objectiveId: 'choose-switch',
    formatId: 'type-multi-select',
    prompt: criterionDefinition.prompt(attackingTypes),
    answerType: 'type-multi-select',
    choices: [...getActiveTypes()],
    correctAnswers,
    relationships,
    metadata: {
      battleDecision: 'choose-switch',
      criterion,
      attackingTypes,
      attackerTypeCount: attackingTypes.length,
      promptKey,
      samplingStrategy
    }
  };
}

export function createUnsafeSwitchQuestion(options = {}) {
  return createChooseSwitchQuestion({ ...options, criterion: 'unsafe', generatorId: 'choose-switch-unsafe' });
}

export function createChooseMoveQuestion({
  criterion = 'more-effective',
  defenderCount = 1,
  generatorId = criterion === 'less-effective' ? 'choose-move-less-effective' : 'choose-move-more-effective',
  samplingStrategy = 'adaptive',
  recentPromptKeys = []
} = {}) {
  const criterionDefinition = MOVE_CRITERIA[criterion];
  if (!criterionDefinition) throw new Error(`Unknown choose-move criterion: ${criterion}`);
  if (![1, 2].includes(defenderCount)) throw new Error('Choose-move questions support one or two defending types.');
  const defendingTypes = choosePromptTypes(defenderCount, 'defending', samplingStrategy, recentPromptKeys);
  const correctAnswers = getActiveTypes().filter(attackingType => criterionDefinition.matches(getMultiplier(attackingType, defendingTypes)));
  const relationships = [];
  for (const attackingType of getActiveTypes()) {
    const combinedMatches = criterionDefinition.matches(getMultiplier(attackingType, defendingTypes));
    const components = defendingTypes.map(defendingType => ({
      defendingType,
      matches: criterionDefinition.matches(getMultiplier(attackingType, [defendingType]))
    }));
    for (const component of components) {
      if (combinedMatches && component.matches) {
        addRelationship(relationships, attackingType, component.defendingType, attackingType, ['correct', 'missed']);
      } else if (!combinedMatches && components.every(item => !item.matches)) {
        addRelationship(relationships, attackingType, component.defendingType, attackingType, ['false-selection']);
      }
    }
  }
  const promptKey = `defending:${defendingTypes.join('+')}`;
  return {
    id: `${generatorId}:${criterion}:${defendingTypes.join('-')}`,
    generatorId,
    objectiveId: 'choose-move',
    formatId: 'type-multi-select',
    prompt: criterionDefinition.prompt(defendingTypes),
    answerType: 'type-multi-select',
    choices: [...getActiveTypes()],
    correctAnswers,
    relationships,
    metadata: {
      battleDecision: 'choose-move',
      criterion,
      defendingTypes,
      defenderCount,
      threshold: criterion === 'more-effective' ? '>1' : '<1',
      promptKey,
      samplingStrategy
    }
  };
}

export async function createPokemonTypeRecognitionQuestion({ poolId = 'available', samplingStrategy = 'adaptive', recentPokemonIds = [] } = {}) {
  const ids = getPokemonIdsForPool(poolId);
  const id = samplingStrategy === 'random'
    ? randomItem(ids)
    : weightedRandom(ids, pokemonId => getPokemonSamplingWeight(pokemonId, recentPokemonIds));
  const { pokemon } = await getPokemon(id);
  return {
    id: `recognize-pokemon-type:${pokemon.id}:${Date.now()}`,
    generatorId: 'recognize-pokemon-type',
    objectiveId: 'recognize-pokemon-type',
    formatId: 'type-multi-select',
    prompt: `What type or types is ${pokemon.displayName}?`,
    answerType: 'type-multi-select',
    choices: [...getActiveTypes()],
    correctAnswers: [...pokemon.types],
    relationships: [],
    display: { kind: 'pokemon', pokemon },
    metadata: {
      pokemonId: pokemon.id,
      pokemonName: pokemon.name,
      pool: poolId,
      samplingStrategy,
      promptKey: `pokemon:${pokemon.id}`
    }
  };
}

const chooseSwitchUnsafeConfig = { criterion: 'unsafe', attackerCount: 1 };
const chooseSwitchSafeConfig = { criterion: 'safe', attackerCount: 1 };
const chooseMoveMoreEffectiveConfig = { criterion: 'more-effective', defenderCount: 1 };
const chooseMoveLessEffectiveConfig = { criterion: 'less-effective', defenderCount: 1 };

export const QUESTION_GENERATORS = {
  'choose-switch-unsafe': {
    id: 'choose-switch-unsafe', objectiveId: 'choose-switch', formatId: 'type-multi-select', config: chooseSwitchUnsafeConfig,
    createQuestion: options => createChooseSwitchQuestion({ ...chooseSwitchUnsafeConfig, ...options, generatorId: 'choose-switch-unsafe' })
  },
  'choose-switch-safe': {
    id: 'choose-switch-safe', objectiveId: 'choose-switch', formatId: 'type-multi-select', config: chooseSwitchSafeConfig,
    createQuestion: options => createChooseSwitchQuestion({ ...chooseSwitchSafeConfig, ...options, generatorId: 'choose-switch-safe' })
  },
  'choose-move-more-effective': {
    id: 'choose-move-more-effective', objectiveId: 'choose-move', formatId: 'type-multi-select', config: chooseMoveMoreEffectiveConfig,
    createQuestion: options => createChooseMoveQuestion({ ...chooseMoveMoreEffectiveConfig, ...options, generatorId: 'choose-move-more-effective' })
  },
  'choose-move-less-effective': {
    id: 'choose-move-less-effective', objectiveId: 'choose-move', formatId: 'type-multi-select', config: chooseMoveLessEffectiveConfig,
    createQuestion: options => createChooseMoveQuestion({ ...chooseMoveLessEffectiveConfig, ...options, generatorId: 'choose-move-less-effective' })
  },
  'recognize-pokemon-type': {
    id: 'recognize-pokemon-type', objectiveId: 'recognize-pokemon-type', formatId: 'type-multi-select', async: true,
    createQuestion: options => createPokemonTypeRecognitionQuestion(options)
  }
};

export function getQuestionGenerator(generatorId) {
  const generator = QUESTION_GENERATORS[generatorId];
  if (!generator) throw new Error(`Unknown question generator: ${generatorId}`);
  return generator;
}
