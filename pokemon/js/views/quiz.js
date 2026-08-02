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

function formatPercent(score) {
  return `${Math.round(score * 100)}%`;
}

function createNextQuestion() {
  state.quiz.question = createQuestionForMode(state.quiz.session.mode);
  state.quiz.selectedAnswers = new Set();
  state.quiz.result = null;
  state.quiz.status = 'answering';
}

function beginSession(length, render) {
  startQuizSession(length);
  saveSettings(state.settings);
  createNextQuestion();
  render();
}

function toggleAnswer(answer, render) {
  if (state.quiz.selectedAnswers.has(answer)) state.quiz.selectedAnswers.delete(answer);
  else state.quiz.selectedAnswers.add(answer);
  render();
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

function renderQuizSetup(page, render) {
  const panel = el('div', { className: 'panel' });
  panel.append(el('p', {
    text: 'This practice preset currently uses one choose-switch question generator and one multi-select answer format.'
  }));

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

  function populateLengthOptions() {
    const modeSettings = getQuizModeSettings(state.quiz.mode);
    lengthSelect.replaceChildren();
    for (const length of lengths) {
      const option = document.createElement('option');
      option.value = String(length);
      option.textContent = length === 0 ? 'Endless' : String(length);
      option.selected = length === modeSettings.questionCount;
      lengthSelect.append(option);
    }
  }

  populateLengthOptions();

  modeSelect.addEventListener('change', () => {
    state.quiz.mode = modeSelect.value;
    state.settings.quiz.defaultMode = modeSelect.value;
    getQuizModeSettings(modeSelect.value);
    populateLengthOptions();
    saveSettings(state.settings);
  });

  lengthSelect.addEventListener('change', () => {
    getQuizModeSettings(state.quiz.mode).questionCount = Number(lengthSelect.value);
    saveSettings(state.settings);
  });

  lengthLabel.append(lengthSelect);
  form.append(lengthLabel);

  const start = el('button', { text: 'Start quiz' });
  start.addEventListener('click', () => beginSession(Number(lengthSelect.value), render));
  form.append(start);

  panel.append(form);
  page.append(panel);
}

function renderSessionHeader(page) {
  const session = state.quiz.session;
  const header = el('div', { className: 'session-header' });
  const questionLabel = session.length === 0
    ? `Question ${session.questionNumber}`
    : `Question ${session.questionNumber} of ${session.length}`;
  header.append(el('span', { text: questionLabel }));
  header.append(el('span', { text: `Session average: ${formatPercent(getSessionAverageScore())}` }));
  page.append(header);
}

function renderActiveQuestion(page, render) {
  renderSessionHeader(page);

  const question = state.quiz.question;
  const panel = el('div', { className: 'panel' });
  panel.append(el('h3', { text: question.prompt }));
  panel.append(renderAnswerDisplay(question.answerType, {
    question,
    selectedAnswers: state.quiz.selectedAnswers,
    result: state.quiz.result,
    onToggle: answer => toggleAnswer(answer, render)
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
      render();
    });
    actions.append(submit);
  } else {
    const isLast = state.quiz.session.length !== 0
      && state.quiz.session.questionNumber >= state.quiz.session.length;
    const next = el('button', { text: isLast ? 'See summary' : 'Next question' });
    next.addEventListener('click', () => {
      if (advanceQuizSession()) createNextQuestion();
      render();
    });
    actions.append(next);
  }

  if (state.quiz.session.length === 0) {
    const end = el('button', { className: 'secondary-button', text: 'End session' });
    end.addEventListener('click', () => {
      endQuizSession();
      render();
    });
    actions.append(end);
  }

  panel.append(actions);
  page.append(panel);
}

function renderSessionSummary(page, render) {
  const panel = el('div', { className: 'panel summary-panel' });
  panel.append(el('h3', { text: 'Session complete' }));
  panel.append(el('p', { text: `Questions answered: ${state.quiz.session.results.length}` }));
  panel.append(el('p', {
    className: 'summary-score',
    text: `Average score: ${formatPercent(getSessionAverageScore())}`
  }));

  const actions = el('div', { className: 'actions' });
  const again = el('button', { text: 'Quiz again' });
  again.addEventListener('click', () => beginSession(state.quiz.session.length, render));
  const setup = el('button', { className: 'secondary-button', text: 'Change setup' });
  setup.addEventListener('click', () => {
    returnToQuizSetup();
    render();
  });
  actions.append(again, setup);
  panel.append(actions);
  page.append(panel);
}

export function renderQuiz(container, render) {
  const page = el('section', { className: 'page' });
  page.append(el('h2', { text: 'Quiz' }));

  if (state.quiz.status === 'idle') renderQuizSetup(page, render);
  else if (state.quiz.status === 'complete') renderSessionSummary(page, render);
  else renderActiveQuestion(page, render);

  container.replaceChildren(page);
}
