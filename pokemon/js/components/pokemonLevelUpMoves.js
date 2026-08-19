import { state } from '../state.js';
import { getGameVersionGroup } from '../data/gameVersions.js';
import { getMove, getMoves, getMoveVersionData } from '../data/moveRepository.js';
import { getLevelUpMoves, getPokemon } from '../data/pokemonRepository.js';
import { createTypeIcon } from './typeBadge.js';

let activeMoveKey = null;
let activeMoveBanner = null;
const pendingLearnsetLoads = new Map();
const moveDetailsByLearnset = new Map();
const pendingMoveDetailLoads = new Map();

function el(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text) node.textContent = options.text;
  return node;
}

function dismissMoveDetails() {
  activeMoveBanner?.remove();
  activeMoveBanner = null;
  activeMoveKey = null;
  for (const button of document.querySelectorAll('.pokemon-level-up-move-button[aria-pressed="true"]')) {
    button.setAttribute('aria-pressed', 'false');
  }
}

function formatValue(value, suffix = '') {
  return value === null || value === undefined ? '—' : `${value}${suffix}`;
}

function populateMoveBanner(banner, move, versionGroup) {
  const data = getMoveVersionData(move, versionGroup);
  if (!data) {
    banner.replaceChildren(el('strong', { text: move.displayName }), el('p', { text: 'Move details are unavailable for this game.' }));
    return;
  }
  const heading = el('div', { className: 'move-details-heading' });
  heading.append(createTypeIcon(data.type), el('strong', { text: move.displayName }));
  const stats = el('div', { className: 'move-details-stats' });
  for (const [label, value] of [['Damage', formatValue(data.power)], ['Accuracy', formatValue(data.accuracy, '%')]]) {
    const stat = el('span');
    stat.append(el('strong', { text: label }), el('span', { text: value }));
    stats.append(stat);
  }
  banner.replaceChildren(heading, stats, el('p', { className: 'move-details-description', text: data.description || 'No in-game description is available.' }), el('span', { className: 'move-details-dismiss-hint', text: 'Tap to dismiss' }));
}

async function showMoveDetails(moveName, versionGroup, button) {
  const key = `${versionGroup}:${moveName}`;
  if (activeMoveKey === key) {
    dismissMoveDetails();
    return;
  }
  dismissMoveDetails();
  activeMoveKey = key;
  button.setAttribute('aria-pressed', 'true');

  const banner = el('button', { className: 'transparent-button move-details-banner' });
  banner.type = 'button';
  banner.setAttribute('aria-label', 'Dismiss move details');
  banner.append(el('strong', { text: 'Loading move details…' }));
  banner.addEventListener('click', dismissMoveDetails);
  document.body.append(banner);
  activeMoveBanner = banner;

  try {
    const result = await getMove(moveName, { versionGroup });
    if (activeMoveKey !== key || activeMoveBanner !== banner) return;
    populateMoveBanner(banner, result.move, versionGroup);
  } catch (error) {
    if (activeMoveKey !== key || activeMoveBanner !== banner) return;
    banner.replaceChildren(el('strong', { text: 'Move details unavailable' }), el('p', { text: error?.message ?? 'Could not look up this move.' }), el('span', { className: 'move-details-dismiss-hint', text: 'Tap to dismiss' }));
  }
}

function createMovesTable(moves, versionGroup, moveDetails) {
  const table = el('table', { className: 'pokemon-level-up-moves-table' });
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const label of ['Level', 'Move', 'Type']) headRow.append(el('th', { text: label }));
  head.append(headRow);
  const body = document.createElement('tbody');
  for (const move of moves) {
    const row = document.createElement('tr');
    row.append(el('td', { className: 'pokemon-level-up-move-level', text: String(move.level) }));
    const name = document.createElement('td');
    const button = el('button', { className: 'transparent-button pokemon-level-up-move-button', text: move.displayName });
    button.type = 'button';
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-label', `Show details for ${move.displayName}`);
    button.addEventListener('click', () => showMoveDetails(move.name, versionGroup, button));
    name.append(button);
    row.append(name);
    const type = document.createElement('td');
    type.className = 'pokemon-level-up-move-type';
    const moveData = getMoveVersionData(moveDetails?.get(move.name), versionGroup);
    type.title = moveData ? `${moveData.type} type` : 'Loading move type';
    if (moveData) type.append(createTypeIcon(moveData.type));
    else type.append(el('span', { className: 'muted', text: '…' }));
    row.append(type);
    body.append(row);
  }
  table.append(head, body);
  return table;
}

function createMovesSection(pokemon, versionGroup, moveDetails) {
  const game = getGameVersionGroup(versionGroup);
  const section = el('section', { className: 'panel pokemon-level-up-moves' });
  section.append(el('h3', { text: 'Moves learned by level' }));
  section.append(el('p', { className: 'muted pokemon-level-up-moves-intro', text: game.label }));
  const moves = getLevelUpMoves(pokemon, versionGroup);
  if (moves === null) {
    section.append(el('p', { className: 'muted pokemon-level-up-moves-status', text: 'Loading level-up moves…' }));
  } else if (!moves.length) {
    section.append(el('p', { className: 'muted', text: `No level-up moves are recorded for ${game.label}.` }));
  } else {
    section.append(createMovesTable(moves, versionGroup, moveDetails));
  }
  return section;
}

function loadMoveDetails(pokemon, moves, versionGroup, render) {
  const key = `${pokemon.id}:${versionGroup}`;
  if (moveDetailsByLearnset.has(key) || pendingMoveDetailLoads.has(key)) return;
  const request = getMoves(moves.map(move => move.name), { versionGroup })
    .then(details => {
      moveDetailsByLearnset.set(key, details);
      if (state.study.pokemonResult?.id === pokemon.id && state.settings.gameVersionGroup === versionGroup) render();
    })
    .catch(error => {
      console.warn('Could not preload move details.', error);
    })
    .finally(() => pendingMoveDetailLoads.delete(key));
  pendingMoveDetailLoads.set(key, request);
}

function loadLearnset(pokemon, versionGroup, render) {
  const key = `${pokemon.id}:${versionGroup}`;
  if (pendingLearnsetLoads.has(key)) return;
  const request = getPokemon(pokemon.id, { versionGroup })
    .then(result => {
      if (state.study.pokemonResult?.id === pokemon.id && state.settings.gameVersionGroup === versionGroup) {
        state.study.pokemonResult = result.pokemon;
        render();
      }
    })
    .catch(error => {
      const status = document.querySelector('.pokemon-level-up-moves-status');
      if (status) status.textContent = error?.message ?? 'Could not load level-up moves.';
    })
    .finally(() => pendingLearnsetLoads.delete(key));
  pendingLearnsetLoads.set(key, request);
}

export function enhancePokemonLevelUpMoves(root, render) {
  dismissMoveDetails();
  root.querySelector('.pokemon-level-up-moves')?.remove();
  if (state.route !== 'study' || state.study.mode !== 'pokemon') return;
  const pokemon = state.study.pokemonResult;
  const card = root.querySelector('.pokemon-result-card');
  if (!pokemon || !card) return;
  const versionGroup = state.settings.gameVersionGroup;
  const moves = getLevelUpMoves(pokemon, versionGroup);
  const details = moves === null ? null : moveDetailsByLearnset.get(`${pokemon.id}:${versionGroup}`);
  const section = createMovesSection(pokemon, versionGroup, details);
  const anchor = root.querySelector('.pokemon-offensive-matchups') ?? root.querySelector('.pokemon-defensive-matchups') ?? card;
  anchor.after(section);
  if (moves === null) loadLearnset(pokemon, versionGroup, render);
  else if (moves.length) loadMoveDetails(pokemon, moves, versionGroup, render);
}
