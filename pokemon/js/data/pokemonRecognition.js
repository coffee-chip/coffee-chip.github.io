import { TYPES } from './types.js';
import { getGameVersionGroup } from './gameVersions.js';

const RECOGNITION_KEY_SEPARATOR = ':';
const TYPE_SIGNATURE_SEPARATOR = '+';

function normalizeTypes(types) {
  if (!Array.isArray(types) || !types.length || types.length > 2) throw new Error('Pokémon recognition requires one or two types.');
  const normalized = [...new Set(types)];
  if (normalized.length !== types.length || !normalized.every(type => TYPES.includes(type))) {
    throw new Error('Pokémon recognition has invalid types.');
  }
  return normalized;
}

export function createPokemonTypeSignature(types) {
  return [...normalizeTypes(types)].sort().join(TYPE_SIGNATURE_SEPARATOR);
}

export function createPokemonRecognitionKey(pokemonId, types) {
  if (!Number.isInteger(pokemonId) || pokemonId < 1) throw new Error('Pokémon recognition key requires a valid Pokémon ID.');
  return `${pokemonId}${RECOGNITION_KEY_SEPARATOR}${createPokemonTypeSignature(types)}`;
}

export function parsePokemonRecognitionKey(key) {
  if (typeof key !== 'string') throw new Error('Pokémon recognition key must be a string.');
  const parts = key.split(RECOGNITION_KEY_SEPARATOR);
  if (parts.length !== 2) throw new Error(`Invalid Pokémon recognition key: ${key}`);
  const pokemonId = Number(parts[0]);
  const types = parts[1].split(TYPE_SIGNATURE_SEPARATOR);
  const canonicalKey = createPokemonRecognitionKey(pokemonId, types);
  if (canonicalKey !== key) throw new Error(`Invalid Pokémon recognition key: ${key}`);
  return { key: canonicalKey, pokemonId, types, typeSignature: parts[1] };
}

function normalizedTypeHistory(typeHistory) {
  return [...(typeHistory ?? [])]
    .filter(entry => Number.isInteger(entry?.throughGeneration) && entry.throughGeneration >= 1)
    .map(entry => ({ throughGeneration: entry.throughGeneration, types: normalizeTypes(entry.types) }))
    .sort((first, second) => first.throughGeneration - second.throughGeneration);
}

export function createPokemonRecognitionContext(pokemon, versionGroup) {
  const pokemonId = Number(pokemon?.id);
  const types = normalizeTypes(pokemon?.types);
  const generationNumber = getGameVersionGroup(versionGroup).generationNumber;
  const history = normalizedTypeHistory(pokemon?.typeHistory);
  const historicalIndex = history.findIndex(entry => entry.throughGeneration >= generationNumber);
  const previousEnd = historicalIndex > 0 ? history[historicalIndex - 1].throughGeneration : 0;
  const activeHistorical = historicalIndex >= 0 ? history[historicalIndex] : null;

  return {
    key: createPokemonRecognitionKey(pokemonId, types),
    pokemonId,
    types,
    typeSignature: createPokemonTypeSignature(types),
    generationStart: activeHistorical ? previousEnd + 1 : (history.at(-1)?.throughGeneration ?? 0) + 1,
    generationEnd: activeHistorical?.throughGeneration ?? null
  };
}

export function isPokemonRecognitionRecordForVersionGroup(record, versionGroup) {
  if (!record || !Number.isInteger(record.pokemonId) || record.pokemonId < 1
    || !Number.isInteger(record.generationStart) || record.generationStart < 1
    || (record.generationEnd !== null && (!Number.isInteger(record.generationEnd) || record.generationEnd < record.generationStart))) {
    return false;
  }
  const generationNumber = getGameVersionGroup(versionGroup).generationNumber;
  return generationNumber >= record.generationStart
    && (record.generationEnd === null || generationNumber <= record.generationEnd);
}

export function getPokemonRecognitionRecordForVersionGroup(records, pokemonId, versionGroup) {
  if (!Number.isInteger(pokemonId) || pokemonId < 1) return null;
  return Object.values(records ?? {}).find(record =>
    record?.pokemonId === pokemonId && isPokemonRecognitionRecordForVersionGroup(record, versionGroup)
  ) ?? null;
}
