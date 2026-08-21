import { getOffensiveChartForVersionGroup, getTypesForVersionGroup } from '../data/types.js';
import { state } from '../state.js';

export const MULTIPLIER_ORDER = [4, 2, 1, 0.5, 0.25, 0];

export function getActiveTypes() {
  return getTypesForVersionGroup(state.settings.gameVersionGroup);
}

export function getMultiplierForVersionGroup(attackingType, defendingTypes, versionGroup) {
  const chart = getOffensiveChartForVersionGroup(versionGroup);
  const types = getTypesForVersionGroup(versionGroup);
  if (!chart[attackingType]) throw new Error(`Unknown attacking type for the selected game: ${attackingType}`);
  return defendingTypes.reduce((total, defendingType) => {
    if (!types.includes(defendingType)) throw new Error(`Unknown defending type for the selected game: ${defendingType}`);
    return total * (chart[attackingType][defendingType] ?? 1);
  }, 1);
}

export function getMultiplier(attackingType, defendingTypes) {
  return getMultiplierForVersionGroup(attackingType, defendingTypes, state.settings.gameVersionGroup);
}

function validatePokemonTypes(pokemonTypes, label = 'Pokémon types') {
  if (!Array.isArray(pokemonTypes) || pokemonTypes.length < 1 || pokemonTypes.length > 2) {
    throw new Error(`${label} must contain one or two types.`);
  }
  for (const type of pokemonTypes) {
    if (!getActiveTypes().includes(type)) throw new Error(`Unknown type for the selected game: ${type}`);
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
  return getActiveTypes().filter(defendingType => getMultiplier(attackingType, [defendingType]) === multiplier);
}

export function getOffensiveMatchups(attackingType) {
  return Object.fromEntries(
    [2, 1, 0.5, 0].map(multiplier => [
      multiplier,
      getActiveTypes().filter(defendingType => getMultiplier(attackingType, [defendingType]) === multiplier)
    ])
  );
}

export function getDefensiveMatchups(defendingTypes) {
  validatePokemonTypes(defendingTypes, 'Defending types');

  return Object.fromEntries(
    MULTIPLIER_ORDER.map(multiplier => [
      multiplier,
      getActiveTypes().filter(attackingType => getMultiplier(attackingType, defendingTypes) === multiplier)
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
  const results = multiplierCases.filter(([attack, defend]) => [attack, ...defend].every(type => getActiveTypes().includes(type))).map(([attack, defend, expected]) => {
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
    [['electric'], ['water', 'flying'], 2],
    [['normal'], ['ghost'], 0]
  ];
  for (const [firstTypes, secondTypes, expected] of pokemonAdvantageCases) {
    if (![...firstTypes, ...secondTypes].every(type => getActiveTypes().includes(type))) continue;
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
