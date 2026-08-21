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
    spriteUrl: pokemon.spriteUrl ?? null
  };
}

export function getOwnedPokemon() {
  return state.ownedPokemon;
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
