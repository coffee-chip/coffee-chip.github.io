import { state, returnToQuizSetup } from '../state.js';

export function enhanceQuizExitControl(root, rerender) {
  if (state.route !== 'quiz' || !['answering', 'answered', 'load-error'].includes(state.quiz.status)) return;
  const header = root.querySelector('.session-header');
  if (!header || header.querySelector('.quiz-exit-button')) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'secondary-button quiz-exit-button';
  button.textContent = 'Exit quiz';
  button.addEventListener('click', () => {
    document.querySelector('.quiz-mnemonic-banner')?.remove();
    returnToQuizSetup();
    rerender();
  });
  header.append(button);
}
