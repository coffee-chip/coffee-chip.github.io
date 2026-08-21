import { getGameVersionGroup, isPokemonAvailableInVersionGroup } from '../data/gameVersions.js';
import { getPokemon } from '../data/pokemonRepository.js';
import { getOwnedPokemon, addOwnedPokemon, removeOwnedPokemon, setOwnedPokemonNickname } from '../data/ownedPokemonRepository.js';
import { createTypeList } from '../components/typeBadge.js';
import { createTeamOverviewNavigation } from '../components/teamOverviewNavigation.js';
import { openPokemonInStudy } from '../components/pokemonStudyNavigation.js';
import { state } from '../state.js';

const resolvedPokemon = new Map();
const resolutionFailures = new Map();
const loadingEntries = new Set();
let currentRender = null;
let filterQuery = '';
let addError = '';

function el(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text) node.textContent = options.text;
  return node;
}

function entryDisplayName(entry, pokemon) {
  return entry.nickname || pokemon?.displayName || entry.displayName;
}

function createNicknameForm(entry, card, render) {
  card.querySelector('.owned-pokemon-edit-form')?.remove();
  const form = el('form', { className: 'owned-pokemon-edit-form' });
  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 60;
  input.value = entry.nickname ?? '';
  input.placeholder = entry.displayName;
  input.setAttribute('aria-label', `Nickname for ${entry.displayName}`);

  const actions = el('div', { className: 'owned-pokemon-edit-actions' });
  const cancel = el('button', { className: 'secondary-button', text: 'Cancel' });
  const save = el('button', { className: 'primary-button', text: 'Save' });
  cancel.type = 'button';
  save.type = 'submit';
  cancel.addEventListener('click', () => form.remove());
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (setOwnedPokemonNickname(entry.id, input.value)) render();
  });
  actions.append(cancel, save);
  form.append(input, actions);
  card.append(form);
  input.focus();
  input.select();
}

function createRemoveConfirmation(entry, name, card, render) {
  card.querySelector('.owned-pokemon-remove-confirmation')?.remove();
  const confirmation = el('div', { className: 'owned-pokemon-remove-confirmation' });
  confirmation.append(el('span', { text: `Remove ${name} from My Pokémon?` }));
  const actions = el('div', { className: 'owned-pokemon-remove-actions' });
  const cancel = el('button', { className: 'secondary-button', text: 'Cancel' });
  const remove = el('button', { className: 'danger-button', text: 'Remove' });
  cancel.type = remove.type = 'button';
  cancel.addEventListener('click', () => confirmation.remove());
  remove.addEventListener('click', () => {
    if (removeOwnedPokemon(entry.id)) render();
  });
  actions.append(cancel, remove);
  confirmation.append(actions);
  card.append(confirmation);
}

function createOwnedPokemonCard(entry, render) {
  const pokemon = resolvedPokemon.get(entry.id);
  const game = getGameVersionGroup(state.settings.gameVersionGroup);
  const available = isPokemonAvailableInVersionGroup(entry.pokemonId, state.settings.gameVersionGroup);
  const name = entryDisplayName(entry, pokemon);
  const card = el('article', { className: 'panel owned-pokemon-card' });
  card.dataset.search = [entry.nickname, entry.displayName, pokemon?.displayName].filter(Boolean).join(' ').toLowerCase();

  const visual = el('div', { className: 'owned-pokemon-visual' });
  if (pokemon?.spriteUrl ?? entry.spriteUrl) {
    const image = document.createElement('img');
    image.src = pokemon?.spriteUrl ?? entry.spriteUrl;
    image.alt = '';
    image.loading = 'lazy';
    visual.append(image);
  } else {
    visual.append(el('span', { className: 'owned-pokemon-placeholder', text: `#${entry.pokemonId}` }));
  }
  visual.classList.add('owned-pokemon-study-link');
  visual.tabIndex = 0;
  visual.setAttribute('role', 'button');
  visual.setAttribute('aria-label', `Open ${name} in Study`);
  visual.addEventListener('click', () => openPokemonInStudy(entry.pokemonId));
  visual.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openPokemonInStudy(entry.pokemonId);
  });

  const content = el('div', { className: 'owned-pokemon-content' });
  const header = el('div', { className: 'owned-pokemon-header' });
  const names = el('div', { className: 'owned-pokemon-names' });
  names.append(el('strong', { className: 'owned-pokemon-name', text: name }));
  if (entry.nickname) names.append(el('span', { className: 'muted owned-pokemon-species', text: pokemon?.displayName ?? entry.displayName }));

  const actions = el('div', { className: 'owned-pokemon-actions' });
  const edit = el('button', { className: 'secondary-button owned-pokemon-action-button', text: '✎' });
  const remove = el('button', { className: 'danger-button owned-pokemon-action-button', text: '×' });
  edit.type = remove.type = 'button';
  edit.title = 'Edit nickname';
  edit.setAttribute('aria-label', `Edit nickname for ${name}`);
  remove.title = 'Remove from My Pokémon';
  remove.setAttribute('aria-label', `Remove ${name} from My Pokémon`);
  edit.addEventListener('click', () => createNicknameForm(entry, card, render));
  remove.addEventListener('click', () => createRemoveConfirmation(entry, name, card, render));
  actions.append(edit, remove);
  header.append(names, actions);

  content.append(header);
  if (pokemon?.types?.length) content.append(createTypeList(pokemon.types));
  else if (!available) content.append(el('span', { className: 'muted owned-pokemon-game-note', text: `Not available in ${game.label}` }));
  else if (resolutionFailures.has(entry.id)) content.append(el('span', { className: 'muted owned-pokemon-game-note', text: 'Types could not be loaded' }));
  else content.append(el('span', { className: 'muted owned-pokemon-game-note', text: 'Loading types…' }));

  card.append(visual, content);
  return card;
}

function applyFilter(list, count) {
  const normalized = filterQuery.trim().toLowerCase();
  let visible = 0;
  for (const card of list.querySelectorAll('.owned-pokemon-card')) {
    const matches = !normalized || card.dataset.search.includes(normalized);
    card.hidden = !matches;
    if (matches) visible += 1;
  }
  count.textContent = normalized
    ? `${visible} matching Pokémon`
    : `${visible} Pokémon`;
}

function createFilter(entries) {
  const field = el('label', { className: 'owned-pokemon-filter' });
  field.append(el('span', { text: 'Search My Pokémon' }));
  const input = document.createElement('input');
  input.type = 'search';
  input.placeholder = 'Name or nickname';
  input.value = filterQuery;
  field.append(input);
  return { field, input };
}

function createAddForm(render) {
  const form = el('div', { className: 'panel pokemon-lookup-form owned-pokemon-add-form' });
  const label = el('label');
  label.append(el('span', { text: 'Add Pokémon' }));
  const searchField = el('div', { className: 'search-field' });
  const input = document.createElement('input');
  input.type = 'search';
  input.dataset.pokemonAutocomplete = 'true';
  input.autocomplete = 'off';
  input.autocapitalize = 'none';
  input.spellcheck = false;
  input.placeholder = 'Start typing a Pokémon name';
  input.setAttribute('aria-label', 'Pokémon name');
  searchField.append(input);
  label.append(searchField);
  form.append(label);
  if (addError) form.append(el('p', { className: 'pokemon-lookup-error', text: addError }));

  input.addEventListener('pokemon-autocomplete-select', async event => {
    const name = event.detail?.name;
    if (!name) return;
    input.disabled = true;
    addError = '';
    try {
      const result = await getPokemon(name);
      if (!addOwnedPokemon(result.pokemon)) addError = 'Could not add that Pokémon.';
    } catch (error) {
      addError = error?.message ?? 'Could not look up that Pokémon.';
    }
    render();
  });
  return form;
}

function loadOwnedPokemon(entries, render) {
  for (const entry of entries) {
    if (resolvedPokemon.has(entry.id) || resolutionFailures.has(entry.id) || loadingEntries.has(entry.id)) continue;
    loadingEntries.add(entry.id);
    getPokemon(entry.pokemonId)
      .then(result => resolvedPokemon.set(entry.id, result.pokemon))
      .catch(error => resolutionFailures.set(entry.id, error))
      .finally(() => {
        loadingEntries.delete(entry.id);
        if (state.route === 'my-pokemon') render();
      });
  }
}

export function renderOwnedPokemon(container, render) {
  currentRender = render;
  const entries = getOwnedPokemon();
  const page = el('section', { className: 'page owned-pokemon-page' });
  page.append(createTeamOverviewNavigation('my-pokemon'), createAddForm(render));

  const section = el('section', { className: 'owned-pokemon-roster' });
  const filter = createFilter(entries);
  const count = el('p', { className: 'muted owned-pokemon-count' });
  const list = el('div', { className: 'owned-pokemon-list' });
  if (!entries.length) {
    list.append(el('p', { className: 'panel muted', text: 'No Pokémon added yet.' }));
  } else {
    for (const entry of entries) list.append(createOwnedPokemonCard(entry, render));
  }

  filter.input.addEventListener('input', () => {
    filterQuery = filter.input.value;
    applyFilter(list, count);
  });
  section.append(filter.field, count, list);
  page.append(section);
  container.replaceChildren(page);
  applyFilter(list, count);
  loadOwnedPokemon(entries, render);
}

document.addEventListener('pokemon-game-data-cleared', () => {
  resolvedPokemon.clear();
  resolutionFailures.clear();
  loadingEntries.clear();
  if (state.route === 'my-pokemon' && currentRender) currentRender();
});
