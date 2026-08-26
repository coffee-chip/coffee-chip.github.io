import { getGameVersionGroup, isPokemonAvailableInVersionGroup } from '../data/gameVersions.js';
import { getPokemon } from '../data/pokemonRepository.js';
import { getOwnedPokemon, addOwnedPokemon, removeOwnedPokemon, reorderOwnedPokemon, setOwnedPokemonNickname } from '../data/ownedPokemonRepository.js';
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

function createOwnedPokemonCard(entry, index, render) {
  const cachedPokemon = resolvedPokemon.get(entry.id);
  const pokemon = cachedPokemon?.id === entry.pokemonId ? cachedPokemon : null;
  const resolutionFailure = resolutionFailures.get(entry.id);
  const game = getGameVersionGroup(state.settings.gameVersionGroup);
  const available = isPokemonAvailableInVersionGroup(entry.pokemonId, state.settings.gameVersionGroup);
  const name = entryDisplayName(entry, pokemon);
  const card = el('article', { className: 'panel owned-pokemon-card' });
  card.dataset.entryIndex = String(index);
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

  const content = el('div', { className: 'owned-pokemon-content owned-pokemon-detail-link' });
  content.tabIndex = 0;
  content.setAttribute('role', 'link');
  content.setAttribute('aria-label', `Open details for ${name}`);
  const openDetails = event => {
    if (event.target.closest('button, input, form, select, a, .owned-pokemon-drag-handle')) return;
    location.hash = `my-pokemon/${encodeURIComponent(entry.id)}`;
  };
  content.addEventListener('click', openDetails);
  content.addEventListener('keydown', event => {
    if (event.target !== content || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    location.hash = `my-pokemon/${encodeURIComponent(entry.id)}`;
  });
  const header = el('div', { className: 'owned-pokemon-header' });
  const names = el('div', { className: 'owned-pokemon-names' });
  names.append(
    el('strong', { className: 'owned-pokemon-name', text: name }),
    el('span', { className: 'muted owned-pokemon-level-summary', text: `Lv. ${entry.level ?? 1}` })
  );

  const actions = el('div', { className: 'owned-pokemon-actions' });
  const edit = el('button', { className: 'secondary-button owned-pokemon-action-button', text: '✎' });
  const remove = el('button', { className: 'danger-button owned-pokemon-action-button', text: '×' });
  const handle = el('span', { className: 'team-drag-handle owned-pokemon-drag-handle', text: '↕' });
  edit.type = remove.type = 'button';
  edit.title = 'Edit nickname';
  edit.setAttribute('aria-label', `Edit nickname for ${name}`);
  remove.title = 'Remove from My Pokémon';
  remove.setAttribute('aria-label', `Remove ${name} from My Pokémon`);
  edit.addEventListener('click', () => createNicknameForm(entry, card, render));
  remove.addEventListener('click', () => createRemoveConfirmation(entry, name, card, render));
  handle.setAttribute('aria-label', `Drag to reorder ${name}`);
  handle.title = 'Drag to reorder';
  handle.addEventListener('click', event => event.stopPropagation());
  actions.append(edit, remove, handle);
  header.append(names, actions);

  content.append(header);
  if (pokemon?.types?.length) content.append(createTypeList(pokemon.types));
  else if (!available) content.append(el('span', { className: 'muted owned-pokemon-game-note', text: `Not available in ${game.label}` }));
  else if (resolutionFailure?.pokemonId === entry.pokemonId) content.append(el('span', { className: 'muted owned-pokemon-game-note', text: 'Types could not be loaded' }));
  else content.append(el('span', { className: 'muted owned-pokemon-game-note', text: 'Loading types…' }));

  card.append(visual, content);

  let holdTimer = null;
  let dragging = false;
  let pointerId = null;
  let proposedIndex = index;
  let insertionMarker = null;

  function removeInsertionMarker() {
    insertionMarker?.remove();
    insertionMarker = null;
  }

  function updateInsertionMarker(clientY) {
    const list = card.closest('.owned-pokemon-list');
    if (!list) return;
    const otherCards = [...list.querySelectorAll('.owned-pokemon-card')].filter(candidate => candidate !== card && !candidate.hidden);
    let insertionIndex = otherCards.length;
    let insertBefore = null;
    for (let candidateIndex = 0; candidateIndex < otherCards.length; candidateIndex += 1) {
      const candidate = otherCards[candidateIndex];
      const bounds = candidate.getBoundingClientRect();
      if (clientY < bounds.top + bounds.height / 2) {
        insertionIndex = candidateIndex;
        insertBefore = candidate;
        break;
      }
    }
    proposedIndex = insertionIndex;
    insertionMarker ??= el('div', { className: 'team-insertion-marker owned-pokemon-insertion-marker' });
    if (insertBefore) list.insertBefore(insertionMarker, insertBefore);
    else list.append(insertionMarker);
  }

  function stopDrag() {
    window.clearTimeout(holdTimer);
    holdTimer = null;
    if (pointerId !== null && handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
    pointerId = null;
    if (!dragging) return;
    dragging = false;
    card.classList.remove('team-card-dragging');
    removeInsertionMarker();
    if (proposedIndex !== index) reorderOwnedPokemon(index, proposedIndex);
    render();
  }

  handle.addEventListener('pointerdown', event => {
    if (event.button !== 0 || filterQuery.trim()) return;
    pointerId = event.pointerId;
    proposedIndex = index;
    handle.setPointerCapture(pointerId);
    holdTimer = window.setTimeout(() => {
      dragging = true;
      card.classList.add('team-card-dragging');
      updateInsertionMarker(event.clientY);
    }, event.pointerType === 'touch' ? 300 : 0);
  });
  handle.addEventListener('pointermove', event => {
    if (!dragging) return;
    event.preventDefault();
    updateInsertionMarker(event.clientY);
  });
  handle.addEventListener('pointerup', stopDrag);
  handle.addEventListener('pointercancel', stopDrag);
  handle.addEventListener('lostpointercapture', stopDrag);
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
  for (const handle of list.querySelectorAll('.owned-pokemon-drag-handle')) {
    handle.setAttribute('aria-disabled', String(Boolean(normalized)));
    handle.title = normalized ? 'Clear the search to reorder' : 'Drag to reorder';
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
    if (resolvedPokemon.get(entry.id)?.id !== entry.pokemonId) resolvedPokemon.delete(entry.id);
    if (resolutionFailures.get(entry.id)?.pokemonId !== entry.pokemonId) resolutionFailures.delete(entry.id);
    if (resolvedPokemon.has(entry.id) || resolutionFailures.has(entry.id) || loadingEntries.has(entry.id)) continue;
    loadingEntries.add(entry.id);
    getPokemon(entry.pokemonId)
      .then(result => resolvedPokemon.set(entry.id, result.pokemon))
      .catch(error => resolutionFailures.set(entry.id, { pokemonId: entry.pokemonId, error }))
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
    entries.forEach((entry, index) => list.append(createOwnedPokemonCard(entry, index, render)));
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
