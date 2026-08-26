import { state } from '../state.js';
import { saveOwnedPokemon } from '../storage.js';

function createEntryId() {
  const random = globalThis.crypto?.randomUUID?.();
  if (random) return random;
  return `owned-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function snapshotPokemon(pokemon) {
  return {
    id: createEntryId(),
    pokemonId: pokemon.id,
    name: pokemon.name,
    displayName: pokemon.displayName,
    nickname: null,
    spriteUrl: pokemon.spriteUrl ?? null,
    level: 1,
    currentMoves: []
  };
}

export function getOwnedPokemon() {
  return state.ownedPokemon;
}

export function getOwnedPokemonById(entryId) {
  return state.ownedPokemon.find(entry => entry.id === entryId) ?? null;
}

export function addOwnedPokemon(pokemon) {
  if (!Number.isInteger(pokemon?.id) || pokemon.id < 1) return null;
  const entry = snapshotPokemon(pokemon);
  state.ownedPokemon.push(entry);
  return saveOwnedPokemon(state.ownedPokemon) ? entry : null;
}

export function removeOwnedPokemon(entryId) {
  const index = state.ownedPokemon.findIndex(entry => entry.id === entryId);
  if (index < 0) return false;
  state.ownedPokemon.splice(index, 1);
  return saveOwnedPokemon(state.ownedPokemon);
}

export function setOwnedPokemonNickname(entryId, nickname) {
  const entry = state.ownedPokemon.find(candidate => candidate.id === entryId);
  if (!entry) return false;
  const normalized = String(nickname ?? '').trim().slice(0, 60);
  entry.nickname = normalized || null;
  return saveOwnedPokemon(state.ownedPokemon);
}


export function setOwnedPokemonSpecies(entryId, pokemon) {
  const entry = state.ownedPokemon.find(candidate => candidate.id === entryId);
  if (!entry || !Number.isInteger(pokemon?.id) || pokemon.id < 1 || pokemon.id === entry.pokemonId) return null;
  const previous = {
    pokemonId: entry.pokemonId,
    name: entry.name,
    displayName: entry.displayName,
    spriteUrl: entry.spriteUrl
  };
  entry.pokemonId = pokemon.id;
  entry.name = pokemon.name;
  entry.displayName = pokemon.displayName;
  entry.spriteUrl = pokemon.spriteUrl ?? null;
  if (saveOwnedPokemon(state.ownedPokemon)) return entry;
  Object.assign(entry, previous);
  return null;
}

export function setOwnedPokemonLevel(entryId, level) {
  const entry = getOwnedPokemonById(entryId);
  if (!entry) return null;
  const normalized = Number(level);
  if (!Number.isInteger(normalized) || normalized < 1 || normalized > 100) return null;
  const previous = entry.level ?? null;
  entry.level = normalized;
  if (saveOwnedPokemon(state.ownedPokemon)) return entry;
  entry.level = previous;
  return null;
}

export function setOwnedPokemonCurrentMove(entryId, moveName, selected) {
  const entry = getOwnedPokemonById(entryId);
  if (!entry) return null;
  const normalized = String(moveName ?? '').trim().toLowerCase();
  if (!normalized) return null;
  const previous = [...(entry.currentMoves ?? [])];
  const currentMoves = [...previous];
  const index = currentMoves.indexOf(normalized);
  if (selected && index < 0) {
    if (currentMoves.length >= 4) return null;
    currentMoves.push(normalized);
  } else if (!selected && index >= 0) {
    currentMoves.splice(index, 1);
  }
  entry.currentMoves = currentMoves;
  if (saveOwnedPokemon(state.ownedPokemon)) return entry;
  entry.currentMoves = previous;
  return null;
}

export function reorderOwnedPokemon(fromIndex, toIndex) {
  if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) return false;
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= state.ownedPokemon.length || toIndex >= state.ownedPokemon.length || fromIndex === toIndex) return false;
  const previous = [...state.ownedPokemon];
  const [entry] = state.ownedPokemon.splice(fromIndex, 1);
  state.ownedPokemon.splice(toIndex, 0, entry);
  if (saveOwnedPokemon(state.ownedPokemon)) return true;
  state.ownedPokemon.splice(0, state.ownedPokemon.length, ...previous);
  return false;
}
