import { state } from '../state.js';

let initialized = false;
let pendingTarget = null;
let observer = null;

function scrollBehavior() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

function targetElement() {
  if (state.route !== 'quiz') return null;
  if (pendingTarget === 'question' && state.quiz.status === 'answering') {
    return document.querySelector('.quiz-body .session-header');
  }
  if (pendingTarget === 'feedback' && state.quiz.status === 'answered') {
    return document.querySelector('.quiz-body .feedback h4');
  }
  return null;
}

function tryScroll() {
  if (!pendingTarget) return;
  const target = targetElement();
  if (!target) return;
  pendingTarget = null;
  target.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
}

function requestedScroll(buttonText) {
  if (buttonText === 'Submit answer' || buttonText === 'Submit no types') return 'feedback';
  if (buttonText === 'Start quiz' || buttonText === 'Next question' || buttonText === 'Retry' || buttonText === 'Quiz again') return 'question';
  return null;
}

export function initializeQuizAutoScroll() {
  if (initialized) return;
  initialized = true;

  document.addEventListener('click', event => {
    if (state.route !== 'quiz') return;
    const button = event.target.closest('button');
    if (!button) return;
    const target = requestedScroll(button.textContent.trim());
    if (!target) return;
    pendingTarget = target;
    queueMicrotask(tryScroll);
  });

  const root = document.querySelector('#app-view');
  if (!root) return;
  observer = new MutationObserver(tryScroll);
  observer.observe(root, { childList: true, subtree: true });
}
