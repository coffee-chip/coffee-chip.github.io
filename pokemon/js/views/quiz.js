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
import { createTypeList } from '../components/typeBadge.js';

function el(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text) node.textContent = options.text;
  return node;
}

function formatPercent(score) { return `${Math.round(score * 100)}%`; }

function createNextQuestion() {
  const modeSettings = getQuizModeSettings(state.quiz.session.mode);
  state.quiz.question = createQuestionForMode(state.quiz.session.mode, {
    mixDualTypes: modeSettings.mixDualTypes === true
  });
  state.quiz.selectedAnswers = new Set();
  state.quiz.result = null;
  state.quiz.status = 'answering';
}

function beginSession(length) {
  startQuizSession(length);
  saveSettings(state.settings);
  createNextQuestion();
}

function toggleAnswer(answer) {
  if (state.quiz.selectedAnswers.has(answer)) state.quiz.selectedAnswers.delete(answer);
  else state.quiz.selectedAnswers.add(answer);
}

function feedbackRow(label, types) {
  const row = el('div', { className: 'feedback-row' });
  row.append(el('strong', { text: label }));
  row.append(createTypeList(types));
  return row;
}

function renderFeedback(result, question) {
  const feedback = el('div', { className: 'feedback' });
  feedback.append(el('h4', { text: `Question score: ${formatPercent(result.score)}` }));
  feedback.append(feedbackRow('Correctly selected', result.correctlySelected));
  feedback.append(feedbackRow('Missed', result.missedAnswers));
  feedback.append(feedbackRow('Incorrectly selected', result.incorrectAnswers));
  feedback.append(el('p', { className: 'muted', text: question.explanation }));
  return feedback;
}

function buildQuizSetup(refreshQuiz) {
  const panel = el('div', { className: 'panel' });
  panel.append(el('p', { text: 'Choose a practice preset and session length. Each preset remembers its own setup.' }));
  const form = el('div', { className: 'quiz-setup' });

  const modeLabel = el('label');
  modeLabel.append(el('span', { text: 'Practice preset' }));
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

  const lengthLabel = el('label');
  lengthLabel.append(el('span', { text: 'Questions' }));
  const lengthSelect = el('select');
  const lengths = [5, 10, 20, 0];

  const dualLabel = el('label', { className: 'toggle-field quiz-dual-toggle' });
  const dualCheckbox = document.createElement('input');
  dualCheckbox.type = 'checkbox';
  const dualText = el('span', { text: 'Mix in dual-type questions' });
  dualLabel.append(dualCheckbox, dualText);

  function populateModeOptions() {
    const modeSettings = getQuizModeSettings(state.quiz.mode);
    lengthSelect.replaceChildren();
    for (const length of lengths) {
      const option = document.createElement('option');
      option.value = String(length);
      option.textContent = length === 0 ? 'Endless' : String(length);
      option.selected = length === modeSettings.questionCount;
      lengthSelect.append(option);
    }
    dualCheckbox.checked = modeSettings.mixDualTypes === true;
  }

  populateModeOptions();

  modeSelect.addEventListener('change', () => {
    state.quiz.mode = modeSelect.value;
    state.settings.quiz.defaultMode = modeSelect.value;
    getQuizModeSettings(modeSelect.value);
    populateModeOptions();
    saveSettings(state.settings);
  });

  lengthSelect.addEventListener('change', () => {
    getQuizModeSettings(state.quiz.mode).questionCount = Number(lengthSelect.value);
    saveSettings(state.settings);
  });

  dualCheckbox.addEventListener('change', () => {
    getQuizModeSettings(state.quiz.mode).mixDualTypes = dualCheckbox.checked;
    saveSettings(state.settings);
  });

  lengthLabel.append(lengthSelect);
  form.append(lengthLabel, dualLabel);

  const start = el('button', { text: 'Start quiz' });
  start.addEventListener('click', () => {
    beginSession(Number(lengthSelect.value));
    refreshQuiz();
  });
  form.append(start);
  panel.append(form);
  panel.append(el('p', { className: 'muted', text: 'When enabled, about one-third of questions use dual types; single-type questions remain mixed in.' }));
  return panel;
}

function buildSessionHeader() {
  const session = state.quiz.session;
  const header = el('div', { className: 'session-header' });
  const questionLabel = session.length === 0 ? `Question ${session.questionNumber}` : `Question ${session.questionNumber} of ${session.length}`;
  header.append(el('span', { text: questionLabel }));
  header.append(el('span', { text: `Session average: ${formatPercent(getSessionAverageScore())}` }));
  return header;
}

function buildActiveQuestion(refreshQuiz) {
  const fragment = document.createDocumentFragment();
  fragment.append(buildSessionHeader());
  const question = state.quiz.question;
  const panel = el('div', { className: 'panel' });
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
    const submit = el('button', { text: 'Submit answer' });
    submit.disabled = state.quiz.selectedAnswers.size === 0;
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
    const isLast = state.quiz.session.length !== 0 && state.quiz.session.questionNumber >= state.quiz.session.length;
    const next = el('button', { text: isLast ? 'See summary' : 'Next question' });
    next.addEventListener('click', () => { if (advanceQuizSession()) createNextQuestion(); refreshQuiz(); });
    actions.append(next);
  }
  if (state.quiz.session.length === 0) {
    const end = el('button', { className: 'secondary-button', text: 'End session' });
    end.addEventListener('click', () => { endQuizSession(); refreshQuiz(); });
    actions.append(end);
  }
  panel.append(actions);
  fragment.append(panel);
  return fragment;
}

function buildSessionSummary(refreshQuiz) {
  const panel = el('div', { className: 'panel summary-panel' });
  panel.append(el('h3', { text: 'Session complete' }));
  panel.append(el('p', { text: `Questions answered: ${state.quiz.session.results.length}` }));
  panel.append(el('p', { className: 'summary-score', text: `Average score: ${formatPercent(getSessionAverageScore())}` }));
  const actions = el('div', { className: 'actions' });
  const again = el('button', { text: 'Quiz again' });
  again.addEventListener('click', () => { beginSession(state.quiz.session.length); refreshQuiz(); });
  const setup = el('button', { className: 'secondary-button', text: 'Change setup' });
  setup.addEventListener('click', () => { returnToQuizSetup(); refreshQuiz(); });
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
    else quizBody.replaceChildren(buildActiveQuestion(refreshQuiz));
  }
  refreshQuiz();
  container.replaceChildren(page);
}
