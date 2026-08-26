import { state } from '../state.js';
import {
  createPokemonInstanceRecord,
  getPokemonInstance,
  pruneUnreferencedPokemonInstances,
  updatePokemonCollections
} from './pokemonInstanceRepository.js';

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
  const team = { id: createTeamId(normalizedTitle), title: normalizedTitle, isOpponent: false, rivalTeamId: null, memberIds: [] };
  return updatePokemonCollections(() => {
    state.teams.push(team);
    return team;
  });
}

export function renameTeam(teamId, title) {
  const team = getTeam(teamId);
  const normalizedTitle = String(title ?? '').trim().slice(0, 60);
  if (!team || !normalizedTitle) return false;
  return Boolean(updatePokemonCollections(() => {
    team.title = normalizedTitle;
    return true;
  }));
}

export function setTeamOpponent(teamId, isOpponent) {
  const team = getTeam(teamId);
  if (!team) return false;
  return Boolean(updatePokemonCollections(() => {
    team.isOpponent = isOpponent === true;
    return true;
  }));
}

export function clearRivalry(teamId) {
  const team = getTeam(teamId);
  if (!team) return false;
  const rival = team.rivalTeamId ? getTeam(team.rivalTeamId) : null;
  return Boolean(updatePokemonCollections(() => {
    team.rivalTeamId = null;
    if (rival?.rivalTeamId === team.id) rival.rivalTeamId = null;
    return true;
  }));
}

export function setRivalry(teamId, rivalTeamId) {
  const team = getTeam(teamId);
  const rival = getTeam(rivalTeamId);
  if (!team || !rival || team.id === rival.id) return false;
  if (team.rivalTeamId === rival.id && rival.rivalTeamId === team.id) return true;

  const oldTeamRival = team.rivalTeamId ? getTeam(team.rivalTeamId) : null;
  const oldRivalRival = rival.rivalTeamId ? getTeam(rival.rivalTeamId) : null;
  return Boolean(updatePokemonCollections(() => {
    if (oldTeamRival?.rivalTeamId === team.id) oldTeamRival.rivalTeamId = null;
    if (oldRivalRival?.rivalTeamId === rival.id) oldRivalRival.rivalTeamId = null;
    team.rivalTeamId = rival.id;
    rival.rivalTeamId = team.id;
    return true;
  }));
}

export function deleteTeam(teamId) {
  const index = state.teams.findIndex(team => team.id === teamId);
  if (index < 0) return false;
  const team = state.teams[index];
  const rival = team.rivalTeamId ? getTeam(team.rivalTeamId) : null;
  return Boolean(updatePokemonCollections(() => {
    if (rival?.rivalTeamId === team.id) rival.rivalTeamId = null;
    state.teams.splice(index, 1);
    pruneUnreferencedPokemonInstances();
    return true;
  }));
}

export function addPokemonToTeam(teamId, pokemon) {
  const team = getTeam(teamId);
  if (!team || !Number.isInteger(pokemon?.id)) return { ok: false, reason: 'not-found' };
  if (team.memberIds.length >= TEAM_SIZE_LIMIT) return { ok: false, reason: 'full' };
  const instance = createPokemonInstanceRecord(pokemon, { level: null });
  if (!instance) return { ok: false, reason: 'not-found' };
  const saved = updatePokemonCollections(() => {
    state.pokemonInstances[instance.id] = instance;
    team.memberIds.push(instance.id);
    return { ok: true, team, instance };
  });
  return saved ?? { ok: false, reason: 'save-failed' };
}

export function addPokemonInstanceToTeam(teamId, instanceId) {
  const team = getTeam(teamId);
  const instance = getPokemonInstance(instanceId);
  if (!team || !instance) return { ok: false, reason: 'not-found' };
  if (team.memberIds.includes(instanceId)) return { ok: false, reason: 'duplicate' };
  if (team.memberIds.length >= TEAM_SIZE_LIMIT) return { ok: false, reason: 'full' };
  const saved = updatePokemonCollections(() => {
    team.memberIds.push(instanceId);
    return { ok: true, team, instance };
  });
  return saved ?? { ok: false, reason: 'save-failed' };
}

export function removePokemonFromTeam(teamId, instanceId) {
  const team = getTeam(teamId);
  if (!team) return false;
  const index = team.memberIds.indexOf(instanceId);
  if (index < 0) return false;
  return Boolean(updatePokemonCollections(() => {
    team.memberIds.splice(index, 1);
    pruneUnreferencedPokemonInstances();
    return true;
  }));
}

export function reorderPokemonInTeam(teamId, fromIndex, toIndex) {
  const team = getTeam(teamId);
  if (!team || !Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) return false;
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= team.memberIds.length || toIndex >= team.memberIds.length || fromIndex === toIndex) return false;
  return Boolean(updatePokemonCollections(() => {
    const [instanceId] = team.memberIds.splice(fromIndex, 1);
    team.memberIds.splice(toIndex, 0, instanceId);
    return true;
  }));
}

export function reorderTeams(fromIndex, toIndex) {
  if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) return false;
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= state.teams.length || toIndex >= state.teams.length || fromIndex === toIndex) return false;
  return Boolean(updatePokemonCollections(() => {
    const [team] = state.teams.splice(fromIndex, 1);
    state.teams.splice(toIndex, 0, team);
    return true;
  }));
}

export const TEAM_MAX_POKEMON = TEAM_SIZE_LIMIT;
