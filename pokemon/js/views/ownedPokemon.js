import { getGameVersionGroup, isPokemonAvailableInVersionGroup } from '../data/gameVersions.js';
import { getPokemon } from '../data/pokemonRepository.js';
import {
  addPokemonToMyPokemon,
  getMyPokemon,
  getPokemonInstanceView,
  removePokemonFromMyPokemon,
  reorderMyPokemon,
  resolvePokemonInstance,
  setPokemonInstanceNickname
} from '../data/pokemonInstanceRepository.js';
import { createTypeList } from '../components/typeBadge.js';
import { createTeamOverviewNavigation } from '../components/teamOverviewNavigation.js';
import { openPokemonInStudy } from '../components/pokemonStudyNavigation.js';
import { state } from '../state.js';

let currentRender = null;
let filterQuery = '';
let addError = '';

function el(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text) node.textContent = options.text;
  return node;
}

function createNicknameForm(instance, pokemon, card, render) {
  card.querySelector('.owned-pokemon-edit-form')?.remove();
  const form = el('form', { className: 'owned-pokemon-edit-form' });
  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 60;
  input.value = instance.nickname ?? '';
  input.placeholder = pokemon?.displayName ?? `Pokémon #${instance.speciesId}`;
  input.setAttribute('aria-label', `Nickname for ${input.placeholder}`);

  const actions = el('div', { className: 'owned-pokemon-edit-actions' });
  const cancel = el('button', { className: 'secondary-button', text: 'Cancel' });
  const save = el('button', { className: 'primary-button', text: 'Save' });
  cancel.type = 'button';
  save.type = 'submit';
  cancel.addEventListener('click', () => form.remove());
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (setPokemonInstanceNickname(instance.id, input.value)) render();
  });
  actions.append(cancel, save);
  form.append(input, actions);
  card.append(form);
  input.focus();
  input.select();
}

function createRemoveConfirmation(instance, name, card, render) {
  card.querySelector('.owned-pokemon-remove-confirmation')?.remove();
  const confirmation = el('div', { className: 'owned-pokemon-remove-confirmation' });
  confirmation.append(el('span', { text: `Remove ${name} from My Pokémon?` }));
  const actions = el('div', { className: 'owned-pokemon-remove-actions' });
  const cancel = el('button', { className: 'secondary-button', text: 'Cancel' });
  const remove = el('button', { className: 'danger-button', text: 'Remove' });
  cancel.type = remove.type = 'button';
  cancel.addEventListener('click', () => confirmation.remove());
  remove.addEventListener('click', () => {
    if (removePokemonFromMyPokemon(instance.id)) render();
  });
  actions.append(cancel, remove);
  confirmation.append(actions);
  card.append(confirmation);
}

function createOwnedPokemonCard(instance, index, render) {
  const instanceView = getPokemonInstanceView(instance.id);
  const pokemon = instanceView?.pokemon;
  const game = getGameVersionGroup(state.settings.gameVersionGroup);
  const available = isPokemonAvailableInVersionGroup(instance.speciesId, state.settings.gameVersionGroup);
  const name = instanceView.displayName;
  const card = el('article', { className: 'panel owned-pokemon-card' });
  card.dataset.entryIndex = String(index);
  card.dataset.search = [instance.nickname, pokemon?.displayName, String(instance.speciesId)].filter(Boolean).join(' ').toLowerCase();

  const visual = el('div', { className: 'owned-pokemon-visual' });
  if (pokemon?.spriteUrl) {
    const image = document.createElement('img');
    image.src = pokemon.spriteUrl;
    image.alt = '';
    image.loading = 'lazy';
    visual.append(image);
  } else {
    visual.append(el('span', { className: 'owned-pokemon-placeholder', text: `#${instance.speciesId}` }));
  }
  visual.classList.add('owned-pokemon-study-link');
  visual.tabIndex = 0;
  visual.setAttribute('role', 'button');
  visual.setAttribute('aria-label', `Open ${name} in Study`);
  visual.addEventListener('click', () => openPokemonInStudy(instance.speciesId));
  visual.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openPokemonInStudy(instance.speciesId);
  });

  const content = el('div', { className: 'owned-pokemon-content owned-pokemon-detail-link' });
  content.tabIndex = 0;
  content.setAttribute('role', 'link');
  content.setAttribute('aria-label', `Open details for ${name}`);
  const openDetails = event => {
    if (event.target.closest('button, input, form, select, a, .owned-pokemon-drag-handle')) return;
    location.hash = `my-pokemon/${encodeURIComponent(instance.id)}`;
  };
  content.addEventListener('click', openDetails);
  content.addEventListener('keydown', event => {
    if (event.target !== content || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    location.hash = `my-pokemon/${encodeURIComponent(instance.id)}`;
  });
  const header = el('div', { className: 'owned-pokemon-header' });
  const names = el('div', { className: 'owned-pokemon-names' });
  names.append(
    el('strong', { className: 'owned-pokemon-name', text: name }),
    el('span', { className: 'muted owned-pokemon-level-summary', text: `Lv. ${instance.level}` })
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
  edit.addEventListener('click', () => createNicknameForm(instance, pokemon, card, render));
  remove.addEventListener('click', () => createRemoveConfirmation(instance, name, card, render));
  handle.setAttribute('aria-label', `Drag to reorder ${name}`);
  handle.title = 'Drag to reorder';
  handle.addEventListener('click', event => event.stopPropagation());
  actions.append(edit, remove, handle);
  header.append(names, actions);

  content.append(header);
  if (pokemon?.types?.length) content.append(createTypeList(pokemon.types));
  else if (!available) content.append(el('span', { className: 'muted owned-pokemon-game-note', text: `Not available in ${game.label}` }));
  else if (instanceView.status === 'error') content.append(el('span', { className: 'muted owned-pokemon-game-note', text: 'Types could not be loaded' }));
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
    if (proposedIndex !== index) reorderMyPokemon(index, proposedIndex);
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
      if (!addPokemonToMyPokemon(result.pokemon)) addError = 'Could not add that Pokémon.';
    } catch (error) {
      addError = error?.message ?? 'Could not look up that Pokémon.';
    }
    render();
  });
  return form;
}

function loadOwnedPokemon(instances, render) {
  const unresolved = instances.filter(instance => getPokemonInstanceView(instance.id)?.status === 'idle');
  if (!unresolved.length) return;
  Promise.allSettled(unresolved.map(instance => resolvePokemonInstance(instance.id))).then(() => {
    if (state.route === 'my-pokemon') render();
  });
}

export function renderOwnedPokemon(container, render) {
  currentRender = render;
  const entries = getMyPokemon();
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
  if (state.route === 'my-pokemon' && currentRender) currentRender();
});
