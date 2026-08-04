import { createRelationshipKey, parseRelationshipKey } from './relationships.js';

const STORAGE_KEY = 'pokemon-type-trainer';
export const STORAGE_VERSION = 6;

export const DEFAULT_PERSISTENT_DATA = Object.freeze({
  version: STORAGE_VERSION,
  settings: {
    paletteTheme: 'classic',
    appearance: 'system',
    developer: { autoUpdateOnLaunch: false, showOverlay: false, showErrorOverlay: false },
    quiz: {
      defaultMode: 'select-all',
      common: {},
      modes: { 'select-all': { questionCount: 10 } }
    }
  },
  progress: { quizStats: {}, relationshipStats: {}, pokemonRecognitionStats: {} },
  cache: { pokemon: {}, pokemonNameIndex: null }
});

function cloneDefaults() { return structuredClone(DEFAULT_PERSISTENT_DATA); }
function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function nonnegativeNumber(value, fallback = 0) { return Number.isFinite(value) && value >= 0 ? value : fallback; }
function normalizeQuestionCount(value, fallback = 10) { return new Set([5, 10, 20, 0]).has(value) ? value : fallback; }

function normalizeModeSettings(value, fallback = {}) {
  const normalized = isObject(value) ? { ...value } : {};
  normalized.questionCount = normalizeQuestionCount(normalized.questionCount, normalizeQuestionCount(fallback.questionCount, 10));
  return normalized;
}

function normalizeSettings(value) {
  const defaults = cloneDefaults().settings;
  if (!isObject(value)) return defaults;
  const validPalettes = new Set(['classic']);
  const validAppearances = new Set(['system', 'light', 'dark']);
  const quiz = isObject(value.quiz) ? value.quiz : {};
  const developer = isObject(value.developer) ? value.developer : {};
  const defaultMode = typeof quiz.defaultMode === 'string' ? quiz.defaultMode : defaults.quiz.defaultMode;
  const rawModes = isObject(quiz.modes) ? quiz.modes : {};
  const modeIds = new Set([...Object.keys(defaults.quiz.modes), ...Object.keys(rawModes), defaultMode]);
  const modes = {};
  for (const modeId of modeIds) {
    modes[modeId] = normalizeModeSettings(rawModes[modeId], defaults.quiz.modes[modeId] ?? defaults.quiz.modes['select-all']);
  }
  return {
    paletteTheme: validPalettes.has(value.paletteTheme) ? value.paletteTheme : defaults.paletteTheme,
    appearance: validAppearances.has(value.appearance) ? value.appearance : defaults.appearance,
    developer: {
      autoUpdateOnLaunch: developer.autoUpdateOnLaunch === true,
      showOverlay: developer.showOverlay === true,
      showErrorOverlay: developer.showErrorOverlay === true
    },
    quiz: {
      defaultMode,
      common: isObject(quiz.common) ? { ...quiz.common } : {},
      modes
    }
  };
}

function normalizeRelationshipStats(value) {
  if (!isObject(value)) return {};
  const normalized = {};
  for (const [storedKey, record] of Object.entries(value)) {
    if (!isObject(record)) continue;
    let relationship;
    try {
      relationship = parseRelationshipKey(storedKey);
    } catch {
      try {
        relationship = {
          key: createRelationshipKey(record.attackingType, record.defendingType),
          attackingType: record.attackingType,
          defendingType: record.defendingType
        };
      } catch { continue; }
    }
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
  if (!isObject(value)) return {};
  const normalized = {};
  for (const [storedKey, record] of Object.entries(value)) {
    if (!isObject(record)) continue;
    const pokemonId = Number(record.pokemonId ?? storedKey);
    if (!Number.isInteger(pokemonId) || pokemonId < 1) continue;
    const attempts = Math.floor(nonnegativeNumber(record.attempts));
    normalized[String(pokemonId)] = {
      pokemonId,
      pokemonName: typeof record.pokemonName === 'string' && record.pokemonName.length > 0
        ? record.pokemonName
        : `pokemon-${pokemonId}`,
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

function normalizeQuizStats(value) {
  if (!isObject(value)) return {};
  const normalized = {};
  for (const [modeId, record] of Object.entries(value)) {
    if (!isObject(record) || typeof modeId !== 'string' || !modeId) continue;
    const questionCount = Math.floor(nonnegativeNumber(record.questionCount));
    normalized[modeId] = {
      questionCount,
      totalScore: Math.min(nonnegativeNumber(record.totalScore), questionCount)
    };
  }
  return normalized;
}

function normalizeProgress(value) {
  const defaults = cloneDefaults().progress;
  if (!isObject(value)) return defaults;
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

function normalizeCache(value) {
  return {
    pokemon: isObject(value?.pokemon) ? value.pokemon : {},
    pokemonNameIndex: normalizePokemonNameIndex(value?.pokemonNameIndex)
  };
}

function migrateV1(raw) {
  const defaults = cloneDefaults();
  const oldSettings = isObject(raw.settings) ? raw.settings : {};
  const oldMode = typeof oldSettings.quizMode === 'string' ? oldSettings.quizMode : defaults.settings.quiz.defaultMode;
  const oldLength = normalizeQuestionCount(oldSettings.quizLength, 10);
  return {
    version: STORAGE_VERSION,
    settings: normalizeSettings({ quiz: { defaultMode: oldMode, common: {}, modes: { [oldMode]: { questionCount: oldLength } } } }),
    progress: normalizeProgress(raw.progress),
    cache: normalizeCache(raw.cache)
  };
}

function migrate(raw) {
  if (!isObject(raw)) return cloneDefaults();
  if ([2, 3, 4, 5, STORAGE_VERSION].includes(raw.version)) {
    return {
      version: STORAGE_VERSION,
      settings: normalizeSettings(raw.settings),
      progress: normalizeProgress(raw.progress),
      cache: normalizeCache(raw.cache)
    };
  }
  if (raw.version === 1) return migrateV1(raw);
  return cloneDefaults();
}

export function loadPersistentData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneDefaults();
    const migrated = migrate(JSON.parse(raw));
    write(migrated);
    return migrated;
  } catch (error) {
    console.warn('Could not load saved data. Using defaults.', error);
    return cloneDefaults();
  }
}

function write(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); return true; }
  catch (error) { console.warn('Could not save data.', error); return false; }
}

export function savePersistentData({ settings, progress, cache }) {
  return write({ version: STORAGE_VERSION, settings: normalizeSettings(settings), progress: normalizeProgress(progress), cache: normalizeCache(cache) });
}
export function saveSettings(settings) { const current = loadPersistentData(); current.settings = normalizeSettings(settings); return write(current); }
export function saveProgress(progress) { const current = loadPersistentData(); current.progress = normalizeProgress(progress); return write(current); }
export function saveCache(cache) { const current = loadPersistentData(); current.cache = normalizeCache(cache); return write(current); }
export function clearPersistentData() {
  try { localStorage.removeItem(STORAGE_KEY); return true; }
  catch (error) { console.warn('Could not clear saved data.', error); return false; }
}
