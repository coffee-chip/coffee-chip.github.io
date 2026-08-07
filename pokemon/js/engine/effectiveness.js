import { OFFENSIVE_CHART, TYPES } from '../data/types.js';

export const MULTIPLIER_ORDER = [4, 2, 1, 0.5, 0.25, 0];

export function getMultiplier(attackingType, defendingTypes) {
  if (!OFFENSIVE_CHART[attackingType]) throw new Error(`Unknown attacking type: ${attackingType}`);
  return defendingTypes.reduce((total, defendingType) => {
    if (!TYPES.includes(defendingType)) throw new Error(`Unknown defending type: ${defendingType}`);
    return total * (OFFENSIVE_CHART[attackingType][defendingType] ?? 1);
  }, 1);
}

function validatePokemonTypes(pokemonTypes, label = 'Pokémon types') {
  if (!Array.isArray(pokemonTypes) || pokemonTypes.length < 1 || pokemonTypes.length > 2) {
    throw new Error(`${label} must contain one or two types.`);
  }
  for (const type of pokemonTypes) {
    if (!TYPES.includes(type)) throw new Error(`Unknown type: ${type}`);
  }
}

export function getEffectivenessTierScore(multiplier) {
  if (multiplier === 0) return -3;
  const score = Math.log2(multiplier);
  if (!Number.isInteger(score)) throw new Error(`Unsupported effectiveness multiplier: ${multiplier}`);
  return score;
}

export function getTypeAdvantageScore(pokemonTypes, otherType) {
  validatePokemonTypes(pokemonTypes);
  const pokemonEffectiveness = Math.max(
    ...pokemonTypes.map(attackingType => getMultiplier(attackingType, [otherType]))
  );
  const otherEffectiveness = getMultiplier(otherType, pokemonTypes);
  return getEffectivenessTierScore(pokemonEffectiveness) - getEffectivenessTierScore(otherEffectiveness);
}

export function getPokemonTypeAdvantageScore(pokemonTypes, otherPokemonTypes) {
  validatePokemonTypes(pokemonTypes, 'First Pokémon types');
  validatePokemonTypes(otherPokemonTypes, 'Second Pokémon types');

  const pokemonEffectiveness = Math.max(
    ...pokemonTypes.map(attackingType => getMultiplier(attackingType, otherPokemonTypes))
  );
  const otherPokemonEffectiveness = Math.max(
    ...otherPokemonTypes.map(attackingType => getMultiplier(attackingType, pokemonTypes))
  );

  return getEffectivenessTierScore(pokemonEffectiveness) - getEffectivenessTierScore(otherPokemonEffectiveness);
}

export function getDefendingTypesAtMultiplier(attackingType, multiplier) {
  return TYPES.filter(defendingType => getMultiplier(attackingType, [defendingType]) === multiplier);
}

export function getOffensiveMatchups(attackingType) {
  return Object.fromEntries(
    [2, 1, 0.5, 0].map(multiplier => [
      multiplier,
      TYPES.filter(defendingType => getMultiplier(attackingType, [defendingType]) === multiplier)
    ])
  );
}

export function getDefensiveMatchups(defendingTypes) {
  validatePokemonTypes(defendingTypes, 'Defending types');

  return Object.fromEntries(
    MULTIPLIER_ORDER.map(multiplier => [
      multiplier,
      TYPES.filter(attackingType => getMultiplier(attackingType, defendingTypes) === multiplier)
    ])
  );
}

export function runEngineSelfTests() {
  const multiplierCases = [
    ['normal', ['ghost'], 0],
    ['fire', ['bug', 'steel'], 4],
    ['ice', ['fire', 'steel'], 0.25],
    ['electric', ['water', 'flying'], 4]
  ];
  const results = multiplierCases.map(([attack, defend, expected]) => {
    const actual = getMultiplier(attack, defend);
    return {
      name: `${attack} → ${defend.join('/')}: expected ${expected}×`,
      attack,
      defend,
      expected,
      actual,
      passed: actual === expected
    };
  });

  const pokemonAdvantageCases = [
    [['fire'], ['grass'], 2],
    [['electric'], ['water', 'flying'], 4],
    [['normal'], ['ghost'], 0]
  ];
  for (const [firstTypes, secondTypes, expected] of pokemonAdvantageCases) {
    const actual = getPokemonTypeAdvantageScore(firstTypes, secondTypes);
    results.push({
      name: `${firstTypes.join('/')} vs ${secondTypes.join('/')}: expected advantage ${expected}`,
      firstTypes,
      secondTypes,
      expected,
      actual,
      passed: actual === expected
    });
  }
  return results;
}
