import { parseRelationshipKey } from './relationships.js';

function emptyProgress() {
  return { quizStats: {}, relationshipStats: {}, pokemonRecognitionStats: {} };
}

export const state = {
  route: 'quiz',
  quiz: {
    mode: 'choose-switch', status: 'idle', question: null, selectedAnswers: new Set(), result: null,
    session: { mode: 'choose-switch', questionNumber: 0, totalScore: 0, results: [] }
  },
  settings: {
    paletteTheme: 'classic',
    appearance: 'system',
    developer: { autoUpdateOnLaunch: false, showOverlay: false, showErrorOverlay: false },
    quiz: { defaultMode: 'choose-switch', modes: { 'choose-switch': {} } }
  },
  study: {
    mode: 'pokemon', primaryType: 'fire', secondaryType: null,
    pokemonQuery: '', pokemonStatus: 'idle', pokemonResult: null, pokemonSource: null, pokemonError: null
  },
  progress: emptyProgress(),
  cache: { pokemon: {}, pokemonNameIndex: null }
};

export function getQuizModeSettings(modeId = state.quiz.mode) {
  if (!state.settings.quiz.modes[modeId]) state.settings.quiz.modes[modeId] = {};
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
      modes: structuredClone(persistentData.settings.quiz.modes)
    }
  };
  state.progress = {
    ...emptyProgress(),
    ...persistentData.progress,
    quizStats: structuredClone(persistentData.progress.quizStats ?? {}),
    relationshipStats: structuredClone(persistentData.progress.relationshipStats ?? {}),
    pokemonRecognitionStats: structuredClone(persistentData.progress.pokemonRecognitionStats ?? {})
  };
  state.cache = { ...state.cache, ...persistentData.cache };
  state.quiz.mode = state.settings.quiz.defaultMode;
  getQuizModeSettings(state.quiz.mode);
  state.quiz.session.mode = state.quiz.mode;
}

export function getPersistentSnapshot() {
  return {
    settings: {
      paletteTheme: state.settings.paletteTheme,
      appearance: state.settings.appearance,
      developer: { ...state.settings.developer },
      quiz: {
        defaultMode: state.settings.quiz.defaultMode,
        modes: structuredClone(state.settings.quiz.modes)
      }
    },
    progress: {
      ...state.progress,
      quizStats: structuredClone(state.progress.quizStats),
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

export function startQuizSession() {
  state.settings.quiz.defaultMode = state.quiz.mode;
  state.quiz.status = 'answering';
  state.quiz.session = { mode: state.quiz.mode, questionNumber: 1, totalScore: 0, results: [] };
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

function recordQuizStat(modeId, score) {
  const existing = state.progress.quizStats[modeId] ?? { questionCount: 0, totalScore: 0 };
  existing.questionCount += 1;
  existing.totalScore += score;
  state.progress.quizStats[modeId] = existing;
}

export function recordQuestionResult(question, result) {
  state.quiz.session.results.push({ questionId: question.id, generatorId: question.generatorId, score: result.score, metadata: question.metadata });
  state.quiz.session.totalScore += result.score;
  recordQuizStat(state.quiz.session.mode, result.score);
  const timestamp = new Date().toISOString();
  for (const outcome of result.relationshipOutcomes ?? []) recordRelationshipOutcome(outcome, timestamp);
  recordPokemonRecognition(question, result, timestamp);
}

export function advanceQuizSession() {
  state.quiz.session.questionNumber += 1;
  resetQuestionState();
  state.quiz.status = 'answering';
}
export function endQuizSession() { state.quiz.status = 'complete'; resetQuestionState(); }
export function returnToQuizSetup() { state.quiz.status = 'idle'; resetQuestionState(); }
export function getSessionAverageScore() { const count = state.quiz.session.results.length; return count === 0 ? 0 : state.quiz.session.totalScore / count; }
