const STORAGE_KEY = 'pokemon-type-trainer';
export const STORAGE_VERSION = 3;

export const DEFAULT_PERSISTENT_DATA = Object.freeze({
  version: STORAGE_VERSION,
  settings: {
    theme: 'system',
    developer: {
      autoUpdateOnLaunch: false
    },
    quiz: {
      defaultMode: 'select-all',
      common: {},
      modes: {
        'select-all': { questionCount: 10 }
      }
    }
  },
  progress: {
    totalAnswered: 0,
    totalScore: 0,
    relationshipStats: {}
  },
  cache: {
    pokemon: {}
  }
});

function cloneDefaults() { return structuredClone(DEFAULT_PERSISTENT_DATA); }
function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function normalizeQuestionCount(value, fallback = 10) { return new Set([5, 10, 20, 0]).has(value) ? value : fallback; }

function normalizeModeSettings(value, fallback = {}) {
  const normalized = isObject(value) ? { ...value } : {};
  normalized.questionCount = normalizeQuestionCount(normalized.questionCount, normalizeQuestionCount(fallback.questionCount, 10));
  return normalized;
}

function normalizeSettings(value) {
  const defaults = cloneDefaults().settings;
  if (!isObject(value)) return defaults;
  const validThemes = new Set(['system', 'light', 'dark']);
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
    theme: validThemes.has(value.theme) ? value.theme : defaults.theme,
    developer: {
      autoUpdateOnLaunch: developer.autoUpdateOnLaunch === true
    },
    quiz: {
      defaultMode,
      common: isObject(quiz.common) ? { ...quiz.common } : {},
      modes
    }
  };
}

function normalizeProgress(value) {
  const defaults = cloneDefaults().progress;
  if (!isObject(value)) return defaults;
  return {
    totalAnswered: Number.isFinite(value.totalAnswered) && value.totalAnswered >= 0 ? Math.floor(value.totalAnswered) : defaults.totalAnswered,
    totalScore: Number.isFinite(value.totalScore) && value.totalScore >= 0 ? value.totalScore : defaults.totalScore,
    relationshipStats: isObject(value.relationshipStats) ? value.relationshipStats : {}
  };
}

function normalizeCache(value) { return { pokemon: isObject(value?.pokemon) ? value.pokemon : {} }; }

function migrateV1(raw) {
  const defaults = cloneDefaults();
  const oldSettings = isObject(raw.settings) ? raw.settings : {};
  const oldMode = typeof oldSettings.quizMode === 'string' ? oldSettings.quizMode : defaults.settings.quiz.defaultMode;
  const oldLength = normalizeQuestionCount(oldSettings.quizLength, 10);
  return {
    version: STORAGE_VERSION,
    settings: normalizeSettings({
      theme: oldSettings.theme,
      quiz: { defaultMode: oldMode, common: {}, modes: { [oldMode]: { questionCount: oldLength } } }
    }),
    progress: normalizeProgress(raw.progress),
    cache: normalizeCache(raw.cache)
  };
}

function migrate(raw) {
  if (!isObject(raw)) return cloneDefaults();
  if (raw.version === STORAGE_VERSION || raw.version === 2) {
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
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    console.warn('Could not save data.', error);
    return false;
  }
}

export function savePersistentData({ settings, progress, cache }) {
  return write({ version: STORAGE_VERSION, settings: normalizeSettings(settings), progress: normalizeProgress(progress), cache: normalizeCache(cache) });
}

export function saveSettings(settings) {
  const current = loadPersistentData();
  current.settings = normalizeSettings(settings);
  return write(current);
}

export function saveProgress(progress) {
  const current = loadPersistentData();
  current.progress = normalizeProgress(progress);
  return write(current);
}

export function saveCache(cache) {
  const current = loadPersistentData();
  current.cache = normalizeCache(cache);
  return write(current);
}

export function clearPersistentData() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (error) {
    console.warn('Could not clear saved data.', error);
    return false;
  }
}
