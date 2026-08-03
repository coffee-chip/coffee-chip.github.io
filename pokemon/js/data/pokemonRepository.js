import { TYPES } from './types.js';
import { state } from '../state.js';
import { saveCache } from '../storage.js';
import {
  fetchPokemon,
  fetchPokemonNameIndex,
  normalizePokemonIdentifier,
  PokeApiError
} from '../api/pokeApi.js';

const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const NAME_INDEX_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function titleCase(value) {
  return value.split('-').map(part => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ');
}

function normalizeApiPokemon(raw) {
  const types = [...(raw.types ?? [])]
    .sort((a, b) => a.slot - b.slot)
    .map(entry => entry.type?.name)
    .filter(type => TYPES.includes(type));

  if (!Number.isInteger(raw.id) || raw.id < 1 || !raw.name || !types.length) {
    throw new PokeApiError('PokéAPI returned an incomplete Pokémon record.', { code: 'invalid-response' });
  }

  return {
    id: raw.id,
    name: raw.name,
    displayName: titleCase(raw.name),
    types,
    spriteUrl: raw.sprites?.other?.['official-artwork']?.front_default
      ?? raw.sprites?.front_default
      ?? null,
    speciesName: raw.species?.name ?? raw.name,
    fetchedAt: new Date().toISOString()
  };
}

function isValidCachedPokemon(value) {
  return value
    && Number.isInteger(value.id)
    && typeof value.name === 'string'
    && typeof value.displayName === 'string'
    && Array.isArray(value.types)
    && value.types.length >= 1
    && value.types.every(type => TYPES.includes(type))
    && typeof value.fetchedAt === 'string';
}

function isValidNameIndex(value) {
  return value
    && Array.isArray(value.names)
    && value.names.length > 0
    && value.names.every(name => typeof name === 'string' && name.length > 0)
    && typeof value.fetchedAt === 'string';
}

function isFresh(record, maxAgeMs) {
  const fetchedAt = Date.parse(record.fetchedAt);
  return Number.isFinite(fetchedAt) && Date.now() - fetchedAt < maxAgeMs;
}

function getCached(identifier) {
  const normalized = normalizePokemonIdentifier(identifier);
  const direct = state.cache.pokemon?.[normalized];
  if (isValidCachedPokemon(direct)) return direct;
  return Object.values(state.cache.pokemon ?? {}).find(record =>
    isValidCachedPokemon(record)
    && (record.name === normalized || String(record.id) === normalized)
  ) ?? null;
}

function cachePokemon(pokemon) {
  state.cache.pokemon[pokemon.name] = pokemon;
  state.cache.pokemon[String(pokemon.id)] = pokemon;
  saveCache(state.cache);
}

function cachePokemonNameIndex(names) {
  state.cache.pokemonNameIndex = {
    names: [...new Set(names)].sort((a, b) => a.localeCompare(b)),
    fetchedAt: new Date().toISOString()
  };
  saveCache(state.cache);
  return state.cache.pokemonNameIndex;
}

export async function getPokemon(identifier, { forceRefresh = false } = {}) {
  const normalized = normalizePokemonIdentifier(identifier);
  const cached = getCached(normalized);

  if (cached && !forceRefresh && isFresh(cached, CACHE_MAX_AGE_MS)) {
    return { pokemon: cached, source: 'cache', stale: false };
  }

  try {
    const raw = await fetchPokemon(normalized);
    const pokemon = normalizeApiPokemon(raw);
    cachePokemon(pokemon);
    return { pokemon, source: 'network', stale: false };
  } catch (error) {
    if (cached) return { pokemon: cached, source: 'stale-cache', stale: true, error };
    throw error;
  }
}

export function getCachedPokemonNameIndex() {
  return isValidNameIndex(state.cache.pokemonNameIndex)
    ? state.cache.pokemonNameIndex
    : null;
}

export async function getPokemonNameIndex({ forceRefresh = false } = {}) {
  const cached = getCachedPokemonNameIndex();
  if (cached && !forceRefresh && isFresh(cached, NAME_INDEX_MAX_AGE_MS)) {
    return { names: cached.names, source: 'cache', stale: false };
  }

  try {
    const names = await fetchPokemonNameIndex();
    const index = cachePokemonNameIndex(names);
    return { names: index.names, source: 'network', stale: false };
  } catch (error) {
    if (cached) return { names: cached.names, source: 'stale-cache', stale: true, error };
    throw error;
  }
}

export function getPokemonCacheEntryCount() {
  return new Set(Object.values(state.cache.pokemon ?? {}).filter(isValidCachedPokemon).map(record => record.id)).size;
}
