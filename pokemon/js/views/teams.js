import { createTeam, deleteTeam, getTeams, reorderTeams } from '../data/teamRepository.js';

function el(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text) node.textContent = options.text;
  return node;
}

function pokemonSlot(pokemon) {
  const slot = el('div', { className: 'team-pokemon-slot' });
  slot.title = pokemon.displayName;
  slot.setAttribute('aria-label', pokemon.displayName);
  if (pokemon.spriteUrl) {
    const image = document.createElement('img');
    image.src = pokemon.spriteUrl;
    image.alt = pokemon.displayName;
    image.loading = 'lazy';
    slot.append(image);
  } else {
    slot.append(el('span', { text: `#${pokemon.id}` }));
  }
  return slot;
}

function createDeleteConfirmation(team, card, render) {
  card.querySelector('.team-delete-confirmation')?.remove();
  const confirmation = el('div', { className: 'team-delete-confirmation' });
  const message = el('span', { text: `Delete “${team.title}”?` });
  const actions = el('div', { className: 'team-delete-actions' });
  const cancel = el('button', { className: 'secondary-button', text: 'Cancel' });
  cancel.type = 'button';
  cancel.addEventListener('click', () => confirmation.remove());
  const confirm = el('button', { className: 'danger-button', text: 'Delete' });
  confirm.type = 'button';
  confirm.addEventListener('click', () => {
    if (deleteTeam(team.id)) render();
  });
  actions.append(cancel, confirm);
  confirmation.append(message, actions);
  card.append(confirmation);
}

function createTeamCard(team, index, render) {
  const card = el('article', { className: `panel team-card${team.pokemon.length ? '' : ' team-card-empty'}` });
  card.dataset.teamIndex = String(index);

  const header = el('div', { className: 'team-card-header' });
  const title = el('h2', { text: team.title });
  title.style.overflowWrap = 'anywhere';
  title.style.wordBreak = 'break-word';
  const actions = el('div', { className: 'team-card-actions' });
  const remove = el('button', { className: 'team-delete-button', text: '×' });
  remove.type = 'button';
  remove.setAttribute('aria-label', `Delete ${team.title}`);
  remove.title = 'Delete team';
  remove.addEventListener('click', () => createDeleteConfirmation(team, card, render));
  const handle = el('span', { className: 'team-drag-handle', text: '≡' });
  handle.setAttribute('aria-label', `Drag to reorder ${team.title}`);
  handle.title = 'Drag to reorder';
  actions.append(remove, handle);
  header.append(title, actions);

  let holdTimer = null;
  let dragging = false;
  let pointerId = null;

  function stopDrag() {
    window.clearTimeout(holdTimer);
    holdTimer = null;
    if (pointerId !== null && handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
    pointerId = null;
    if (dragging) {
      dragging = false;
      card.classList.remove('team-card-dragging');
      document.querySelectorAll('.team-card-drag-target').forEach(node => node.classList.remove('team-card-drag-target'));
      render();
    }
  }

  handle.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    pointerId = event.pointerId;
    handle.setPointerCapture(pointerId);
    holdTimer = window.setTimeout(() => {
      dragging = true;
      card.classList.add('team-card-dragging');
    }, event.pointerType === 'touch' ? 300 : 0);
  });

  handle.addEventListener('pointermove', event => {
    if (!dragging) return;
    event.preventDefault();
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.team-card');
    if (!target || target === card) return;
    document.querySelectorAll('.team-card-drag-target').forEach(node => node.classList.remove('team-card-drag-target'));
    target.classList.add('team-card-drag-target');
    const fromIndex = Number(card.dataset.teamIndex);
    const toIndex = Number(target.dataset.teamIndex);
    if (reorderTeams(fromIndex, toIndex)) {
      card.dataset.teamIndex = String(toIndex);
      target.dataset.teamIndex = String(fromIndex);
    }
  });

  handle.addEventListener('pointerup', stopDrag);
  handle.addEventListener('pointercancel', stopDrag);
  handle.addEventListener('lostpointercapture', stopDrag);

  card.append(header);
  if (team.pokemon.length) {
    const row = el('div', { className: 'team-pokemon-row' });
    for (const pokemon of team.pokemon) row.append(pokemonSlot(pokemon));
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
  const button = el('button', { text: 'Create team' });
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
  page.append(list);
  container.replaceChildren(page);
}
