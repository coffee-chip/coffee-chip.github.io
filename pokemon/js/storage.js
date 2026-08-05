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
  cache: { pokemon: {}, pokemonNameIndex: null, recentPokemonIds: [] }
});

const cloneDefaults = () => structuredClone(DEFAULT_PERSISTENT_DATA);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonnegative = (value, fallback = 0) => Number.isFinite(value) && value >= 0 ? value : fallback;

function normalizeSettings(value) {
  const defaults = cloneDefaults().settings;
  if (!isObject(value)) return defaults;
  const quiz = isObject(value.quiz) ? value.quiz : {};
  const developer = isObject(value.developer) ? value.developer : {};
  const defaultMode = typeof quiz.defaultMode === 'string' ? quiz.defaultMode : defaults.quiz.defaultMode;
  const modes = {};
  for (const [id, settings] of Object.entries(isObject(quiz.modes) ? quiz.modes : {})) {
    if (id && isObject(settings)) modes[id] = { ...settings };
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
  const result = {};
  if (!isObject(value)) return result;
  for (const [id, record] of Object.entries(value)) {
    if (!id || !isObject(record)) continue;
    const questionCount = Math.floor(nonnegative(record.questionCount));
    result[id] = { questionCount, totalScore: Math.min(nonnegative(record.totalScore), questionCount) };
  }
  return result;
}

function normalizeRelationshipStats(value) {
  const result = {};
  if (!isObject(value)) return result;
  for (const [key, record] of Object.entries(value)) {
    if (!isObject(record)) continue;
    let relationship;
    try { relationship = parseRelationshipKey(key); } catch { continue; }
    const attempts = Math.floor(nonnegative(record.attempts));
    result[relationship.key] = {
      attackingType: relationship.attackingType, defendingType: relationship.defendingType,
      attempts, earnedScore: Math.min(nonnegative(record.earnedScore), attempts),
      correctSelections: Math.floor(nonnegative(record.correctSelections)),
      misses: Math.floor(nonnegative(record.misses)),
      falseSelections: Math.floor(nonnegative(record.falseSelections)),
      lastSeen: typeof record.lastSeen === 'string' ? record.lastSeen : null
    };
  }
  return result;
}

function normalizePokemonRecognitionStats(value) {
  const result = {};
  if (!isObject(value)) return result;
  for (const [key, record] of Object.entries(value)) {
    if (!isObject(record)) continue;
    const pokemonId = Number(record.pokemonId ?? key);
    if (!Number.isInteger(pokemonId) || pokemonId < 1) continue;
    const attempts = Math.floor(nonnegative(record.attempts));
    result[String(pokemonId)] = {
      pokemonId,
      pokemonName: typeof record.pokemonName === 'string' && record.pokemonName ? record.pokemonName : `pokemon-${pokemonId}`,
      attempts, earnedScore: Math.min(nonnegative(record.earnedScore), attempts),
      exactAnswers: Math.min(Math.floor(nonnegative(record.exactAnswers)), attempts),
      correctSelections: Math.floor(nonnegative(record.correctSelections)),
      misses: Math.floor(nonnegative(record.misses)),
      falseSelections: Math.floor(nonnegative(record.falseSelections)),
      lastSeen: typeof record.lastSeen === 'string' ? record.lastSeen : null
    };
  }
  return result;
}

function normalizeProgress(value) {
  if (!isObject(value)) return cloneDefaults().progress;
  return {
    quizStats: normalizeQuizStats(value.quizStats),
    relationshipStats: normalizeRelationshipStats(value.relationshipStats),
    pokemonRecognitionStats: normalizePokemonRecognitionStats(value.pokemonRecognitionStats)
  };
}

function normalizeNameIndex(value) {
  if (!isObject(value) || !Array.isArray(value.names) || typeof value.fetchedAt !== 'string') return null;
  const names = [...new Set(value.names.filter(name => typeof name === 'string' && name))];
  return names.length ? { names, fetchedAt: value.fetchedAt } : null;
}

function normalizeCache(value) {
  const ids = Array.isArray(value?.recentPokemonIds)
    ? [...new Set(value.recentPokemonIds.map(Number).filter(id => Number.isInteger(id) && id > 0))].slice(0, 10)
    : [];
  return {
    pokemon: isObject(value?.pokemon) ? value.pokemon : {},
    pokemonNameIndex: normalizeNameIndex(value?.pokemonNameIndex),
    recentPokemonIds: ids
  };
}

function normalizeCurrentData(raw) {
  if (!isObject(raw) || raw.version !== STORAGE_VERSION) return cloneDefaults();
  return {
    version: STORAGE_VERSION,
    settings: normalizeSettings(raw.settings),
    progress: normalizeProgress(raw.progress),
    cache: normalizeCache(raw.cache)
  };
}

function write(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); return true; }
  catch (error) { console.warn('Could not save data.', error); return false; }
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

export function savePersistentData({ settings, progress, cache }) {
  return write({ version: STORAGE_VERSION, settings: normalizeSettings(settings), progress: normalizeProgress(progress), cache: normalizeCache(cache) });
}
export function saveSettings(settings) { const data = loadPersistentData(); data.settings = normalizeSettings(settings); return write(data); }
export function saveProgress(progress) { const data = loadPersistentData(); data.progress = normalizeProgress(progress); return write(data); }
export function saveCache(cache) { const data = loadPersistentData(); data.cache = normalizeCache(cache); return write(data); }
export function clearPersistentData() {
  try { localStorage.removeItem(STORAGE_KEY); return true; }
  catch (error) { console.warn('Could not clear saved data.', error); return false; }
}
