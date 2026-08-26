import { createTeam, getTeams, reorderTeams } from '../data/teamRepository.js';
import { getPokemonInstanceView, resolvePokemonInstance } from '../data/pokemonInstanceRepository.js';
import { createTeamActionsButton } from '../components/teamActionsMenu.js';
import { createTeamOverviewNavigation } from '../components/teamOverviewNavigation.js';
import { state } from '../state.js';

function el(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text) node.textContent = options.text;
  return node;
}

function pokemonSlot(instanceId) {
  const instanceView = getPokemonInstanceView(instanceId);
  const pokemon = instanceView?.pokemon;
  const slot = el('div', { className: 'team-pokemon-slot' });
  slot.title = instanceView?.displayName ?? 'Unknown Pokémon';
  slot.setAttribute('aria-label', slot.title);
  if (pokemon?.spriteUrl) {
    const image = document.createElement('img');
    image.src = pokemon.spriteUrl;
    image.alt = instanceView.displayName;
    image.loading = 'lazy';
    slot.append(image);
  } else {
    slot.append(el('span', { text: instanceView ? `#${instanceView.instance.speciesId}` : '?' }));
  }
  return slot;
}

function createTeamCard(team, index, render) {
  const classes = ['panel', 'team-card'];
  if (!team.memberIds.length) classes.push('team-card-empty');
  if (team.isOpponent) classes.push('team-card-opponent');
  const card = el('article', { className: classes.join(' ') });
  card.dataset.teamIndex = String(index);
  card.tabIndex = 0;
  card.setAttribute('role', 'link');
  card.setAttribute('aria-label', `Open ${team.title}`);

  const openTeam = event => {
    if (event?.target?.closest?.('button, input, label, form, .team-drag-handle, .team-actions-menu')) return;
    location.hash = `team/${encodeURIComponent(team.id)}`;
  };
  card.addEventListener('click', openTeam);
  card.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (event.target !== card) return;
    event.preventDefault();
    openTeam(event);
  });

  const header = el('div', { className: 'team-card-header' });
  const title = el('h2', { text: team.title });
  title.style.overflowWrap = 'anywhere';
  title.style.wordBreak = 'break-word';
  const actions = el('div', { className: 'team-card-actions' });
  const menuButton = createTeamActionsButton(team, card, render);
  const handle = el('span', { className: 'team-drag-handle' });
  handle.setAttribute('aria-label', `Drag to reorder ${team.title}`);
  handle.title = 'Drag to reorder';
  actions.append(menuButton, handle);
  header.append(title, actions);

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
    const list = card.closest('.team-list');
    if (!list) return;
    const otherCards = [...list.querySelectorAll('.team-card')].filter(candidate => candidate !== card);
    let insertionIndex = otherCards.length;
    let insertBefore = list.querySelector('.team-create-card');
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
    insertionMarker ??= el('div', { className: 'team-insertion-marker' });
    list.insertBefore(insertionMarker, insertBefore);
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
    if (proposedIndex !== index) reorderTeams(index, proposedIndex);
    render();
  }

  handle.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
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

  card.append(header);
  if (team.memberIds.length) {
    const row = el('div', { className: 'team-pokemon-row' });
    for (const instanceId of team.memberIds) row.append(pokemonSlot(instanceId));
    card.append(row);
  }
  return card;
}

function createNewTeamCard(render) {
  const form = el('form', { className: 'panel team-create-card' });
  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 60;
  input.placeholder = 'New team name';
  input.setAttribute('aria-label', 'New team name');
  const button = el('button', { className: 'primary-button', text: 'Create team' });
  button.type = 'submit';
  form.append(input, button);
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!createTeam(input.value)) {
      input.focus();
      return;
    }
    render();
  });
  return form;
}

export function renderTeams(container, render) {
  const page = el('section', { className: 'page teams-page' });
  const list = el('div', { className: 'team-list' });
  getTeams().forEach((team, index) => list.append(createTeamCard(team, index, render)));
  list.append(createNewTeamCard(render));
  page.append(createTeamOverviewNavigation('teams'), list);
  container.replaceChildren(page);
  const unresolved = [...new Set(getTeams().flatMap(team => team.memberIds))]
    .filter(instanceId => getPokemonInstanceView(instanceId)?.status === 'idle');
  if (unresolved.length) {
    Promise.allSettled(unresolved.map(resolvePokemonInstance)).then(() => {
      if (state.route === 'teams') render();
    });
  }
}
