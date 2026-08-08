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

export function renderSingleSelect({ question, selectedAnswers, result, onToggle }) {
  const grid = el('div', { className: 'quiz-pokemon-choice-grid' });

  for (const answer of question.choices) {
    const pokemon = question.choicePokemon?.[answer];
    const button = el('button', { className: 'secondary-button quiz-pokemon-choice' });
    button.type = 'button';
    button.dataset.answer = answer;
    button.setAttribute('aria-pressed', String(selectedAnswers.has(answer)));

    if (pokemon?.spriteUrl) {
      const image = document.createElement('img');
      image.src = pokemon.spriteUrl;
      image.alt = '';
      image.loading = 'lazy';
      button.append(image);
    }
    button.append(el('strong', { text: pokemon?.displayName ?? answer }));

    if (result) {
      if (result.correctlySelected.includes(answer)) button.classList.add('correct');
      else if (result.missedAnswers.includes(answer)) button.classList.add('missed');
      else if (result.incorrectAnswers.includes(answer)) button.classList.add('incorrect');
      button.disabled = true;
    } else {
      button.addEventListener('click', () => onToggle(answer));
    }

    grid.append(button);
  }

  return grid;
}

export const ANSWER_DISPLAYS = {
  'type-multi-select': renderTypeMultiSelect,
  'single-select': renderSingleSelect
};

export function renderAnswerDisplay(answerType, context) {
  const renderer = ANSWER_DISPLAYS[answerType];
  if (!renderer) throw new Error(`No display for answer type: ${answerType}`);
  return renderer(context);
}
