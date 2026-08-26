import { TYPES } from './types.js';
import { DEFAULT_GAME_VERSION_GROUP, getGameVersionGroup, getGameVersionGroupOrder, getNationalDexLimitForVersionGroup, isGameVersionGroup, isPokemonAvailableInVersionGroup } from './gameVersions.js';
import { state } from '../state.js';
import { saveCache } from '../storage.js';
import { fetchEvolutionChain, fetchPokemon, fetchPokemonNameIndex, fetchPokemonSpecies, normalizePokemonIdentifier, PokeApiError } from '../api/pokeApi.js';

const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const NAME_INDEX_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const RECENT_POKEMON_LIMIT = 10;

function titleCase(value) { return value.split('-').map(part => part ? part[0].toUpperCase() + part.slice(1) : '').join(' '); }
function normalizeTypes(entries) {
  return [...(entries ?? [])]
    .sort((first, second) => first.slot - second.slot)
    .map(entry => entry.type?.name)
    .filter(type => TYPES.includes(type));
}
function generationNumber(name) {
  const match = typeof name === 'string' && name.match(/^generation-(i|ii|iii|iv|v|vi|vii|viii|ix)$/);
  return match ? ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix'].indexOf(match[1]) + 1 : null;
}
function normalizeTypeHistory(raw) {
  return (raw.past_types ?? [])
    .map(entry => ({ throughGeneration: generationNumber(entry.generation?.name), types: normalizeTypes(entry.types) }))
    .filter(entry => Number.isInteger(entry.throughGeneration) && entry.types.length)
    .sort((first, second) => first.throughGeneration - second.throughGeneration);
}
function resolveTypesForGeneration(pokemon, versionGroup) {
  const targetGeneration = getGameVersionGroup(versionGroup).generationNumber;
  const historical = pokemon.typeHistory.find(entry => entry.throughGeneration >= targetGeneration);
  return [...(historical?.types ?? pokemon.currentTypes)];
}
function materializePokemonForGame(pokemon, versionGroup) {
  return {
    ...pokemon,
    types: resolveTypesForGeneration(pokemon, versionGroup),
    evolution: materializeEvolutionForVersionGroup(pokemon.evolution, versionGroup)
  };
}
function normalizeLevelUpMoves(raw, versionGroup) {
  const movesByName = new Map();
  for (const entry of raw.moves ?? []) {
    const name = entry?.move?.name;
    const detail = (entry?.version_group_details ?? []).find(candidate =>
      candidate?.version_group?.name === versionGroup && candidate?.move_learn_method?.name === 'level-up'
    );
    if (typeof name !== 'string' || !detail || !Number.isInteger(detail.level_learned_at) || detail.level_learned_at < 0) continue;
    const move = { name, displayName: titleCase(name), level: detail.level_learned_at };
    const existing = movesByName.get(name);
    if (!existing || move.level < existing.level) movesByName.set(name, move);
  }
  return [...movesByName.values()].sort((a, b) => a.level - b.level || a.displayName.localeCompare(b.displayName));
}
function normalizeApiPokemon(raw, versionGroup) {
  const currentTypes = normalizeTypes(raw.types);
  const typeHistory = normalizeTypeHistory(raw);
  const types = typeHistory.find(entry => entry.throughGeneration >= getGameVersionGroup(versionGroup).generationNumber)?.types ?? currentTypes;
  if (!Number.isInteger(raw.id) || raw.id < 1 || !raw.name || !currentTypes.length || !types.length) {
    throw new PokeApiError('PokéAPI returned an incomplete Pokémon record.', { code: 'invalid-response' });
  }
  return {
    id: raw.id,
    name: raw.name,
    displayName: titleCase(raw.name),
    types,
    currentTypes,
    typeHistory,
    spriteUrl: raw.sprites?.other?.['official-artwork']?.front_default ?? raw.sprites?.front_default ?? null,
    speciesName: raw.species?.name ?? raw.name,
    evolution: null,
    levelUpMoves: { [versionGroup]: normalizeLevelUpMoves(raw, versionGroup) },
    fetchedAt: new Date().toISOString()
  };
}
function isValidEvolutionCondition(value) {
  return value && typeof value.trigger === 'string' && isGameVersionGroup(value.versionGroup);
}
function isValidEvolutionTarget(value) {
  return value && Number.isInteger(value.id) && value.id > 0
    && typeof value.name === 'string' && value.name.length > 0
    && Array.isArray(value.conditions) && value.conditions.every(isValidEvolutionCondition);
}
function isValidEvolution(value) {
  return value && Array.isArray(value.previous) && Array.isArray(value.next)
    && value.previous.every(isValidEvolutionTarget)
    && value.next.every(isValidEvolutionTarget);
}
function isValidTypeList(value) {
  return Array.isArray(value) && value.length >= 1 && value.every(type => TYPES.includes(type));
}
function isValidTypeHistory(value) {
  return Array.isArray(value) && value.every(entry =>
    Number.isInteger(entry?.throughGeneration) && entry.throughGeneration >= 1 && isValidTypeList(entry.types)
  );
}
function isValidCachedPokemon(value) {
  return value && Number.isInteger(value.id) && typeof value.name === 'string' && typeof value.displayName === 'string'
    && isValidTypeList(value.types) && isValidTypeList(value.currentTypes) && isValidTypeHistory(value.typeHistory)
    && typeof value.fetchedAt === 'string';
}
function isValidNameIndex(value, versionGroup = state.settings.gameVersionGroup) {
  return value && value.versionGroup === versionGroup
    && Array.isArray(value.names) && value.names.length > 0 && value.names[0] === 'bulbasaur'
    && value.names.every(name => typeof name === 'string' && name.length > 0)
    && typeof value.fetchedAt === 'string';
}
function isFresh(record, maxAgeMs) { const fetchedAt = Date.parse(record.fetchedAt); return Number.isFinite(fetchedAt) && Date.now()-fetchedAt < maxAgeMs; }
function getCached(identifier) {
  const normalized = normalizePokemonIdentifier(identifier);
  const direct = state.cache.pokemon?.[normalized];
  if (isValidCachedPokemon(direct)) return direct;
  return Object.values(state.cache.pokemon ?? {}).find(record => isValidCachedPokemon(record) && (record.name === normalized || String(record.id) === normalized)) ?? null;
}
function cachePokemon(pokemon) { state.cache.pokemon[pokemon.name] = pokemon; state.cache.pokemon[String(pokemon.id)] = pokemon; saveCache(state.cache); }
function cachePokemonNameIndex(names, versionGroup) {
  state.cache.pokemonNameIndex = {
    names: [...new Set(names)],
    versionGroup,
    fetchedAt: new Date().toISOString()
  };
  saveCache(state.cache);
  return state.cache.pokemonNameIndex;
}
function normalizeEvolutionCondition(detail = {}) {
  return {
    trigger: detail.trigger?.name ?? 'unknown',
    versionGroup: detail.version_group?.name ?? null,
    minLevel: Number.isInteger(detail.min_level) ? detail.min_level : null,
    item: detail.item?.name ?? null,
    heldItem: detail.held_item?.name ?? null,
    knownMove: detail.known_move?.name ?? null,
    knownMoveType: detail.known_move_type?.name ?? null,
    location: detail.location?.name ?? null,
    minHappiness: Number.isInteger(detail.min_happiness) ? detail.min_happiness : null,
    minBeauty: Number.isInteger(detail.min_beauty) ? detail.min_beauty : null,
    minAffection: Number.isInteger(detail.min_affection) ? detail.min_affection : null,
    timeOfDay: detail.time_of_day || null,
    gender: Number.isInteger(detail.gender) ? detail.gender : null,
    needsOverworldRain: detail.needs_overworld_rain === true,
    partySpecies: detail.party_species?.name ?? null,
    partyType: detail.party_type?.name ?? null,
    relativePhysicalStats: Number.isInteger(detail.relative_physical_stats) ? detail.relative_physical_stats : null,
    tradeSpecies: detail.trade_species?.name ?? null,
    turnUpsideDown: detail.turn_upside_down === true
  };
}
function pokemonSpeciesId(url) {
  const match = typeof url === 'string' && url.match(/\/pokemon-species\/(\d+)\/?$/);
  const id = Number(match?.[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}
function evolutionTarget(link) {
  const name = link?.species?.name;
  const id = pokemonSpeciesId(link?.species?.url);
  if (!id || typeof name !== 'string' || !name) return null;
  const details = Array.isArray(link.evolution_details) && link.evolution_details.length ? link.evolution_details : [{}];
  return { id, name, conditions: details.map(normalizeEvolutionCondition) };
}
function findEvolutionContext(link, targetName, parent = null) {
  if (!link?.species?.name) return null;
  if (link.species.name === targetName) {
    const incomingDetails = Array.isArray(link.evolution_details) && link.evolution_details.length ? link.evolution_details : [{}];
    return {
      previous: parent ? [{ ...parent, conditions: incomingDetails.map(normalizeEvolutionCondition) }] : [],
      next: (link.evolves_to ?? []).map(evolutionTarget).filter(Boolean)
    };
  }
  for (const child of link.evolves_to ?? []) {
    const match = findEvolutionContext(child, targetName, evolutionTarget(link));
    if (match) return match;
  }
  return null;
}
function conditionsForVersionGroup(conditions, versionGroup) {
  const selectedOrder = getGameVersionGroupOrder(versionGroup);
  const eligible = conditions.filter(condition => getGameVersionGroupOrder(condition.versionGroup) <= selectedOrder);
  if (!eligible.length) return [];
  const newestApplicableOrder = Math.max(...eligible.map(condition => getGameVersionGroupOrder(condition.versionGroup)));
  return eligible.filter(condition => getGameVersionGroupOrder(condition.versionGroup) === newestApplicableOrder);
}
function materializeEvolutionForVersionGroup(evolution, versionGroup) {
  if (!isValidEvolution(evolution)) return evolution;
  const materializeTarget = target => {
    if (!isPokemonAvailableInVersionGroup(target.id, versionGroup)) return null;
    const conditions = conditionsForVersionGroup(target.conditions, versionGroup);
    return conditions.length ? { ...target, conditions } : null;
  };
  return {
    previous: evolution.previous.map(materializeTarget).filter(Boolean),
    next: evolution.next.map(materializeTarget).filter(Boolean)
  };
}
async function enrichWithEvolution(pokemon) {
  if (isValidEvolution(pokemon.evolution)) return pokemon;
  try {
    const species = await fetchPokemonSpecies(pokemon.speciesName);
    const chainUrl = species?.evolution_chain?.url;
    if (!chainUrl) return { ...pokemon, evolution: { previous: [], next: [] } };
    const chain = await fetchEvolutionChain(chainUrl);
    return { ...pokemon, evolution: findEvolutionContext(chain?.chain, pokemon.speciesName) ?? { previous: [], next: [] } };
  } catch (error) { console.warn('Could not load Pokémon evolution data.', error); return pokemon; }
}
function hasLevelUpMoves(pokemon, versionGroup) {
  const moves = pokemon?.levelUpMoves?.[versionGroup];
  return Array.isArray(moves) && moves.every(move => typeof move?.name === 'string' && typeof move?.displayName === 'string' && Number.isInteger(move?.level) && move.level >= 0);
}
function mergePokemon(existing, refreshed) {
  return {
    ...existing,
    ...refreshed,
    levelUpMoves: { ...(existing?.levelUpMoves ?? {}), ...(refreshed.levelUpMoves ?? {}) }
  };
}
function unavailablePokemonError(versionGroup) {
  return new PokeApiError(`That Pokémon is not available in ${getGameVersionGroup(versionGroup).label}.`, { code: 'unavailable-in-game' });
}
export function isPokemonAvailableForVersionGroup(pokemon, versionGroup = state.settings.gameVersionGroup) {
  return isPokemonAvailableInVersionGroup(pokemon?.id, versionGroup);
}
export async function getPokemon(identifier, { forceRefresh = false, versionGroup = state.settings.gameVersionGroup } = {}) {
  const normalized = normalizePokemonIdentifier(identifier);
  const selectedVersionGroup = isGameVersionGroup(versionGroup) ? versionGroup : DEFAULT_GAME_VERSION_GROUP;
  if (/^\d+$/.test(normalized) && !isPokemonAvailableInVersionGroup(Number(normalized), selectedVersionGroup)) {
    throw unavailablePokemonError(selectedVersionGroup);
  }
  const cached = getCached(normalized);
  if (cached && !isPokemonAvailableForVersionGroup(cached, selectedVersionGroup)) {
    throw unavailablePokemonError(selectedVersionGroup);
  }
  if (cached && !forceRefresh && isFresh(cached, CACHE_MAX_AGE_MS) && hasLevelUpMoves(cached, selectedVersionGroup)) {
    if (isValidEvolution(cached.evolution)) {
      return { pokemon: materializePokemonForGame(cached, selectedVersionGroup), source: 'cache', stale: false };
    }
    const enriched = await enrichWithEvolution(cached);
    if (enriched !== cached) cachePokemon(enriched);
    return { pokemon: materializePokemonForGame(enriched, selectedVersionGroup), source: 'cache', stale: false };
  }
  try {
    const raw = await fetchPokemon(normalized);
    const refreshed = normalizeApiPokemon(raw, selectedVersionGroup);
    if (!isPokemonAvailableForVersionGroup(refreshed, selectedVersionGroup)) {
      throw unavailablePokemonError(selectedVersionGroup);
    }
    const pokemon = await enrichWithEvolution(mergePokemon(cached, refreshed));
    cachePokemon(pokemon);
    return { pokemon: materializePokemonForGame(pokemon, selectedVersionGroup), source: 'network', stale: false };
  } catch (error) {
    if (cached) return { pokemon: materializePokemonForGame(cached, selectedVersionGroup), source: 'stale-cache', stale: true, error };
    throw error;
  }
}
export function getLevelUpMoves(pokemon, versionGroup = state.settings.gameVersionGroup) {
  const selectedVersionGroup = isGameVersionGroup(versionGroup) ? versionGroup : DEFAULT_GAME_VERSION_GROUP;
  return hasLevelUpMoves(pokemon, selectedVersionGroup) ? [...pokemon.levelUpMoves[selectedVersionGroup]] : null;
}
export function rememberPokemonLookup(pokemon) {
  if (!isValidCachedPokemon(pokemon)) return false;
  const current = Array.isArray(state.cache.recentPokemonIds) ? state.cache.recentPokemonIds : [];
  state.cache.recentPokemonIds = [pokemon.id, ...current.filter(id => id !== pokemon.id)].slice(0, RECENT_POKEMON_LIMIT);
  return saveCache(state.cache);
}
export function getRecentPokemonLookups(versionGroup = state.settings.gameVersionGroup) {
  const ids = Array.isArray(state.cache.recentPokemonIds) ? state.cache.recentPokemonIds : [];
  const recent = ids.map(id => getCached(String(id)))
    .filter(pokemon => isValidCachedPokemon(pokemon) && isPokemonAvailableForVersionGroup(pokemon, versionGroup));
  const availableIds = recent.map(pokemon => pokemon.id);
  if (availableIds.length !== ids.length) {
    state.cache.recentPokemonIds = availableIds;
    saveCache(state.cache);
  }
  return recent;
}
export function getCachedPokemonNameIndex(versionGroup = state.settings.gameVersionGroup) {
  return isValidNameIndex(state.cache.pokemonNameIndex, versionGroup) ? state.cache.pokemonNameIndex : null;
}
export async function getPokemonNameIndex({ forceRefresh = false, versionGroup = state.settings.gameVersionGroup } = {}) {
  const selectedVersionGroup = isGameVersionGroup(versionGroup) ? versionGroup : DEFAULT_GAME_VERSION_GROUP;
  const cached = getCachedPokemonNameIndex(selectedVersionGroup);
  if (cached && !forceRefresh && isFresh(cached, NAME_INDEX_MAX_AGE_MS)) return { names: cached.names, source: 'cache', stale: false };
  try {
    const names = await fetchPokemonNameIndex();
    const index = cachePokemonNameIndex(names.slice(0, getNationalDexLimitForVersionGroup(selectedVersionGroup)), selectedVersionGroup);
    return { names: index.names, source: 'network', stale: false };
  }
  catch (error) { if (cached) return { names: cached.names, source: 'stale-cache', stale: true, error }; throw error; }
}
export function getPokemonCacheEntryCount() { return new Set(Object.values(state.cache.pokemon ?? {}).filter(isValidCachedPokemon).map(record => record.id)).size; }
export function clearGameDataCache() {
  state.cache.pokemon = {};
  state.cache.moves = {};
  state.cache.pokemonNameIndex = null;
  state.cache.recentPokemonIds = [];
  return saveCache(state.cache);
}
