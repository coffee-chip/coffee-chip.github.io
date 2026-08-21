import { getPokemon } from '../data/pokemonRepository.js';
import { getActiveTypes, getPokemonTypeAdvantageScore } from '../engine/effectiveness.js';
import { getPokemonAdvantageScore } from '../engine/pokemonAdvantage.js';
import { POKEMON_POOLS } from './generators.js';

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffled(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function idsForPool(poolId) {
  const pool = POKEMON_POOLS[poolId] ?? POKEMON_POOLS['gen-1'];
  return Array.from({ length: pool.maxId - pool.minId + 1 }, (_, index) => pool.minId + index);
}

async function loadPokemon(id) {
  const { pokemon } = await getPokemon(id);
  return pokemon;
}

export async function createBattleTypeQuestion({ poolId = 'gen-1' } = {}) {
  const ids = idsForPool(poolId);
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const pokemon = await loadPokemon(randomItem(ids));
    const correctAnswers = getActiveTypes().filter(type => getPokemonTypeAdvantageScore([type], pokemon.types) > 0);
    if (!correctAnswers.length) continue;
    return {
      id: `battle-types:${pokemon.id}:${Date.now()}`,
      generatorId: 'battle-types',
      objectiveId: 'battle-scenario',
      formatId: 'type-multi-select',
      prompt: `Which Pokémon types would have an advantage against ${pokemon.displayName}?`,
      answerType: 'type-multi-select',
      choices: [...getActiveTypes()],
      correctAnswers,
      relationships: [],
      display: { kind: 'pokemon', pokemon },
      metadata: {
        battleDecision: 'choose-type-by-advantage',
        pokemonId: pokemon.id,
        pokemonName: pokemon.name,
        pool: poolId,
        promptKey: `battle-types:${pokemon.id}`
      }
    };
  }
  throw new Error('Could not generate a battle type scenario with at least one advantageous type.');
}

export async function createBattlePokemonQuestion({ poolId = 'gen-1' } = {}) {
  const ids = idsForPool(poolId);
  if (ids.length < 5) throw new Error('Battle Pokémon questions require a pool with at least five Pokémon.');

  const target = await loadPokemon(randomItem(ids));
  const candidatePool = ids.filter(id => id !== target.id);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidateIds = shuffled(candidatePool).slice(0, 4);
    const candidates = await Promise.all(candidateIds.map(loadPokemon));
    const scores = await Promise.all(candidateIds.map(id => getPokemonAdvantageScore(id, target.id)));
    const bestScore = Math.max(...scores);
    const bestIndexes = scores.map((score, index) => score === bestScore ? index : -1).filter(index => index >= 0);
    if (bestIndexes.length !== 1) continue;

    const correctPokemon = candidates[bestIndexes[0]];
    const choices = candidates.map(pokemon => String(pokemon.id));
    return {
      id: `battle-pokemon:${target.id}:${candidateIds.join('-')}:${Date.now()}`,
      generatorId: 'battle-pokemon',
      objectiveId: 'battle-scenario',
      formatId: 'single-select',
      prompt: `Which Pokémon has the greatest type advantage against ${target.displayName}?`,
      answerType: 'single-select',
      choices,
      correctAnswers: [String(correctPokemon.id)],
      relationships: [],
      display: { kind: 'pokemon', pokemon: target },
      choicePokemon: Object.fromEntries(candidates.map(pokemon => [String(pokemon.id), pokemon])),
      metadata: {
        battleDecision: 'choose-pokemon-by-advantage',
        pokemonId: target.id,
        pokemonName: target.name,
        candidatePokemonIds: candidateIds,
        candidateScores: Object.fromEntries(candidateIds.map((id, index) => [String(id), scores[index]])),
        pool: poolId,
        promptKey: `battle-pokemon:${target.id}`
      }
    };
  }

  throw new Error('Could not generate a four-Pokémon battle scenario with a unique best answer.');
}

export const BATTLE_SCENARIO_GENERATORS = {
  'battle-types': {
    id: 'battle-types',
    objectiveId: 'battle-scenario',
    formatId: 'type-multi-select',
    async: true,
    createQuestion: options => createBattleTypeQuestion(options)
  },
  'battle-pokemon': {
    id: 'battle-pokemon',
    objectiveId: 'battle-scenario',
    formatId: 'single-select',
    async: true,
    createQuestion: options => createBattlePokemonQuestion(options)
  }
};

export function getBattleScenarioGenerator(generatorId) {
  return BATTLE_SCENARIO_GENERATORS[generatorId] ?? null;
}
