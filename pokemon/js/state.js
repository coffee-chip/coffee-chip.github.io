import { parseRelationshipKey } from './relationships.js';

function emptyProgress() {
  return { totalAnswered: 0, totalScore: 0, relationshipStats: {}, pokemonRecognitionStats: {} };
}

export const state = {
  route: 'quiz',
  quiz: {
    mode: 'select-all', status: 'idle', question: null, selectedAnswers: new Set(), result: null,
    session: { mode: 'select-all', length: 10, questionNumber: 0, totalScore: 0, results: [] }
  },
  settings: {
    paletteTheme: 'classic',
    appearance: 'system',
    developer: { autoUpdateOnLaunch: false, showOverlay: false },
    quiz: { defaultMode: 'select-all', common: {}, modes: { 'select-all': { questionCount: 10 } } }
  },
  study: {
    mode: 'pokemon', primaryType: 'fire', secondaryType: null,
    pokemonQuery: '', pokemonStatus: 'idle', pokemonResult: null, pokemonSource: null, pokemonError: null
  },
  progress: emptyProgress(),
  cache: { pokemon: {}, pokemonNameIndex: null }
};

export function getQuizModeSettings(modeId = state.quiz.mode) {
  if (!state.settings.quiz.modes[modeId]) state.settings.quiz.modes[modeId] = { questionCount: 10 };
  return state.settings.quiz.modes[modeId];
}

export function hydratePersistentState(persistentData) {
  state.settings = {
    ...state.settings,
    ...persistentData.settings,
    developer: { ...state.settings.developer, ...persistentData.settings.developer },
    quiz: {
      ...state.settings.quiz,
      ...persistentData.settings.quiz,
      common: { ...persistentData.settings.quiz.common },
      modes: structuredClone(persistentData.settings.quiz.modes)
    }
  };
  state.progress = {
    ...emptyProgress(),
    ...persistentData.progress,
    relationshipStats: structuredClone(persistentData.progress.relationshipStats ?? {}),
    pokemonRecognitionStats: structuredClone(persistentData.progress.pokemonRecognitionStats ?? {})
  };
  state.cache = { ...state.cache, ...persistentData.cache };
  state.quiz.mode = state.settings.quiz.defaultMode;
  const modeSettings = getQuizModeSettings(state.quiz.mode);
  state.quiz.session.mode = state.quiz.mode;
  state.quiz.session.length = modeSettings.questionCount;
}

export function getPersistentSnapshot() {
  return {
    settings: {
      paletteTheme: state.settings.paletteTheme,
      appearance: state.settings.appearance,
      developer: { ...state.settings.developer },
      quiz: {
        defaultMode: state.settings.quiz.defaultMode,
        common: { ...state.settings.quiz.common },
        modes: structuredClone(state.settings.quiz.modes)
      }
    },
    progress: {
      ...state.progress,
      relationshipStats: structuredClone(state.progress.relationshipStats),
      pokemonRecognitionStats: structuredClone(state.progress.pokemonRecognitionStats)
    },
    cache: {
      pokemon: { ...state.cache.pokemon },
      pokemonNameIndex: state.cache.pokemonNameIndex ? structuredClone(state.cache.pokemonNameIndex) : null
    }
  };
}

export function resetProgress() { state.progress = emptyProgress(); }
export function resetQuestionState() { state.quiz.selectedAnswers = new Set(); state.quiz.result = null; state.quiz.question = null; }

export function startQuizSession(length = getQuizModeSettings().questionCount) {
  const modeSettings = getQuizModeSettings();
  modeSettings.questionCount = length;
  state.settings.quiz.defaultMode = state.quiz.mode;
  state.quiz.status = 'answering';
  state.quiz.session = { mode: state.quiz.mode, length, questionNumber: 1, totalScore: 0, results: [] };
  resetQuestionState();
}

function recordRelationshipOutcome(outcome, timestamp) {
  const relationship = parseRelationshipKey(outcome.key);
  const existing = state.progress.relationshipStats[relationship.key] ?? {
    attackingType: relationship.attackingType, defendingType: relationship.defendingType,
    attempts: 0, earnedScore: 0, correctSelections: 0, misses: 0, falseSelections: 0, lastSeen: null
  };
  existing.attempts += 1;
  existing.earnedScore += outcome.earnedScore;
  existing.lastSeen = timestamp;
  if (outcome.outcome === 'correct') existing.correctSelections += 1;
  if (outcome.outcome === 'missed') existing.misses += 1;
  if (outcome.outcome === 'false-selection') existing.falseSelections += 1;
  state.progress.relationshipStats[relationship.key] = existing;
}

function recordPokemonRecognition(question, result, timestamp) {
  if (question.objectiveId !== 'recognize-pokemon-type') return;
  const pokemonId = Number(question.metadata?.pokemonId);
  if (!Number.isInteger(pokemonId)) return;
  const key = String(pokemonId);
  const existing = state.progress.pokemonRecognitionStats[key] ?? {
    pokemonId,
    pokemonName: question.metadata?.pokemonName ?? `pokemon-${pokemonId}`,
    attempts: 0,
    earnedScore: 0,
    exactAnswers: 0,
    correctSelections: 0,
    misses: 0,
    falseSelections: 0,
    lastSeen: null
  };
  existing.pokemonName = question.metadata?.pokemonName ?? existing.pokemonName;
  existing.attempts += 1;
  existing.earnedScore += result.score;
  if (result.score === 1) existing.exactAnswers += 1;
  existing.correctSelections += result.correctlySelected?.length ?? 0;
  existing.misses += result.missedAnswers?.length ?? 0;
  existing.falseSelections += result.incorrectAnswers?.length ?? 0;
  existing.lastSeen = timestamp;
  state.progress.pokemonRecognitionStats[key] = existing;
}

export function recordQuestionResult(question, result) {
  state.quiz.session.results.push({ questionId: question.id, generatorId: question.generatorId, score: result.score, metadata: question.metadata });
  state.quiz.session.totalScore += result.score;
  state.progress.totalAnswered += 1;
  state.progress.totalScore += result.score;
  const timestamp = new Date().toISOString();
  for (const outcome of result.relationshipOutcomes ?? []) recordRelationshipOutcome(outcome, timestamp);
  recordPokemonRecognition(question, result, timestamp);
}

export function advanceQuizSession() {
  const { length, questionNumber } = state.quiz.session;
  if (length !== 0 && questionNumber >= length) { state.quiz.status = 'complete'; resetQuestionState(); return false; }
  state.quiz.session.questionNumber += 1;
  resetQuestionState();
  state.quiz.status = 'answering';
  return true;
}
export function endQuizSession() { state.quiz.status = 'complete'; resetQuestionState(); }
export function returnToQuizSetup() { state.quiz.status = 'idle'; resetQuestionState(); }
export function getSessionAverageScore() { const count = state.quiz.session.results.length; return count === 0 ? 0 : state.quiz.session.totalScore / count; }
export function getAverageScore() { return state.progress.totalAnswered === 0 ? 0 : state.progress.totalScore / state.progress.totalAnswered; }
