import { state } from '../state.js';
import { saveTeams } from '../storage.js';

const TEAM_SIZE_LIMIT = 6;

function createTeamId(title) {
  const base = title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'team';
  let id = base;
  let suffix = 2;
  while (state.teams.some(team => team.id === id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  return id;
}

function snapshotPokemon(pokemon) {
  return {
    id: pokemon.id,
    name: pokemon.name,
    displayName: pokemon.displayName,
    spriteUrl: pokemon.spriteUrl ?? null
  };
}

export function getTeams() {
  return state.teams;
}

export function getTeam(teamId) {
  return state.teams.find(team => team.id === teamId) ?? null;
}

export function createTeam(title) {
  const normalizedTitle = String(title ?? '').trim().slice(0, 60);
  if (!normalizedTitle) return null;
  const team = { id: createTeamId(normalizedTitle), title: normalizedTitle, isOpponent: false, pokemon: [] };
  state.teams.push(team);
  saveTeams(state.teams);
  return team;
}

export function setTeamOpponent(teamId, isOpponent) {
  const team = getTeam(teamId);
  if (!team) return false;
  team.isOpponent = isOpponent === true;
  return saveTeams(state.teams);
}

export function deleteTeam(teamId) {
  const index = state.teams.findIndex(team => team.id === teamId);
  if (index < 0) return false;
  state.teams.splice(index, 1);
  return saveTeams(state.teams);
}

export function addPokemonToTeam(teamId, pokemon) {
  const team = getTeam(teamId);
  if (!team || !Number.isInteger(pokemon?.id)) return { ok: false, reason: 'not-found' };
  if (team.pokemon.some(entry => entry.id === pokemon.id)) return { ok: false, reason: 'duplicate' };
  if (team.pokemon.length >= TEAM_SIZE_LIMIT) return { ok: false, reason: 'full' };
  team.pokemon.push(snapshotPokemon(pokemon));
  saveTeams(state.teams);
  return { ok: true, team };
}

export function removePokemonFromTeam(teamId, pokemonId) {
  const team = getTeam(teamId);
  if (!team) return false;
  const index = team.pokemon.findIndex(entry => entry.id === pokemonId);
  if (index < 0) return false;
  team.pokemon.splice(index, 1);
  return saveTeams(state.teams);
}

export function reorderTeams(fromIndex, toIndex) {
  if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) return false;
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= state.teams.length || toIndex >= state.teams.length || fromIndex === toIndex) return false;
  const [team] = state.teams.splice(fromIndex, 1);
  state.teams.splice(toIndex, 0, team);
  return saveTeams(state.teams);
}

export const TEAM_MAX_POKEMON = TEAM_SIZE_LIMIT;
