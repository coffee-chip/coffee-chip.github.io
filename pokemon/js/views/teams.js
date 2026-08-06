import { createTeam, getTeams, reorderTeams, TEAM_MAX_POKEMON } from '../data/teamRepository.js';

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

function createTeamCard(team, index, render) {
  const card = el('article', { className: 'panel team-card' });
  card.dataset.teamIndex = String(index);

  const header = el('div', { className: 'team-card-header' });
  const title = el('h2', { text: team.title });
  const handle = el('button', { className: 'team-drag-handle', text: '≡' });
  handle.type = 'button';
  handle.setAttribute('aria-label', `Reorder ${team.title}`);
  handle.title = 'Drag to reorder';
  header.append(title, handle);

  const row = el('div', { className: 'team-pokemon-row' });
  for (const pokemon of team.pokemon) row.append(pokemonSlot(pokemon));
  for (let slot = team.pokemon.length; slot < TEAM_MAX_POKEMON; slot += 1) {
    const empty = el('div', { className: 'team-pokemon-slot team-pokemon-slot-empty' });
    empty.setAttribute('aria-hidden', 'true');
    row.append(empty);
  }

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

  card.append(header, row);
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
