import { parseRelationshipKey } from './relationships.js';

function emptyProgress() {
  return { quizStats: {}, relationshipStats: {}, pokemonRecognitionStats: {} };
}

function defaultTeams() {
  return [
    { id: 'my-team', title: 'My team', pokemon: [] },
    { id: 'opponents', title: 'Opponents', pokemon: [] }
  ];
}

export const state = {
  route: 'quiz',
  routeParams: {},
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
  teams: defaultTeams(),
  progress: emptyProgress(),
  cache: { pokemon: {}, pokemonNameIndex: null, recentPokemonIds: [] }
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
  state.cache = {
    ...state.cache,
    ...persistentData.cache,
    recentPokemonIds: [...(persistentData.cache.recentPokemonIds ?? [])]
  };
  state.teams = structuredClone(persistentData.teams ?? defaultTeams());
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
      pokemonNameIndex: state.cache.pokemonNameIndex ? structuredClone(state.cache.pokemonNameIndex) : null,
      recentPokemonIds: [...state.cache.recentPokemonIds]
    },
    teams: structuredClone(state.teams)
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
  const pokemonId = Number(question?.pokemon?.id);
  if (!Number.isInteger(pokemonId) || pokemonId < 1) return;
  const key = String(pokemonId);
  const existing = state.progress.pokemonRecognitionStats[key] ?? {
    pokemonId,
    pokemonName: question.pokemon.name,
    attempts: 0,
    earnedScore: 0,
    exactAnswers: 0,
    correctSelections: 0,
    misses: 0,
    falseSelections: 0,
    lastSeen: null
  };
  existing.attempts += 1;
  existing.earnedScore += result.score;
  if (result.score === 1) existing.exactAnswers += 1;
  existing.correctSelections += result.correctSelections.length;
  existing.misses += result.missedAnswers.length;
  existing.falseSelections += result.falseSelections.length;
  existing.lastSeen = timestamp;
  state.progress.pokemonRecognitionStats[key] = existing;
}

export function recordQuizResult(question, result) {
  const timestamp = new Date().toISOString();
  state.quiz.session.results.push({ question, result, timestamp });
  state.quiz.session.totalScore += result.score;
  const modeStats = state.progress.quizStats[state.quiz.mode] ?? { questionCount: 0, totalScore: 0 };
  modeStats.questionCount += 1;
  modeStats.totalScore += result.score;
  state.progress.quizStats[state.quiz.mode] = modeStats;
  for (const outcome of result.relationshipOutcomes ?? []) recordRelationshipOutcome(outcome, timestamp);
  if (question?.pokemon) recordPokemonRecognition(question, result, timestamp);
}

export function nextQuizQuestion() {
  state.quiz.session.questionNumber += 1;
  resetQuestionState();
}
