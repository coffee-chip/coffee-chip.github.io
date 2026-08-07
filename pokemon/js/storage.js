import { parseRelationshipKey } from './relationships.js';

const STORAGE_KEY = 'pokemon-type-trainer';
export const STORAGE_VERSION = 9;

export const DEFAULT_PERSISTENT_DATA = Object.freeze({
  version: STORAGE_VERSION,
  settings: {
    paletteTheme: 'classic', appearance: 'system',
    developer: { autoUpdateOnLaunch: false, showOverlay: false, showErrorOverlay: false },
    quiz: { defaultMode: 'choose-switch', modes: { 'choose-switch': {} } }
  },
  progress: { quizStats: {}, relationshipStats: {}, pokemonRecognitionStats: {} },
  cache: { pokemon: {}, pokemonNameIndex: null, recentPokemonIds: [] },
  teams: [
    { id: 'my-team', title: 'My team', isOpponent: false, rivalTeamId: null, pokemon: [] },
    { id: 'opponents', title: 'Opponents', isOpponent: true, rivalTeamId: null, pokemon: [] }
  ]
});

function cloneDefaults() { return structuredClone(DEFAULT_PERSISTENT_DATA); }
function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function nonnegativeNumber(value, fallback = 0) { return Number.isFinite(value) && value >= 0 ? value : fallback; }

function normalizeSettings(value) {
  const defaults = cloneDefaults().settings;
  if (!isObject(value)) return defaults;
  const quiz = isObject(value.quiz) ? value.quiz : {};
  const developer = isObject(value.developer) ? value.developer : {};
  const defaultMode = typeof quiz.defaultMode === 'string' ? quiz.defaultMode : defaults.quiz.defaultMode;
  const modes = {};
  for (const [modeId, modeSettings] of Object.entries(isObject(quiz.modes) ? quiz.modes : {})) {
    if (modeId && isObject(modeSettings)) modes[modeId] = { ...modeSettings };
  }
  modes[defaultMode] ??= {};
  return {
    paletteTheme: value.paletteTheme === 'classic' ? 'classic' : defaults.paletteTheme,
    appearance: ['system', 'light', 'dark'].includes(value.appearance) ? value.appearance : defaults.appearance,
    developer: {
      autoUpdateOnLaunch: developer.autoUpdateOnLaunch === true,
      showOverlay: developer.showOverlay === true,
      showErrorOverlay: developer.showErrorOverlay === true
    },
    quiz: { defaultMode, modes }
  };
}

function normalizeQuizStats(value) {
  const normalized = {};
  if (!isObject(value)) return normalized;
  for (const [modeId, record] of Object.entries(value)) {
    if (!modeId || !isObject(record)) continue;
    const questionCount = Math.floor(nonnegativeNumber(record.questionCount));
    normalized[modeId] = { questionCount, totalScore: Math.min(nonnegativeNumber(record.totalScore), questionCount) };
  }
  return normalized;
}

function normalizeRelationshipStats(value) {
  const normalized = {};
  if (!isObject(value)) return normalized;
  for (const [storedKey, record] of Object.entries(value)) {
    if (!isObject(record)) continue;
    let relationship;
    try { relationship = parseRelationshipKey(storedKey); } catch { continue; }
    const attempts = Math.floor(nonnegativeNumber(record.attempts));
    normalized[relationship.key] = {
      attackingType: relationship.attackingType,
      defendingType: relationship.defendingType,
      attempts,
      earnedScore: Math.min(nonnegativeNumber(record.earnedScore), attempts),
      correctSelections: Math.floor(nonnegativeNumber(record.correctSelections)),
      misses: Math.floor(nonnegativeNumber(record.misses)),
      falseSelections: Math.floor(nonnegativeNumber(record.falseSelections)),
      lastSeen: typeof record.lastSeen === 'string' ? record.lastSeen : null
    };
  }
  return normalized;
}

function normalizePokemonRecognitionStats(value) {
  const normalized = {};
  if (!isObject(value)) return normalized;
  for (const [storedKey, record] of Object.entries(value)) {
    if (!isObject(record)) continue;
    const pokemonId = Number(record.pokemonId ?? storedKey);
    if (!Number.isInteger(pokemonId) || pokemonId < 1) continue;
    const attempts = Math.floor(nonnegativeNumber(record.attempts));
    normalized[String(pokemonId)] = {
      pokemonId,
      pokemonName: typeof record.pokemonName === 'string' && record.pokemonName ? record.pokemonName : `pokemon-${pokemonId}`,
      attempts,
      earnedScore: Math.min(nonnegativeNumber(record.earnedScore), attempts),
      exactAnswers: Math.min(Math.floor(nonnegativeNumber(record.exactAnswers)), attempts),
      correctSelections: Math.floor(nonnegativeNumber(record.correctSelections)),
      misses: Math.floor(nonnegativeNumber(record.misses)),
      falseSelections: Math.floor(nonnegativeNumber(record.falseSelections)),
      lastSeen: typeof record.lastSeen === 'string' ? record.lastSeen : null
    };
  }
  return normalized;
}

function normalizeProgress(value) {
  if (!isObject(value)) return cloneDefaults().progress;
  return {
    quizStats: normalizeQuizStats(value.quizStats),
    relationshipStats: normalizeRelationshipStats(value.relationshipStats),
    pokemonRecognitionStats: normalizePokemonRecognitionStats(value.pokemonRecognitionStats)
  };
}

function normalizePokemonNameIndex(value) {
  if (!isObject(value) || !Array.isArray(value.names) || typeof value.fetchedAt !== 'string') return null;
  const names = [...new Set(value.names.filter(name => typeof name === 'string' && name.length > 0))];
  return names.length ? { names, fetchedAt: value.fetchedAt } : null;
}

function normalizeRecentPokemonIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(Number).filter(id => Number.isInteger(id) && id > 0))].slice(0, 10);
}

function normalizeCache(value) {
  return {
    pokemon: isObject(value?.pokemon) ? value.pokemon : {},
    pokemonNameIndex: normalizePokemonNameIndex(value?.pokemonNameIndex),
    recentPokemonIds: normalizeRecentPokemonIds(value?.recentPokemonIds)
  };
}

function normalizeTeamPokemon(value) {
  if (!isObject(value)) return null;
  const id = Number(value.id);
  if (!Number.isInteger(id) || id < 1) return null;
  return {
    id,
    name: typeof value.name === 'string' && value.name ? value.name : `pokemon-${id}`,
    displayName: typeof value.displayName === 'string' && value.displayName ? value.displayName : `Pokémon #${id}`,
    spriteUrl: typeof value.spriteUrl === 'string' && value.spriteUrl ? value.spriteUrl : null
  };
}

function normalizeTeams(value) {
  if (!Array.isArray(value)) return cloneDefaults().teams;
  const seenIds = new Set();
  const normalized = [];
  for (const team of value) {
    if (!isObject(team)) continue;
    const id = typeof team.id === 'string' && team.id.trim() ? team.id.trim() : null;
    const title = typeof team.title === 'string' && team.title.trim() ? team.title.trim().slice(0, 60) : null;
    if (!id || !title || seenIds.has(id)) continue;
    seenIds.add(id);
    const pokemon = [];
    const seenPokemon = new Set();
    for (const entry of Array.isArray(team.pokemon) ? team.pokemon : []) {
      const normalizedPokemon = normalizeTeamPokemon(entry);
      if (!normalizedPokemon || seenPokemon.has(normalizedPokemon.id)) continue;
      seenPokemon.add(normalizedPokemon.id);
      pokemon.push(normalizedPokemon);
      if (pokemon.length === 6) break;
    }
    const isOpponent = typeof team.isOpponent === 'boolean' ? team.isOpponent : id === 'opponents';
    const rivalTeamId = typeof team.rivalTeamId === 'string' && team.rivalTeamId.trim() ? team.rivalTeamId.trim() : null;
    normalized.push({ id, title, isOpponent, rivalTeamId, pokemon });
  }
  const validIds = new Set(normalized.map(team => team.id));
  for (const team of normalized) {
    if (!team.rivalTeamId || team.rivalTeamId === team.id || !validIds.has(team.rivalTeamId)) team.rivalTeamId = null;
  }
  for (const team of normalized) {
    if (!team.rivalTeamId) continue;
    const rival = normalized.find(candidate => candidate.id === team.rivalTeamId);
    if (!rival || rival.rivalTeamId !== team.id) team.rivalTeamId = null;
  }
  return normalized;
}

function normalizeCurrentData(raw) {
  if (!isObject(raw) || raw.version !== STORAGE_VERSION) return cloneDefaults();
  return {
    version: STORAGE_VERSION,
    settings: normalizeSettings(raw.settings),
    progress: normalizeProgress(raw.progress),
    cache: normalizeCache(raw.cache),
    teams: normalizeTeams(raw.teams)
  };
}

function write(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); return true; }
  catch (error) { console.warn('Could not save data.', error); return false; }
}

function updateSection(section, value, normalize) {
  const data = loadPersistentData();
  data[section] = normalize(value);
  return write(data);
}

export function loadPersistentData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneDefaults();
    const normalized = normalizeCurrentData(JSON.parse(raw));
    write(normalized);
    return normalized;
  } catch (error) {
    console.warn('Could not load saved data. Using defaults.', error);
    return cloneDefaults();
  }
}

export function savePersistentData({ settings, progress, cache, teams }) {
  return write({
    version: STORAGE_VERSION,
    settings: normalizeSettings(settings),
    progress: normalizeProgress(progress),
    cache: normalizeCache(cache),
    teams: normalizeTeams(teams)
  });
}

export function saveSettings(settings) { return updateSection('settings', settings, normalizeSettings); }
export function saveProgress(progress) { return updateSection('progress', progress, normalizeProgress); }
export function saveCache(cache) { return updateSection('cache', cache, normalizeCache); }
export function saveTeams(teams) { return updateSection('teams', teams, normalizeTeams); }
export function clearPersistentData() {
  try { localStorage.removeItem(STORAGE_KEY); return true; }
  catch (error) { console.warn('Could not clear saved data.', error); return false; }
}
