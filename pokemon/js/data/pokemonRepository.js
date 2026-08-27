import { TYPES } from './types.js';
import { DEFAULT_GAME_VERSION_GROUP, getGameVersionGroup, getGameVersionGroupOrder, getNationalDexLimitForVersionGroup, isGameVersionGroup, isPokemonAvailableInVersionGroup } from './gameVersions.js';
import { state } from '../state.js';
import { clearCachedData, readCachedPokemonById, readCachedPokemonByName, readCachedPokemonNameIndex, saveCachedPokemon, saveCachedPokemonNameIndex, saveRecentPokemonIds } from '../storage.js';
import { fetchEvolutionChain, fetchPokemon, fetchPokemonEncounters, fetchPokemonNameIndex, fetchPokemonSpecies, normalizePokemonIdentifier, PokeApiError } from '../api/pokeApi.js';

const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const NAME_INDEX_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const RECENT_POKEMON_LIMIT = 10;
const POKEMON_CACHE_SCHEMA_VERSION = 2;
const ENCOUNTER_CACHE_SCHEMA_VERSION = 1;
const NAME_INDEX_CACHE_SCHEMA_VERSION = 2;
const pokemonById = new Map();
const pokemonIdsByName = new Map();
let pokemonNameIndex = null;
const pendingPokemonRequests = new Map();
const pendingEncounterRequests = new Map();
const pendingNameIndexRequests = new Map();
const pokemonCommitQueues = new Map();
let repositoryEpoch = 0;

function staleRequestError() {
  return new DOMException('This Pokémon data request is no longer current.', 'AbortError');
}
function assertCurrentEpoch(epoch) {
  if (epoch !== repositoryEpoch) throw staleRequestError();
}
function deletePendingRequest(map, key, request) {
  if (map.get(key) === request) map.delete(key);
}

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
function normalizeLevelUpMoveHistory(raw) {
  const history = [];
  for (const entry of raw.moves ?? []) {
    const name = entry?.move?.name;
    if (typeof name !== 'string' || !name) continue;
    const levels = {};
    for (const detail of entry?.version_group_details ?? []) {
      const versionGroup = detail?.version_group?.name;
      const level = detail?.level_learned_at;
      if (!isGameVersionGroup(versionGroup)
        || detail?.move_learn_method?.name !== 'level-up'
        || !Number.isInteger(level)
        || level < 0) continue;
      if (!Number.isInteger(levels[versionGroup]) || level < levels[versionGroup]) levels[versionGroup] = level;
    }
    if (Object.keys(levels).length) history.push({ name, displayName: titleCase(name), levels });
  }
  return history.sort((a, b) => a.displayName.localeCompare(b.displayName));
}
function normalizeApiPokemon(raw, versionGroup) {
  const currentTypes = normalizeTypes(raw.types);
  const typeHistory = normalizeTypeHistory(raw);
  const types = typeHistory.find(entry => entry.throughGeneration >= getGameVersionGroup(versionGroup).generationNumber)?.types ?? currentTypes;
  if (!Number.isInteger(raw.id) || raw.id < 1 || !raw.name || !currentTypes.length || !types.length) {
    throw new PokeApiError('PokéAPI returned an incomplete Pokémon record.', { code: 'invalid-response' });
  }
  return {
    cacheSchemaVersion: POKEMON_CACHE_SCHEMA_VERSION,
    id: raw.id,
    name: raw.name,
    displayName: titleCase(raw.name),
    currentTypes,
    typeHistory,
    spriteUrl: raw.sprites?.other?.['official-artwork']?.front_default ?? raw.sprites?.front_default ?? null,
    speciesName: raw.species?.name ?? raw.name,
    evolution: null,
    encounterLocations: {},
    levelUpMoveHistory: normalizeLevelUpMoveHistory(raw),
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
  return value && value.cacheSchemaVersion === POKEMON_CACHE_SCHEMA_VERSION
    && Number.isInteger(value.id) && typeof value.name === 'string' && typeof value.displayName === 'string'
    && isValidTypeList(value.currentTypes) && isValidTypeHistory(value.typeHistory)
    && isValidLevelUpMoveHistory(value.levelUpMoveHistory)
    && typeof value.fetchedAt === 'string';
}
function isValidLevelUpMoveHistory(value) {
  return Array.isArray(value) && value.every(move =>
    typeof move?.name === 'string'
    && typeof move.displayName === 'string'
    && move.levels && typeof move.levels === 'object'
    && Object.entries(move.levels).every(([versionGroup, level]) =>
      isGameVersionGroup(versionGroup) && Number.isInteger(level) && level >= 0
    )
  );
}
function isValidEncounterDetail(value) {
  return value && Array.isArray(value.versions) && value.versions.length > 0
    && typeof value.method === 'string' && Number.isInteger(value.minLevel) && Number.isInteger(value.maxLevel)
    && (value.chance === null || Number.isInteger(value.chance)) && Array.isArray(value.conditions);
}
function isValidEncounterLocation(value) {
  return value && typeof value.name === 'string' && typeof value.displayName === 'string'
    && Array.isArray(value.details) && value.details.every(isValidEncounterDetail);
}
function isValidEncounterCache(value) {
  return value && value.cacheSchemaVersion === ENCOUNTER_CACHE_SCHEMA_VERSION
    && Array.isArray(value.locations) && value.locations.every(isValidEncounterLocation)
    && typeof value.fetchedAt === 'string';
}
function isValidNameIndex(value) {
  return value && value.cacheSchemaVersion === NAME_INDEX_CACHE_SCHEMA_VERSION
    && Array.isArray(value.names) && value.names.length >= getNationalDexLimitForVersionGroup('scarlet-violet')
    && value.names[0] === 'bulbasaur'
    && value.names.every(name => typeof name === 'string' && name.length > 0)
    && typeof value.fetchedAt === 'string';
}
function isFresh(record, maxAgeMs) { const fetchedAt = Date.parse(record.fetchedAt); return Number.isFinite(fetchedAt) && Date.now()-fetchedAt < maxAgeMs; }
function rememberCachedPokemon(pokemon) {
  if (!isValidCachedPokemon(pokemon)) return null;
  pokemonById.set(pokemon.id, pokemon);
  pokemonIdsByName.set(pokemon.name, pokemon.id);
  return pokemon;
}
async function getCached(identifier) {
  const normalized = normalizePokemonIdentifier(identifier);
  const numericId = /^\d+$/.test(normalized) ? Number(normalized) : null;
  const knownId = numericId ?? pokemonIdsByName.get(normalized);
  const inMemory = knownId ? pokemonById.get(knownId) : null;
  if (inMemory) return inMemory;
  const stored = numericId
    ? await readCachedPokemonById(numericId)
    : await readCachedPokemonByName(normalized);
  return rememberCachedPokemon(stored);
}
function cachePokemon(pokemon, epoch = repositoryEpoch) {
  if (epoch !== repositoryEpoch) return false;
  if (!rememberCachedPokemon(pokemon)) return;
  void saveCachedPokemon(pokemon);
  return true;
}
function commitPokemonUpdate(id, epoch, update) {
  const previous = pokemonCommitQueues.get(id) ?? Promise.resolve();
  const request = previous.catch(() => null).then(async () => {
    assertCurrentEpoch(epoch);
    const latest = await getCached(id);
    assertCurrentEpoch(epoch);
    const pokemon = update(latest);
    if (!cachePokemon(pokemon, epoch)) throw staleRequestError();
    return pokemon;
  }).finally(() => {
    if (pokemonCommitQueues.get(id) === request) pokemonCommitQueues.delete(id);
  });
  pokemonCommitQueues.set(id, request);
  return request;
}
function normalizePokemonEncounters(raw, versionGroup) {
  const selectedVersions = new Set(getGameVersionGroup(versionGroup).versions);
  const locations = [];
  for (const entry of raw ?? []) {
    const name = entry?.location_area?.name;
    if (typeof name !== 'string' || !name) continue;
    const detailMap = new Map();
    for (const versionDetail of entry.version_details ?? []) {
      const version = versionDetail?.version?.name;
      if (!selectedVersions.has(version)) continue;
      for (const detail of versionDetail.encounter_details ?? []) {
        const method = detail?.method?.name;
        const minLevel = Number(detail?.min_level);
        const maxLevel = Number(detail?.max_level);
        if (typeof method !== 'string' || !Number.isInteger(minLevel) || !Number.isInteger(maxLevel)) continue;
        const conditions = (detail.condition_values ?? [])
          .map(condition => condition?.name)
          .filter(condition => typeof condition === 'string' && condition);
        const chance = Number.isInteger(detail.chance) ? detail.chance : null;
        const key = JSON.stringify([method, minLevel, maxLevel, chance, conditions]);
        const normalized = detailMap.get(key) ?? { versions: [], method, minLevel, maxLevel, chance, conditions };
        if (!normalized.versions.includes(version)) normalized.versions.push(version);
        detailMap.set(key, normalized);
      }
    }
    const details = [...detailMap.values()].sort((first, second) =>
      first.method.localeCompare(second.method) || first.minLevel - second.minLevel || first.maxLevel - second.maxLevel
    );
    if (details.length) locations.push({ name, displayName: titleCase(name), details });
  }
  return locations.sort((first, second) => first.displayName.localeCompare(second.displayName));
}
function cachePokemonNameIndex(names, epoch = repositoryEpoch) {
  assertCurrentEpoch(epoch);
  const index = {
    cacheSchemaVersion: NAME_INDEX_CACHE_SCHEMA_VERSION,
    names: [...new Set(names)],
    fetchedAt: new Date().toISOString()
  };
  pokemonNameIndex = index;
  void saveCachedPokemonNameIndex(index);
  return index;
}
function materializeNameIndex(index, versionGroup) {
  return {
    ...index,
    versionGroup,
    names: index.names.slice(0, getNationalDexLimitForVersionGroup(versionGroup))
  };
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
function mergePokemon(existing, refreshed) {
  return {
    ...existing,
    ...refreshed,
    encounterLocations: { ...(existing?.encounterLocations ?? {}), ...(refreshed.encounterLocations ?? {}) },
    levelUpMoveHistory: refreshed.levelUpMoveHistory ?? existing?.levelUpMoveHistory ?? []
  };
}
function unavailablePokemonError(versionGroup) {
  return new PokeApiError(`That Pokémon is not available in ${getGameVersionGroup(versionGroup).label}.`, { code: 'unavailable-in-game' });
}
export function isPokemonAvailableForVersionGroup(pokemon, versionGroup = state.settings.gameVersionGroup) {
  return isPokemonAvailableInVersionGroup(pokemon?.id, versionGroup);
}
async function loadPokemon(identifier, { forceRefresh, versionGroup, epoch }) {
  const normalized = normalizePokemonIdentifier(identifier);
  const selectedVersionGroup = versionGroup;
  if (/^\d+$/.test(normalized) && !isPokemonAvailableInVersionGroup(Number(normalized), selectedVersionGroup)) {
    throw unavailablePokemonError(selectedVersionGroup);
  }
  const cached = await getCached(normalized);
  assertCurrentEpoch(epoch);
  if (cached && !isPokemonAvailableForVersionGroup(cached, selectedVersionGroup)) {
    throw unavailablePokemonError(selectedVersionGroup);
  }
  if (cached && !forceRefresh && isFresh(cached, CACHE_MAX_AGE_MS)) {
    if (isValidEvolution(cached.evolution)) {
      return { pokemon: materializePokemonForGame(cached, selectedVersionGroup), source: 'cache', stale: false };
    }
    const enriched = await enrichWithEvolution(cached);
    assertCurrentEpoch(epoch);
    const pokemon = enriched === cached
      ? cached
      : await commitPokemonUpdate(cached.id, epoch, latest => mergePokemon(latest ?? cached, enriched));
    return { pokemon: materializePokemonForGame(pokemon, selectedVersionGroup), source: 'cache', stale: false };
  }
  try {
    const raw = await fetchPokemon(normalized);
    const refreshed = normalizeApiPokemon(raw, selectedVersionGroup);
    if (!isPokemonAvailableForVersionGroup(refreshed, selectedVersionGroup)) {
      throw unavailablePokemonError(selectedVersionGroup);
    }
    const enriched = await enrichWithEvolution(refreshed);
    assertCurrentEpoch(epoch);
    // Serialize the read/merge/write sequence so concurrent requests for
    // different game versions cannot overwrite each other's version fragments.
    const pokemon = await commitPokemonUpdate(refreshed.id, epoch, latest => mergePokemon(latest ?? cached, enriched));
    return { pokemon: materializePokemonForGame(pokemon, selectedVersionGroup), source: 'network', stale: false };
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    if (cached) return { pokemon: materializePokemonForGame(cached, selectedVersionGroup), source: 'stale-cache', stale: true, error };
    throw error;
  }
}
export function getPokemon(identifier, { forceRefresh = false, versionGroup = state.settings.gameVersionGroup } = {}) {
  const normalized = normalizePokemonIdentifier(identifier);
  const selectedVersionGroup = isGameVersionGroup(versionGroup) ? versionGroup : DEFAULT_GAME_VERSION_GROUP;
  const epoch = repositoryEpoch;
  const key = `${epoch}:${selectedVersionGroup}:${normalized}:${forceRefresh ? 'refresh' : 'normal'}`;
  if (pendingPokemonRequests.has(key)) return pendingPokemonRequests.get(key);
  const request = loadPokemon(normalized, { forceRefresh, versionGroup: selectedVersionGroup, epoch })
    .finally(() => deletePendingRequest(pendingPokemonRequests, key, request));
  pendingPokemonRequests.set(key, request);
  return request;
}
export function getPokemonEncounterLocations(pokemon, versionGroup = state.settings.gameVersionGroup) {
  const selectedVersionGroup = isGameVersionGroup(versionGroup) ? versionGroup : DEFAULT_GAME_VERSION_GROUP;
  const cached = pokemon?.encounterLocations?.[selectedVersionGroup];
  return isValidEncounterCache(cached) && isFresh(cached, CACHE_MAX_AGE_MS) ? cached.locations : null;
}
async function loadEncounterLocations(identifier, { forceRefresh, versionGroup, epoch }) {
  const selectedVersionGroup = versionGroup;
  let pokemon = await getCached(identifier);
  assertCurrentEpoch(epoch);
  if (!pokemon) {
    await getPokemon(identifier, { versionGroup: selectedVersionGroup });
    assertCurrentEpoch(epoch);
    pokemon = await getCached(identifier);
  }
  if (!pokemon) throw new PokeApiError('Could not load the canonical Pokémon record.', { code: 'invalid-response' });
  const cached = pokemon?.encounterLocations?.[selectedVersionGroup];
  if (!forceRefresh && isValidEncounterCache(cached) && isFresh(cached, CACHE_MAX_AGE_MS)) {
    return { pokemon: materializePokemonForGame(pokemon, selectedVersionGroup), locations: cached.locations, source: 'cache' };
  }
  const raw = await fetchPokemonEncounters(pokemon.id);
  assertCurrentEpoch(epoch);
  const encounterCache = {
    cacheSchemaVersion: ENCOUNTER_CACHE_SCHEMA_VERSION,
    locations: normalizePokemonEncounters(raw, selectedVersionGroup),
    fetchedAt: new Date().toISOString()
  };
  const updated = await commitPokemonUpdate(pokemon.id, epoch, latest => {
    const base = latest ?? pokemon;
    return {
      ...base,
      encounterLocations: { ...(base.encounterLocations ?? {}), [selectedVersionGroup]: encounterCache }
    };
  });
  return { pokemon: materializePokemonForGame(updated, selectedVersionGroup), locations: encounterCache.locations, source: 'network' };
}
export function loadPokemonEncounterLocations(identifier, { forceRefresh = false, versionGroup = state.settings.gameVersionGroup } = {}) {
  const selectedVersionGroup = isGameVersionGroup(versionGroup) ? versionGroup : DEFAULT_GAME_VERSION_GROUP;
  const normalized = normalizePokemonIdentifier(identifier);
  const epoch = repositoryEpoch;
  const key = `${epoch}:${selectedVersionGroup}:${normalized}:${forceRefresh ? 'refresh' : 'normal'}`;
  if (pendingEncounterRequests.has(key)) return pendingEncounterRequests.get(key);
  const request = loadEncounterLocations(normalized, { forceRefresh, versionGroup: selectedVersionGroup, epoch })
    .finally(() => deletePendingRequest(pendingEncounterRequests, key, request));
  pendingEncounterRequests.set(key, request);
  return request;
}
export function getLevelUpMoves(pokemon, versionGroup = state.settings.gameVersionGroup) {
  const selectedVersionGroup = isGameVersionGroup(versionGroup) ? versionGroup : DEFAULT_GAME_VERSION_GROUP;
  if (!isValidLevelUpMoveHistory(pokemon?.levelUpMoveHistory)) return null;
  return pokemon.levelUpMoveHistory
    .filter(move => Number.isInteger(move.levels[selectedVersionGroup]))
    .map(move => ({ name: move.name, displayName: move.displayName, level: move.levels[selectedVersionGroup] }))
    .sort((a, b) => a.level - b.level || a.displayName.localeCompare(b.displayName));
}
export function rememberPokemonLookup(pokemon) {
  if (!isValidCachedPokemon(pokemon)) return false;
  const current = Array.isArray(state.recentPokemonIds) ? state.recentPokemonIds : [];
  state.recentPokemonIds = [pokemon.id, ...current.filter(id => id !== pokemon.id)].slice(0, RECENT_POKEMON_LIMIT);
  void saveRecentPokemonIds(state.recentPokemonIds);
  return true;
}
export function getRecentPokemonLookups(versionGroup = state.settings.gameVersionGroup) {
  const ids = Array.isArray(state.recentPokemonIds) ? state.recentPokemonIds : [];
  const recent = ids.map(id => pokemonById.get(id))
    .filter(pokemon => isValidCachedPokemon(pokemon) && isPokemonAvailableForVersionGroup(pokemon, versionGroup))
    .map(pokemon => materializePokemonForGame(pokemon, versionGroup));
  return recent;
}
export async function loadRecentPokemonLookups(versionGroup = state.settings.gameVersionGroup) {
  const epoch = repositoryEpoch;
  const ids = Array.isArray(state.recentPokemonIds) ? state.recentPokemonIds : [];
  const missingIds = ids.filter(id => !pokemonById.has(id));
  const recovered = await Promise.all(missingIds.map(id => readCachedPokemonById(id)));
  if (epoch !== repositoryEpoch) return { pokemon: getRecentPokemonLookups(versionGroup), loaded: false, pruned: 0 };
  let recoveredCount = 0;
  const missingFromStorage = new Set();
  recovered.forEach((record, index) => {
    if (rememberCachedPokemon(record)) recoveredCount += 1;
    else missingFromStorage.add(missingIds[index]);
  });
  if (missingFromStorage.size) {
    state.recentPokemonIds = ids.filter(id => !missingFromStorage.has(id));
    void saveRecentPokemonIds(state.recentPokemonIds);
  }
  return { pokemon: getRecentPokemonLookups(versionGroup), loaded: recoveredCount > 0, pruned: missingFromStorage.size };
}
export function getCachedPokemonNameIndex(versionGroup = state.settings.gameVersionGroup) {
  return isValidNameIndex(pokemonNameIndex) ? materializeNameIndex(pokemonNameIndex, versionGroup) : null;
}
async function loadPokemonNameIndex({ forceRefresh, versionGroup, epoch }) {
  const selectedVersionGroup = versionGroup;
  let cached = getCachedPokemonNameIndex(selectedVersionGroup);
  if (!cached) {
    const stored = await readCachedPokemonNameIndex();
    if (isValidNameIndex(stored)) {
      pokemonNameIndex = stored;
      cached = materializeNameIndex(stored, selectedVersionGroup);
    }
  }
  assertCurrentEpoch(epoch);
  if (cached && !forceRefresh && isFresh(cached, NAME_INDEX_MAX_AGE_MS)) return { names: cached.names, source: 'cache', stale: false };
  try {
    const names = await fetchPokemonNameIndex();
    assertCurrentEpoch(epoch);
    const index = cachePokemonNameIndex(names, epoch);
    return { names: materializeNameIndex(index, selectedVersionGroup).names, source: 'network', stale: false };
  }
  catch (error) { if (error?.name === 'AbortError') throw error; if (cached) return { names: cached.names, source: 'stale-cache', stale: true, error }; throw error; }
}
export function getPokemonNameIndex({ forceRefresh = false, versionGroup = state.settings.gameVersionGroup } = {}) {
  const selectedVersionGroup = isGameVersionGroup(versionGroup) ? versionGroup : DEFAULT_GAME_VERSION_GROUP;
  const epoch = repositoryEpoch;
  const key = `${epoch}:${selectedVersionGroup}:${forceRefresh ? 'refresh' : 'normal'}`;
  if (pendingNameIndexRequests.has(key)) return pendingNameIndexRequests.get(key);
  const request = loadPokemonNameIndex({ forceRefresh, versionGroup: selectedVersionGroup, epoch })
    .finally(() => deletePendingRequest(pendingNameIndexRequests, key, request));
  pendingNameIndexRequests.set(key, request);
  return request;
}

function invalidateRepositoryContext() {
  repositoryEpoch += 1;
  pendingPokemonRequests.clear();
  pendingEncounterRequests.clear();
  pendingNameIndexRequests.clear();
  pokemonCommitQueues.clear();
}

export function switchGameDataContext() {
  invalidateRepositoryContext();
  state.recentPokemonIds = [];
  void saveRecentPokemonIds(state.recentPokemonIds);
  document.dispatchEvent(new CustomEvent('pokemon-game-data-cleared', { detail: { reason: 'game-change', epoch: repositoryEpoch } }));
  return true;
}
export async function clearGameDataCache() {
  invalidateRepositoryContext();
  pokemonById.clear();
  pokemonIdsByName.clear();
  pokemonNameIndex = null;
  state.recentPokemonIds = [];
  void saveRecentPokemonIds(state.recentPokemonIds);
  const cleared = await clearCachedData();
  document.dispatchEvent(new CustomEvent('pokemon-game-data-cleared', { detail: { reason: 'cache-clear', epoch: repositoryEpoch } }));
  if (!cleared) throw new Error('Persistent Pokémon cache could not be cleared.');
  return true;
}
