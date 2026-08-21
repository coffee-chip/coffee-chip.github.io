import { getCachedPokemonNameIndex } from '../data/pokemonRepository.js';

const INPUT_SELECTOR = 'input[data-pokemon-autocomplete]';
const MAX_SUGGESTIONS = 5;
let names = getCachedPokemonNameIndex()?.names ?? [];
let activeInput = null;
let suggestionList = null;

function displayName(name) {
  return name.split('-').map(part => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ');
}

function closeSuggestions() {
  suggestionList?.remove();
  suggestionList = null;
  activeInput?.setAttribute('aria-expanded', 'false');
}

function getActiveSearchField() {
  return activeInput?.closest('.search-field') ?? null;
}

function selectSuggestion(input, name) {
  input.value = name;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  closeSuggestions();
  input.dispatchEvent(new CustomEvent('pokemon-autocomplete-select', {
    bubbles: true,
    detail: { name }
  }));
}

function findMatches(query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized || /^\d+$/.test(normalized)) return [];
  const prefix = names.filter(name => name.startsWith(normalized));
  const contains = names.filter(name => !name.startsWith(normalized) && name.includes(normalized));
  return [...prefix, ...contains].slice(0, MAX_SUGGESTIONS);
}

function renderSuggestions(input) {
  closeSuggestions();
  activeInput = input;
  input.removeAttribute('list');
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('aria-autocomplete', 'list');
  const matches = findMatches(input.value);
  if (!matches.length) return;

  const list = document.createElement('div');
  list.className = 'pokemon-autocomplete-list';
  list.setAttribute('role', 'listbox');
  for (const name of matches) {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'secondary-button pokemon-autocomplete-option';
    option.setAttribute('role', 'option');
    option.textContent = displayName(name);
    option.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      selectSuggestion(input, name);
    });
    list.append(option);
  }

  input.closest('.search-field')?.append(list);
  suggestionList = list;
  input.setAttribute('aria-expanded', 'true');
}

export function initializePokemonAutocomplete() {
  document.addEventListener('input', event => {
    const input = event.target.closest?.(INPUT_SELECTOR);
    if (input) renderSuggestions(input);
  });
  document.addEventListener('focusin', event => {
    const input = event.target.closest?.(INPUT_SELECTOR);
    if (input) renderSuggestions(input);
  });
  document.addEventListener('pointerdown', event => {
    if (!getActiveSearchField()?.contains(event.target)) closeSuggestions();
  }, true);
  document.addEventListener('focusout', event => {
    if (event.target !== activeInput) return;
    window.setTimeout(() => {
      if (!getActiveSearchField()?.contains(document.activeElement)) closeSuggestions();
    }, 0);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && event.target === activeInput) closeSuggestions();
  });
  document.addEventListener('pokemon-name-index-ready', event => {
    if (Array.isArray(event.detail?.names)) names = event.detail.names;
    if (activeInput?.isConnected && document.activeElement === activeInput) renderSuggestions(activeInput);
  });
  document.addEventListener('pokemon-game-data-cleared', () => {
    names = [];
    closeSuggestions();
  });
}
