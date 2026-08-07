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

export function getRival(teamId) {
  const team = getTeam(teamId);
  return team?.rivalTeamId ? getTeam(team.rivalTeamId) : null;
}

export function createTeam(title) {
  const normalizedTitle = String(title ?? '').trim().slice(0, 60);
  if (!normalizedTitle) return null;
  const team = { id: createTeamId(normalizedTitle), title: normalizedTitle, isOpponent: false, rivalTeamId: null, pokemon: [] };
  state.teams.push(team);
  saveTeams(state.teams);
  return team;
}

export function renameTeam(teamId, title) {
  const team = getTeam(teamId);
  const normalizedTitle = String(title ?? '').trim().slice(0, 60);
  if (!team || !normalizedTitle) return false;
  team.title = normalizedTitle;
  return saveTeams(state.teams);
}

export function setTeamOpponent(teamId, isOpponent) {
  const team = getTeam(teamId);
  if (!team) return false;
  team.isOpponent = isOpponent === true;
  return saveTeams(state.teams);
}

export function clearRivalry(teamId) {
  const team = getTeam(teamId);
  if (!team) return false;
  const rival = team.rivalTeamId ? getTeam(team.rivalTeamId) : null;
  team.rivalTeamId = null;
  if (rival?.rivalTeamId === team.id) rival.rivalTeamId = null;
  return saveTeams(state.teams);
}

export function setRivalry(teamId, rivalTeamId) {
  const team = getTeam(teamId);
  const rival = getTeam(rivalTeamId);
  if (!team || !rival || team.id === rival.id) return false;
  if (team.rivalTeamId === rival.id && rival.rivalTeamId === team.id) return true;

  const oldTeamRival = team.rivalTeamId ? getTeam(team.rivalTeamId) : null;
  const oldRivalRival = rival.rivalTeamId ? getTeam(rival.rivalTeamId) : null;
  if (oldTeamRival?.rivalTeamId === team.id) oldTeamRival.rivalTeamId = null;
  if (oldRivalRival?.rivalTeamId === rival.id) oldRivalRival.rivalTeamId = null;

  team.rivalTeamId = rival.id;
  rival.rivalTeamId = team.id;
  return saveTeams(state.teams);
}

export function deleteTeam(teamId) {
  const index = state.teams.findIndex(team => team.id === teamId);
  if (index < 0) return false;
  const team = state.teams[index];
  const rival = team.rivalTeamId ? getTeam(team.rivalTeamId) : null;
  if (rival?.rivalTeamId === team.id) rival.rivalTeamId = null;
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

export function setTeamPokemonAlias(teamId, pokemonId, alias, canonicalDisplayName) {
  const team = getTeam(teamId);
  if (!team) return false;
  const member = team.pokemon.find(entry => entry.id === pokemonId);
  if (!member) return false;
  const normalizedAlias = String(alias ?? '').trim().slice(0, 60);
  const fallback = String(canonicalDisplayName ?? member.displayName ?? '').trim().slice(0, 60);
  member.displayName = normalizedAlias || fallback || member.displayName;
  return saveTeams(state.teams);
}

export function reorderPokemonInTeam(teamId, fromIndex, toIndex) {
  const team = getTeam(teamId);
  if (!team || !Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) return false;
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= team.pokemon.length || toIndex >= team.pokemon.length || fromIndex === toIndex) return false;
  const [member] = team.pokemon.splice(fromIndex, 1);
  team.pokemon.splice(toIndex, 0, member);
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
