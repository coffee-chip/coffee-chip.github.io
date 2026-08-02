import { createTypeBadge } from '../components/typeBadge.js';

function el(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text) node.textContent = options.text;
  return node;
}

export function renderTypeMultiSelect({ question, selectedAnswers, result, onToggle }) {
  const grid = el('div', { className: 'type-grid' });

  for (const type of question.choices) {
    const button = el('button', { className: 'type-button' });
    button.append(createTypeBadge(type));
    button.type = 'button';
    button.dataset.answer = type;
    button.setAttribute('aria-pressed', String(selectedAnswers.has(type)));

    if (result) {
      if (result.correctlySelected.includes(type)) button.classList.add('correct');
      else if (result.missedAnswers.includes(type)) button.classList.add('missed');
      else if (result.incorrectAnswers.includes(type)) button.classList.add('incorrect');
      button.disabled = true;
    } else {
      button.addEventListener('click', () => onToggle(type));
    }

    grid.append(button);
  }

  return grid;
}

export const ANSWER_DISPLAYS = {
  'type-multi-select': renderTypeMultiSelect
};

export function renderAnswerDisplay(answerType, context) {
  const renderer = ANSWER_DISPLAYS[answerType];
  if (!renderer) throw new Error(`No display for answer type: ${answerType}`);
  return renderer(context);
}
