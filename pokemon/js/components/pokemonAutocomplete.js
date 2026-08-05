import { state } from '../state.js';
import { getCachedPokemonNameIndex } from '../data/pokemonRepository.js';

const INPUT_SELECTOR = '.pokemon-lookup-form input[type="search"]';
const MAX_SUGGESTIONS = 5;
let names = getCachedPokemonNameIndex()?.names ?? [];
let activeInput = null;
let suggestionList = null;

function installStyles() {
  if (document.querySelector('#pokemon-autocomplete-styles')) return;
  const style = document.createElement('style');
  style.id = 'pokemon-autocomplete-styles';
  style.textContent = `
    .pokemon-lookup-form label { position: relative; }
    .pokemon-lookup-form input[type="search"] { padding-left: 2.6rem; }
    .pokemon-search-clear {
      position: absolute; z-index: 2; bottom: .38rem; left: .38rem;
      display: grid; place-items: center; width: 1.85rem; min-width: 1.85rem; height: 1.85rem;
      padding: 0; border: 0; border-radius: 50%; background: transparent;
      color: var(--text-muted); font-size: 1.25rem; line-height: 1;
    }
    .pokemon-search-clear:hover,
    .pokemon-search-clear:focus-visible { background: var(--subtle-background); color: var(--text-primary); }
    .pokemon-autocomplete-list {
      position: absolute; z-index: 20; top: 100%; right: 0; left: 0;
      overflow: hidden; margin-top: .25rem; border: 1px solid var(--border-default);
      border-radius: .55rem; background: var(--panel-background);
      box-shadow: 0 .5rem 1.25rem rgb(0 0 0 / .16);
    }
    .pokemon-autocomplete-option {
      display: block; width: 100%; min-height: 2.5rem; padding: .55rem .7rem;
      border: 0; border-bottom: 1px solid var(--border-default); border-radius: 0;
      background: var(--panel-background); color: var(--text-primary); text-align: left;
    }
    .pokemon-autocomplete-option:last-child { border-bottom: 0; }
    .pokemon-autocomplete-option:active,
    .pokemon-autocomplete-option:focus-visible { background: var(--subtle-background); }
  `;
  document.head.append(style);
}

function displayName(name) { return name.split('-').map(part => part ? part[0].toUpperCase() + part.slice(1) : '').join(' '); }
function closeSuggestions() { suggestionList?.remove(); suggestionList = null; activeInput?.setAttribute('aria-expanded', 'false'); }
function findMatches(query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized || /^\d+$/.test(normalized)) return [];
  const prefix = names.filter(name => name.startsWith(normalized));
  const contains = names.filter(name => !name.startsWith(normalized) && name.includes(normalized));
  return [...prefix, ...contains].slice(0, MAX_SUGGESTIONS);
}

function ensureClearButton(input) {
  const label = input.closest('label') ?? input.parentElement;
  if (!label || label.querySelector('.pokemon-search-clear')) return;
  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'pokemon-search-clear';
  clear.textContent = '×';
  clear.setAttribute('aria-label', 'Clear Pokémon search');
  clear.addEventListener('click', () => {
    input.value = '';
    state.study.pokemonQuery = '';
    closeSuggestions();
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  });
  label.insertBefore(clear, input);
}

function ensureVisibleClearButtons(root = document) {
  for (const input of root.querySelectorAll?.(INPUT_SELECTOR) ?? []) ensureClearButton(input);
}

function renderSuggestions(input) {
  ensureClearButton(input);
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
    option.className = 'pokemon-autocomplete-option';
    option.setAttribute('role', 'option');
    option.textContent = displayName(name);
    option.addEventListener('pointerdown', event => {
      event.preventDefault();
      input.value = name;
      state.study.pokemonQuery = name;
      closeSuggestions();
      input.focus();
    });
    list.append(option);
  }
  (input.closest('label') ?? input.parentElement).append(list);
  suggestionList = list;
  input.setAttribute('aria-expanded', 'true');
}

export function initializePokemonAutocomplete() {
  installStyles();
  ensureVisibleClearButtons();
  const root = document.querySelector('#app-view');
  if (root) new MutationObserver(() => ensureVisibleClearButtons(root)).observe(root, { childList: true, subtree: true });
  document.addEventListener('input', event => { const input = event.target.closest?.(INPUT_SELECTOR); if (input) renderSuggestions(input); });
  document.addEventListener('focusin', event => { const input = event.target.closest?.(INPUT_SELECTOR); if (input) renderSuggestions(input); });
  document.addEventListener('focusout', event => { if (event.target === activeInput) window.setTimeout(closeSuggestions, 0); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && event.target === activeInput) closeSuggestions(); });
  document.addEventListener('pokemon-name-index-ready', event => {
    if (Array.isArray(event.detail?.names)) names = event.detail.names;
    if (activeInput?.isConnected && document.activeElement === activeInput) renderSuggestions(activeInput);
  });
}
