import { state, returnToQuizSetup } from '../state.js';

const observers = new WeakMap();

function addExitButton(root, rerender) {
  if (state.route !== 'quiz' || !['answering', 'answered', 'load-error'].includes(state.quiz.status)) return;
  if (root.querySelector('.quiz-exit-button')) return;

  let actions = root.querySelector('.quiz-body .actions');
  if (!actions) {
    const panel = root.querySelector('.quiz-loading-panel');
    if (!panel) return;
    actions = document.createElement('div');
    actions.className = 'actions';
    panel.append(actions);
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'secondary-button quiz-exit-button';
  button.textContent = 'Exit quiz';
  button.addEventListener('click', () => {
    document.querySelector('.quiz-mnemonic-banner')?.remove();
    returnToQuizSetup();
    rerender();
  });
  actions.append(button);
}

export function enhanceQuizExitControl(root, rerender) {
  if (state.route !== 'quiz') return;

  addExitButton(root, rerender);
  if (observers.has(root)) return;

  const quizBody = root.querySelector('.quiz-body');
  if (!quizBody) return;

  const observer = new MutationObserver(() => addExitButton(root, rerender));
  observer.observe(quizBody, { childList: true, subtree: true });
  observers.set(root, observer);
}
