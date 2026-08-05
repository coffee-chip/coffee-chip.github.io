import {
  state,
  getQuizModeSettings,
  startQuizSession,
  recordQuestionResult,
  advanceQuizSession,
  endQuizSession,
  returnToQuizSetup,
  getSessionAverageScore
} from '../state.js';
import { saveSettings, saveProgress } from '../storage.js';
import { createQuestionForMode, QUIZ_MODES } from '../quiz/modes.js';
import { POKEMON_POOLS, SAMPLING_STRATEGIES } from '../quiz/generators.js';
import { scoreQuestion } from '../quiz/scoring.js';
import { renderAnswerDisplay } from '../quiz/displays.js';
import { createTypeBadge } from '../components/typeBadge.js';
import { createMnemonicTypeBadge } from '../components/mnemonicBadge.js';
import { parseRelationshipKey } from '../relationships.js';

let questionLoadError = '';
let questionLoadToken = 0;
let prefetchedQuestion = null;
let prefetchPromise = null;
let prefetchMode = null;
let prefetchSessionToken = 0;

const EFFECTIVENESS_OPTIONS = {
  'choose-switch': [
    { id: 'weak', label: 'Weak' },
    { id: 'resistant', label: 'Resistant or immune' },
    { id: 'both', label: 'Both' }
  ],
  'choose-move': [
    { id: 'more', label: 'More effective' },
    { id: 'less', label: 'Resisted or immune' },
    { id: 'both', label: 'Both' }
  ]
};

function el(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text) node.textContent = options.text;
  return node;
}

function formatPercent(score) { return `${Math.round(score * 100)}%`; }

function createSelect(options, value) {
  const select = document.createElement('select');
  for (const definition of options) {
    const option = document.createElement('option');
    option.value = definition.id;
    option.textContent = definition.label;
    option.selected = definition.id === value;
    select.append(option);
  }
  return select;
}

function createField(labelText, control, className = '') {
  const label = el('label', { className });
  label.append(el('span', { text: labelText }), control);
  return label;
}

function questionOptions(modeId) {
  const modeSettings = getQuizModeSettings(modeId);
  return { mixDualTypes: modeSettings.mixDualTypes === true };
}

function clearPrefetch() {
  prefetchedQuestion = null;
  prefetchPromise = null;
  prefetchMode = null;
  prefetchSessionToken += 1;
}

function finishSession(refreshQuiz) {
  questionLoadToken += 1;
  clearPrefetch();
  dismissFeedbackMnemonic();
  endQuizSession();
  refreshQuiz();
}

function createFinishButton(refreshQuiz) {
  const finish = el('button', { className: 'secondary-button', text: 'Finish session' });
  finish.type = 'button';
  finish.addEventListener('click', () => finishSession(refreshQuiz));
  return finish;
}

function startQuestionPrefetch() {
  if (prefetchPromise || prefetchedQuestion) return;
  const modeId = state.quiz.session.mode;
  const sessionToken = prefetchSessionToken;
  prefetchMode = modeId;
  prefetchPromise = Promise.resolve(createQuestionForMode(modeId, questionOptions(modeId)))
    .then(question => {
      if (sessionToken !== prefetchSessionToken || prefetchMode !== modeId) return null;
      prefetchedQuestion = question;
      return question;
    })
    .catch(error => {
      console.warn('Could not prefetch the next quiz question.', error);
      return null;
    })
    .finally(() => {
      if (sessionToken === prefetchSessionToken) prefetchPromise = null;
    });
}

async function consumePrefetchedQuestion(modeId) {
  if (prefetchMode !== modeId) return null;
  if (prefetchedQuestion) {
    const question = prefetchedQuestion;
    prefetchedQuestion = null;
    prefetchMode = null;
    return question;
  }
  if (!prefetchPromise) return null;
  const question = await prefetchPromise;
  if (!question || prefetchMode !== modeId) return null;
  prefetchedQuestion = null;
  prefetchMode = null;
  return question;
}

async function createNextQuestion(refreshQuiz, { usePrefetch = false } = {}) {
  const token = ++questionLoadToken;
  const modeId = state.quiz.session.mode;
  state.quiz.question = null;
  state.quiz.selectedAnswers = new Set();
  state.quiz.result = null;
  state.quiz.status = 'loading';
  questionLoadError = '';
  refreshQuiz();
  try {
    let question = usePrefetch ? await consumePrefetchedQuestion(modeId) : null;
    if (!question) question = await createQuestionForMode(modeId, questionOptions(modeId));
    if (token !== questionLoadToken) return;
    state.quiz.question = question;
    state.quiz.status = 'answering';
    startQuestionPrefetch();
  } catch (error) {
    if (token !== questionLoadToken) return;
    questionLoadError = error?.message ?? 'Could not load the next question.';
    state.quiz.status = 'load-error';
  }
  refreshQuiz();
}

function beginSession(refreshQuiz) {
  clearPrefetch();
  startQuizSession();
  saveSettings(state.settings);
  createNextQuestion(refreshQuiz);
}

function toggleAnswer(answer) {
  if (state.quiz.selectedAnswers.has(answer)) state.quiz.selectedAnswers.delete(answer);
  else state.quiz.selectedAnswers.add(answer);
}

function dismissFeedbackMnemonic() {
  document.querySelector('.quiz-mnemonic-banner')?.remove();
  for (const button of document.querySelectorAll('.feedback .mnemonic-type-badge[aria-pressed="true"]')) button.setAttribute('aria-pressed', 'false');
}

function showFeedbackMnemonic({ mnemonics, button }) {
  if (button.getAttribute('aria-pressed') === 'true') { dismissFeedbackMnemonic(); return; }
  dismissFeedbackMnemonic();
  button.setAttribute('aria-pressed', 'true');
  const banner = el('button', { className: 'mnemonic-banner quiz-mnemonic-banner' });
  banner.type = 'button';
  banner.setAttribute('aria-label', 'Dismiss mnemonic');
  banner.append(el('strong', { text: mnemonics.length === 1 ? 'Mnemonic' : 'Mnemonics' }));
  for (const mnemonic of mnemonics) {
    const relationship = parseRelationshipKey(mnemonic.relationshipKey);
    const line = el('span', { className: 'mnemonic-banner-line' });
    line.append(createTypeBadge(relationship.attackingType));
    line.append(el('span', { className: 'relationship-arrow', text: '→' }));
    line.append(createTypeBadge(relationship.defendingType));
    line.append(el('span', { className: 'mnemonic-text', text: mnemonic.text }));
    banner.append(line);
  }
  banner.append(el('span', { className: 'mnemonic-dismiss-hint', text: 'Tap to dismiss' }));
  banner.addEventListener('click', dismissFeedbackMnemonic);
  document.body.append(banner);
}

function relationshipKeysForType(question, type) {
  return (question.relationships ?? []).filter(relationship => relationship.answer === type).map(relationship => relationship.key);
}

function feedbackRow(label, types, question) {
  const row = el('div', { className: 'feedback-row' });
  row.append(el('strong', { text: `${label}: ` }));
  const list = el('span', { className: 'type-badge-list' });
  if (!types.length) list.textContent = 'None';
  else for (const type of types) list.append(createMnemonicTypeBadge(type, relationshipKeysForType(question, type), showFeedbackMnemonic));
  row.append(list);
  return row;
}

function renderFeedback(result, question) {
  const feedback = el('div', { className: 'feedback' });
  feedback.append(el('h4', { text: `Question score: ${formatPercent(result.score)}` }));
  feedback.append(feedbackRow('Correctly selected', result.correctlySelected, question));
  feedback.append(feedbackRow('Missed', result.missedAnswers, question));
  feedback.append(feedbackRow('Incorrectly selected', result.incorrectAnswers, question));
  return feedback;
}

function selectQuizMode(modeId, refreshQuiz) {
  if (state.quiz.mode === modeId) return;
  clearPrefetch();
  state.quiz.mode = modeId;
  state.settings.quiz.defaultMode = modeId;
  getQuizModeSettings(modeId);
  saveSettings(state.settings);
  refreshQuiz();
}

function buildQuizTypeSelector(refreshQuiz) {
  const fieldset = el('fieldset', { className: 'selector-field quiz-type-field' });
  fieldset.append(el('legend', { text: 'Quiz type' }));
  const selector = el('div', { className: 'button-selector button-selector-grid quiz-type-selector' });
  selector.setAttribute('role', 'radiogroup');
  selector.setAttribute('aria-label', 'Quiz type');

  for (const mode of Object.values(QUIZ_MODES)) {
    const button = el('button', { className: 'button-selector-option', text: mode.label });
    button.type = 'button';
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-checked', String(mode.id === state.quiz.mode));
    button.addEventListener('click', () => selectQuizMode(mode.id, refreshQuiz));
    selector.append(button);
  }

  fieldset.append(selector);
  return fieldset;
}

function buildRecognitionFields() {
  const fragment = document.createDocumentFragment();
  const settings = getQuizModeSettings('pokemon-type-recognition');
  settings.pokemonPool ??= 'gen-1';
  settings.samplingStrategy ??= 'adaptive';

  const poolSelect = createSelect(Object.values(POKEMON_POOLS), settings.pokemonPool);
  poolSelect.addEventListener('change', () => {
    settings.pokemonPool = poolSelect.value;
    saveSettings(state.settings);
  });

  const samplingSelect = createSelect(Object.values(SAMPLING_STRATEGIES), settings.samplingStrategy);
  samplingSelect.addEventListener('change', () => {
    settings.samplingStrategy = samplingSelect.value;
    saveSettings(state.settings);
  });

  fragment.append(
    createField('Pokémon pool', poolSelect, 'quiz-recognition-pool'),
    createField('Sampling', samplingSelect, 'quiz-sampling-setting')
  );
  return fragment;
}

function buildMatchupFields(modeId) {
  const fragment = document.createDocumentFragment();
  const settings = getQuizModeSettings(modeId);
  settings.samplingStrategy ??= 'adaptive';

  if (modeId === 'choose-switch' || modeId === 'choose-move') {
    settings.effectiveness ??= 'both';
    const effectivenessSelect = createSelect(EFFECTIVENESS_OPTIONS[modeId], settings.effectiveness);
    effectivenessSelect.addEventListener('change', () => {
      settings.effectiveness = effectivenessSelect.value;
      saveSettings(state.settings);
    });
    fragment.append(createField('Effectiveness', effectivenessSelect, 'quiz-effectiveness-setting'));
  }

  const samplingSelect = createSelect(Object.values(SAMPLING_STRATEGIES), settings.samplingStrategy);
  samplingSelect.addEventListener('change', () => {
    settings.samplingStrategy = samplingSelect.value;
    saveSettings(state.settings);
  });
  fragment.append(createField('Sampling', samplingSelect, 'quiz-sampling-setting'));

  const dualLabel = el('label', { className: 'toggle-field quiz-dual-toggle' });
  const dualCheckbox = document.createElement('input');
  dualCheckbox.type = 'checkbox';
  dualCheckbox.checked = settings.mixDualTypes === true;
  dualCheckbox.addEventListener('change', () => {
    settings.mixDualTypes = dualCheckbox.checked;
    saveSettings(state.settings);
  });
  dualLabel.append(dualCheckbox, el('span', { text: 'Mix in dual-type questions' }));
  fragment.append(dualLabel);
  return fragment;
}

function buildQuizSetup(refreshQuiz) {
  const panel = el('div', { className: 'panel quiz-setup-panel' });
  const form = el('div', { className: 'quiz-setup' });

  form.append(buildQuizTypeSelector(refreshQuiz));
  if (state.quiz.mode === 'pokemon-type-recognition') form.append(buildRecognitionFields());
  else form.append(buildMatchupFields(state.quiz.mode));

  const startArea = el('div', { className: 'quiz-start-area' });
  startArea.append(el('p', { className: 'muted', text: 'Practice for as long as you want; you can end the quiz at any time.' }));
  const start = el('button', { text: 'Start quiz' });
  start.type = 'button';
  start.addEventListener('click', () => beginSession(refreshQuiz));
  startArea.append(start);
  form.append(startArea);
  panel.append(form);
  return panel;
}

function buildSessionHeader() {
  const session = state.quiz.session;
  const header = el('div', { className: 'session-header' });
  header.append(el('span', { text: `Question ${session.questionNumber}` }));
  header.append(el('span', { text: `Session average: ${formatPercent(getSessionAverageScore())}` }));
  return header;
}

function buildQuestionDisplay(question) {
  if (question.display?.kind !== 'pokemon') return null;
  const figure = el('figure', { className: 'quiz-pokemon-display' });
  if (question.display.pokemon.spriteUrl) {
    const image = document.createElement('img');
    image.src = question.display.pokemon.spriteUrl;
    image.alt = question.display.pokemon.displayName;
    figure.append(image);
  }
  return figure;
}

function buildLoadingQuestion(refreshQuiz) {
  const fragment = document.createDocumentFragment();
  fragment.append(buildSessionHeader());
  const panel = el('div', { className: 'panel quiz-loading-panel' });
  panel.append(el('p', { text: 'Loading question…' }));
  const actions = el('div', { className: 'actions' });
  actions.append(createFinishButton(refreshQuiz));
  panel.append(actions);
  fragment.append(panel);
  return fragment;
}

function buildLoadError(refreshQuiz) {
  const fragment = document.createDocumentFragment();
  fragment.append(buildSessionHeader());
  const panel = el('div', { className: 'panel quiz-loading-panel' });
  panel.append(el('p', { className: 'settings-status error', text: questionLoadError }));
  const actions = el('div', { className: 'actions' });
  const retry = el('button', { text: 'Retry' });
  retry.addEventListener('click', () => createNextQuestion(refreshQuiz));
  actions.append(retry, createFinishButton(refreshQuiz));
  panel.append(actions);
  fragment.append(panel);
  return fragment;
}

function buildActiveQuestion(refreshQuiz) {
  dismissFeedbackMnemonic();
  const fragment = document.createDocumentFragment();
  fragment.append(buildSessionHeader());
  const question = state.quiz.question;
  const panel = el('div', { className: 'panel' });
  const display = buildQuestionDisplay(question);
  if (display) panel.append(display);
  panel.append(el('h3', { text: question.prompt }));
  panel.append(renderAnswerDisplay(question.answerType, {
    question,
    selectedAnswers: state.quiz.selectedAnswers,
    result: state.quiz.result,
    onToggle: answer => { toggleAnswer(answer); refreshQuiz(); }
  }));
  if (state.quiz.result) panel.append(renderFeedback(state.quiz.result, question));
  const actions = el('div', { className: 'actions' });
  if (!state.quiz.result) {
    const submit = el('button', { text: state.quiz.selectedAnswers.size === 0 ? 'Submit no types' : 'Submit answer' });
    submit.addEventListener('click', () => {
      const result = scoreQuestion(question, state.quiz.selectedAnswers);
      state.quiz.result = result;
      state.quiz.status = 'answered';
      recordQuestionResult(question, result);
      saveProgress(state.progress);
      refreshQuiz();
    });
    actions.append(submit);
  } else {
    const next = el('button', { text: 'Next question' });
    next.addEventListener('click', () => {
      advanceQuizSession();
      createNextQuestion(refreshQuiz, { usePrefetch: true });
    });
    actions.append(next);
  }
  actions.append(createFinishButton(refreshQuiz));
  panel.append(actions);
  fragment.append(panel);
  return fragment;
}

function buildSessionSummary(refreshQuiz) {
  dismissFeedbackMnemonic();
  const panel = el('div', { className: 'panel summary-panel' });
  panel.append(el('h3', { text: 'Session complete' }));
  panel.append(el('p', { text: `Questions answered: ${state.quiz.session.results.length}` }));
  panel.append(el('p', { className: 'summary-score', text: `Average score: ${formatPercent(getSessionAverageScore())}` }));
  const actions = el('div', { className: 'actions' });
  const again = el('button', { text: 'Quiz again' });
  again.addEventListener('click', () => beginSession(refreshQuiz));
  const setup = el('button', { className: 'secondary-button', text: 'Change setup' });
  setup.addEventListener('click', () => {
    questionLoadToken += 1;
    clearPrefetch();
    returnToQuizSetup();
    refreshQuiz();
  });
  actions.append(again, setup);
  panel.append(actions);
  return panel;
}

export function renderQuiz(container) {
  const page = el('section', { className: 'page' });
  page.append(el('h2', { text: 'Quiz' }));
  const quizBody = el('div', { className: 'quiz-body' });
  page.append(quizBody);
  function refreshQuiz() {
    if (state.quiz.status === 'idle') quizBody.replaceChildren(buildQuizSetup(refreshQuiz));
    else if (state.quiz.status === 'complete') quizBody.replaceChildren(buildSessionSummary(refreshQuiz));
    else if (state.quiz.status === 'loading') quizBody.replaceChildren(buildLoadingQuestion(refreshQuiz));
    else if (state.quiz.status === 'load-error') quizBody.replaceChildren(buildLoadError(refreshQuiz));
    else quizBody.replaceChildren(buildActiveQuestion(refreshQuiz));
  }
  refreshQuiz();
  container.replaceChildren(page);
}
