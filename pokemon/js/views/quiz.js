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

function el(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text) node.textContent = options.text;
  return node;
}

function formatPercent(score) { return `${Math.round(score * 100)}%`; }

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

function buildQuizSetup(refreshQuiz) {
  const panel = el('div', { className: 'panel' });
  panel.append(el('p', { text: 'Choose a quiz type and practice until you finish the session.' }));
  const form = el('div', { className: 'quiz-setup' });
  const modeLabel = el('label');
  modeLabel.append(el('span', { text: 'Quiz type' }));
  const modeSelect = el('select');
  for (const mode of Object.values(QUIZ_MODES)) {
    const option = document.createElement('option');
    option.value = mode.id;
    option.textContent = mode.label;
    option.selected = mode.id === state.quiz.mode;
    modeSelect.append(option);
  }
  modeLabel.append(modeSelect);
  form.append(modeLabel);

  const dualLabel = el('label', { className: 'toggle-field quiz-dual-toggle' });
  const dualCheckbox = document.createElement('input');
  dualCheckbox.type = 'checkbox';
  dualLabel.append(dualCheckbox, el('span', { text: 'Mix in dual-type questions' }));
  const dualNote = el('p', { className: 'muted quiz-dual-note', text: 'When enabled, about one in five questions uses dual types; single-type questions remain mixed in.' });

  function populateModeOptions() {
    const modeSettings = getQuizModeSettings(state.quiz.mode);
    dualCheckbox.checked = modeSettings.mixDualTypes === true;
    const supportsDualMix = state.quiz.mode !== 'pokemon-type-recognition';
    dualLabel.hidden = !supportsDualMix;
    dualNote.hidden = !supportsDualMix;
  }

  populateModeOptions();
  modeSelect.addEventListener('change', () => {
    clearPrefetch();
    state.quiz.mode = modeSelect.value;
    state.settings.quiz.defaultMode = modeSelect.value;
    getQuizModeSettings(modeSelect.value);
    populateModeOptions();
    saveSettings(state.settings);
  });
  dualCheckbox.addEventListener('change', () => {
    getQuizModeSettings(state.quiz.mode).mixDualTypes = dualCheckbox.checked;
    saveSettings(state.settings);
  });
  form.append(dualLabel);
  const start = el('button', { text: 'Start quiz' });
  start.addEventListener('click', () => beginSession(refreshQuiz));
  form.append(start);
  panel.append(form, dualNote);
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
