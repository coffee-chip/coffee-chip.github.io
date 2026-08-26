import { state } from '../state.js';
import { savePokemonCollections } from '../storage.js';
import { getPokemon } from './pokemonRepository.js';

const resolvedSpecies = new Map();
const pendingSpecies = new Map();
const speciesErrors = new Map();

function createInstanceId() {
  const random = globalThis.crypto?.randomUUID?.();
  if (random) return random;
  let id;
  do id = `pokemon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  while (state.pokemonInstances[id]);
  return id;
}

function resolutionKey(speciesId, versionGroup = state.settings.gameVersionGroup) {
  return `${versionGroup}:${speciesId}`;
}

function persistCollections() {
  return savePokemonCollections(state.pokemonInstances, state.myPokemonIds, state.teams);
}

function snapshotCollections() {
  return {
    pokemonInstances: structuredClone(state.pokemonInstances),
    myPokemonIds: [...state.myPokemonIds],
    teams: structuredClone(state.teams)
  };
}

function restoreCollections(snapshot) {
  state.pokemonInstances = snapshot.pokemonInstances;
  state.myPokemonIds = snapshot.myPokemonIds;
  state.teams = snapshot.teams;
}

export function updatePokemonCollections(mutate) {
  const previous = snapshotCollections();
  const result = mutate();
  if (result === null || result === false) return result;
  if (persistCollections()) return result;
  restoreCollections(previous);
  return null;
}

export function createPokemonInstanceRecord(pokemon, { level = 1 } = {}) {
  if (!Number.isInteger(pokemon?.id) || pokemon.id < 1) return null;
  if (level !== null && (!Number.isInteger(level) || level < 1 || level > 100)) return null;
  const id = createInstanceId();
  return { id, speciesId: pokemon.id, nickname: null, level, currentMoves: [] };
}

export function getPokemonInstance(instanceId) {
  return state.pokemonInstances[instanceId] ?? null;
}

export function getMyPokemon() {
  return state.myPokemonIds.map(getPokemonInstance).filter(Boolean);
}

export function getMyPokemonById(instanceId) {
  return state.myPokemonIds.includes(instanceId) ? getPokemonInstance(instanceId) : null;
}

export function isPokemonInMyPokemon(instanceId) {
  return state.myPokemonIds.includes(instanceId);
}

export function addPokemonToMyPokemon(pokemon) {
  const instance = createPokemonInstanceRecord(pokemon);
  if (!instance) return null;
  return updatePokemonCollections(() => {
    state.pokemonInstances[instance.id] = instance;
    state.myPokemonIds.push(instance.id);
    return instance;
  });
}

export function addPokemonInstanceToMyPokemon(instanceId) {
  const instance = getPokemonInstance(instanceId);
  if (!instance || isPokemonInMyPokemon(instanceId)) return null;
  return updatePokemonCollections(() => {
    instance.level ??= 1;
    state.myPokemonIds.push(instanceId);
    return instance;
  });
}

export function pruneUnreferencedPokemonInstances() {
  const referencedIds = new Set(state.myPokemonIds);
  for (const team of state.teams) for (const instanceId of team.memberIds) referencedIds.add(instanceId);
  for (const instanceId of Object.keys(state.pokemonInstances)) {
    if (!referencedIds.has(instanceId)) delete state.pokemonInstances[instanceId];
  }
}

export function removePokemonFromMyPokemon(instanceId) {
  const index = state.myPokemonIds.indexOf(instanceId);
  if (index < 0) return false;
  return Boolean(updatePokemonCollections(() => {
    state.myPokemonIds.splice(index, 1);
    pruneUnreferencedPokemonInstances();
    return true;
  }));
}

export function setPokemonInstanceNickname(instanceId, nickname) {
  const instance = getPokemonInstance(instanceId);
  if (!instance) return false;
  const normalized = String(nickname ?? '').trim().slice(0, 60);
  return Boolean(updatePokemonCollections(() => {
    instance.nickname = normalized || null;
    return true;
  }));
}

export function setPokemonInstanceSpecies(instanceId, pokemon) {
  const instance = getPokemonInstance(instanceId);
  if (!instance || !Number.isInteger(pokemon?.id) || pokemon.id < 1 || pokemon.id === instance.speciesId) return null;
  return updatePokemonCollections(() => {
    instance.speciesId = pokemon.id;
    return instance;
  });
}

export function setPokemonInstanceLevel(instanceId, level) {
  const instance = getPokemonInstance(instanceId);
  const normalized = Number(level);
  if (!instance || !Number.isInteger(normalized) || normalized < 1 || normalized > 100) return null;
  return updatePokemonCollections(() => {
    instance.level = normalized;
    return instance;
  });
}

export function setPokemonInstanceCurrentMove(instanceId, moveName, selected) {
  const instance = getPokemonInstance(instanceId);
  if (!instance) return null;
  const normalized = String(moveName ?? '').trim().toLowerCase();
  if (!normalized) return null;
  const currentMoves = [...instance.currentMoves];
  const index = currentMoves.indexOf(normalized);
  if (selected && index < 0) {
    if (currentMoves.length >= 4) return null;
    currentMoves.push(normalized);
  } else if (!selected && index >= 0) currentMoves.splice(index, 1);
  return updatePokemonCollections(() => {
    instance.currentMoves = currentMoves;
    return instance;
  });
}

export function reorderMyPokemon(fromIndex, toIndex) {
  if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) return false;
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= state.myPokemonIds.length || toIndex >= state.myPokemonIds.length || fromIndex === toIndex) return false;
  return Boolean(updatePokemonCollections(() => {
    const [instanceId] = state.myPokemonIds.splice(fromIndex, 1);
    state.myPokemonIds.splice(toIndex, 0, instanceId);
    return true;
  }));
}

export function getPokemonInstanceView(instanceId, versionGroup = state.settings.gameVersionGroup) {
  const instance = getPokemonInstance(instanceId);
  if (!instance) return null;
  const key = resolutionKey(instance.speciesId, versionGroup);
  const pokemon = resolvedSpecies.get(key) ?? null;
  const error = speciesErrors.get(key) ?? null;
  return {
    instance,
    pokemon,
    displayName: instance.nickname || pokemon?.displayName || `Pokémon #${instance.speciesId}`,
    status: pokemon ? 'resolved' : error ? 'error' : pendingSpecies.has(key) ? 'loading' : 'idle',
    error
  };
}

export function resolvePokemonInstance(instanceId, versionGroup = state.settings.gameVersionGroup) {
  const instance = getPokemonInstance(instanceId);
  if (!instance) return Promise.reject(new Error('That Pokémon instance no longer exists.'));
  const key = resolutionKey(instance.speciesId, versionGroup);
  if (resolvedSpecies.has(key)) return Promise.resolve(getPokemonInstanceView(instanceId, versionGroup));
  if (speciesErrors.has(key)) return Promise.reject(speciesErrors.get(key));
  if (!pendingSpecies.has(key)) {
    const request = getPokemon(instance.speciesId, { versionGroup })
      .then(result => {
        resolvedSpecies.set(key, result.pokemon);
        speciesErrors.delete(key);
        return result.pokemon;
      })
      .catch(error => {
        speciesErrors.set(key, error);
        throw error;
      })
      .finally(() => pendingSpecies.delete(key));
    pendingSpecies.set(key, request);
  }
  return pendingSpecies.get(key).then(() => getPokemonInstanceView(instanceId, versionGroup));
}

export function clearResolvedPokemonInstances() {
  resolvedSpecies.clear();
  pendingSpecies.clear();
  speciesErrors.clear();
}

globalThis.document?.addEventListener('pokemon-game-data-cleared', clearResolvedPokemonInstances);
