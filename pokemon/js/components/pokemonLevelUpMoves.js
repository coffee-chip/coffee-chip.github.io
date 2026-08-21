import { state } from '../state.js';
import { getGameVersionGroup } from '../data/gameVersions.js';
import { getMove, getMoves, getMoveVersionData } from '../data/moveRepository.js';
import { getLevelUpMoves, getPokemon } from '../data/pokemonRepository.js';
import { isMoveStarred, setMoveStarred } from '../data/starredMoveRepository.js';
import { createTypeIcon } from './typeBadge.js';

let activeMoveKey = null;
let activeMoveBanner = null;
const pendingLearnsetLoads = new Map();
const comparisonPokemonByKey = new Map();
const moveDetailsByLearnset = new Map();
const pendingMoveDetailLoads = new Map();

function el(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text) node.textContent = options.text;
  return node;
}

function titleCase(value) {
  return value.split('-').map(part => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ');
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
  for (const [label, value] of [['Power', formatValue(data.power)], ['Class', titleCase(data.damageClass)], ['Accuracy', formatValue(data.accuracy, '%')]]) {
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

function getEvolutionOptions(pokemon) {
  const options = [];
  for (const entry of pokemon.evolution?.previous ?? []) options.push({ name: entry.name, direction: 'previous' });
  for (const entry of pokemon.evolution?.next ?? []) options.push({ name: entry.name, direction: 'next' });
  const seen = new Set();
  return options.filter(entry => entry.name !== pokemon.name && !seen.has(entry.name) && seen.add(entry.name));
}

function createComparisonControl(pokemon, render) {
  const options = getEvolutionOptions(pokemon);
  if (!options.length) return null;
  if (!options.some(option => option.name === state.study.moveComparisonPokemonName)) {
    state.study.moveComparisonPokemonName = null;
  }

  const label = el('label', { className: 'pokemon-level-up-moves-comparison' });
  label.append(el('span', { text: 'Compare moves with' }));
  const select = document.createElement('select');
  const none = document.createElement('option');
  none.value = '';
  none.textContent = 'No evolution comparison';
  select.append(none);
  for (const option of options) {
    const entry = document.createElement('option');
    entry.value = option.name;
    entry.textContent = `${option.direction === 'previous' ? 'Previous' : 'Next'}: ${titleCase(option.name)}`;
    entry.selected = option.name === state.study.moveComparisonPokemonName;
    select.append(entry);
  }
  select.addEventListener('change', () => {
    state.study.moveComparisonPokemonName = select.value || null;
    render();
  });
  label.append(select);
  return label;
}

function combineMoves(pokemon, moves, comparison) {
  const rows = moves.map(move => ({ ...move, pokemonId: pokemon.id, isComparison: false }));
  if (comparison?.moves) {
    rows.push(...comparison.moves.map(move => ({ ...move, pokemonId: comparison.pokemon.id, isComparison: true })));
  }
  return rows.sort((first, second) =>
    first.level - second.level
    || Number(first.isComparison) - Number(second.isComparison)
    || first.displayName.localeCompare(second.displayName)
  );
}

function createStarButton(moveName, displayName, render) {
  const button = el('button', { className: 'transparent-button icon-button pokemon-level-up-move-star', text: isMoveStarred(moveName) ? '★' : '☆' });
  button.type = 'button';
  button.setAttribute('aria-pressed', String(isMoveStarred(moveName)));
  button.setAttribute('aria-label', `${isMoveStarred(moveName) ? 'Unstar' : 'Star'} ${displayName}`);
  button.title = button.getAttribute('aria-label');
  button.addEventListener('click', () => {
    setMoveStarred(moveName, !isMoveStarred(moveName));
    render();
  });
  return button;
}

function createMovesTable(rows, versionGroup, moveDetailsByPokemonId, render) {
  const table = el('table', { className: 'pokemon-level-up-moves-table' });
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const label of ['Level', 'Move', 'Type', 'Star']) {
    const heading = el('th', { text: label === 'Star' ? '★' : label });
    if (label === 'Star') {
      heading.className = 'pokemon-level-up-move-star-column';
      heading.setAttribute('aria-label', 'Starred');
      heading.title = 'Starred';
    }
    headRow.append(heading);
  }
  head.append(headRow);
  const body = document.createElement('tbody');
  for (const move of rows) {
    const row = document.createElement('tr');
    if (move.isComparison) {
      row.className = 'pokemon-level-up-move-comparison-row';
      row.setAttribute('aria-label', 'Comparison evolution move');
    }
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
    const moveData = getMoveVersionData(moveDetailsByPokemonId.get(move.pokemonId)?.get(move.name), versionGroup);
    type.title = moveData ? `${moveData.type} type` : 'Loading move type';
    if (moveData) type.append(createTypeIcon(moveData.type));
    else type.append(el('span', { className: 'muted', text: '…' }));
    row.append(type);
    const star = document.createElement('td');
    star.className = 'pokemon-level-up-move-star-cell';
    star.append(createStarButton(move.name, move.displayName, render));
    row.append(star);
    body.append(row);
  }
  table.append(head, body);
  return table;
}

function createMovesSection(pokemon, versionGroup, currentDetails, comparison, comparisonStatus, render) {
  const game = getGameVersionGroup(versionGroup);
  const section = el('section', { className: 'panel pokemon-level-up-moves' });
  section.append(el('h3', { text: 'Moves learned by level' }));
  section.append(el('p', { className: 'muted pokemon-level-up-moves-intro', text: game.label }));
  const comparisonControl = createComparisonControl(pokemon, render);
  if (comparisonControl) section.append(comparisonControl);

  const moves = getLevelUpMoves(pokemon, versionGroup);
  if (moves === null) {
    section.append(el('p', { className: 'muted pokemon-level-up-moves-status', text: 'Loading level-up moves…' }));
    return section;
  }
  if (!moves.length) {
    section.append(el('p', { className: 'muted', text: `No level-up moves are recorded for ${game.label}.` }));
    return section;
  }

  const detailsByPokemonId = new Map([[pokemon.id, currentDetails]]);
  if (comparison) detailsByPokemonId.set(
    comparison.pokemon.id,
    moveDetailsByLearnset.get(`${comparison.pokemon.id}:${versionGroup}`)
  );
  const rows = combineMoves(pokemon, moves, comparison);
  section.append(createMovesTable(rows, versionGroup, detailsByPokemonId, render));
  if (comparisonStatus === 'loading') {
    section.append(el('p', { className: 'muted pokemon-level-up-moves-comparison-status', text: 'Loading evolution moves…' }));
  } else if (comparisonStatus === 'error') {
    section.append(el('p', { className: 'muted pokemon-level-up-moves-comparison-status', text: 'Could not load evolution moves.' }));
  }
  return section;
}

function loadMoveDetails(pokemon, moves, versionGroup, render, shouldRender) {
  const key = `${pokemon.id}:${versionGroup}`;
  if (moveDetailsByLearnset.has(key) || pendingMoveDetailLoads.has(key)) return;
  const request = getMoves(moves.map(move => move.name), { versionGroup })
    .then(details => {
      moveDetailsByLearnset.set(key, details);
      if (shouldRender()) render();
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

function getComparisonKey(pokemon, comparisonName, versionGroup) {
  return `${pokemon.id}:${comparisonName}:${versionGroup}`;
}

function loadComparisonPokemon(pokemon, comparisonName, versionGroup, render) {
  const key = getComparisonKey(pokemon, comparisonName, versionGroup);
  if (comparisonPokemonByKey.has(key) || pendingLearnsetLoads.has(key)) return;
  const request = getPokemon(comparisonName, { versionGroup })
    .then(result => {
      comparisonPokemonByKey.set(key, { pokemon: result.pokemon, error: null });
      if (state.study.pokemonResult?.id === pokemon.id
        && state.study.moveComparisonPokemonName === comparisonName
        && state.settings.gameVersionGroup === versionGroup) render();
    })
    .catch(error => {
      comparisonPokemonByKey.set(key, { pokemon: null, error });
      if (state.study.pokemonResult?.id === pokemon.id
        && state.study.moveComparisonPokemonName === comparisonName
        && state.settings.gameVersionGroup === versionGroup) render();
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
  const currentDetails = moves === null ? null : moveDetailsByLearnset.get(`${pokemon.id}:${versionGroup}`);

  const options = getEvolutionOptions(pokemon);
  if (!options.some(option => option.name === state.study.moveComparisonPokemonName)) {
    state.study.moveComparisonPokemonName = null;
  }
  const comparisonName = state.study.moveComparisonPokemonName;
  const comparisonEntry = comparisonName
    ? comparisonPokemonByKey.get(getComparisonKey(pokemon, comparisonName, versionGroup))
    : null;
  const comparisonPokemon = comparisonEntry?.pokemon ?? null;
  const comparisonMoves = comparisonPokemon ? getLevelUpMoves(comparisonPokemon, versionGroup) : null;
  const comparison = comparisonMoves === null ? null : { pokemon: comparisonPokemon, moves: comparisonMoves };
  const comparisonStatus = !comparisonName ? null
    : comparisonEntry?.error ? 'error'
      : comparison ? null
        : 'loading';

  const section = createMovesSection(pokemon, versionGroup, currentDetails, comparison, comparisonStatus, render);
  const anchor = root.querySelector('.pokemon-offensive-matchups') ?? root.querySelector('.pokemon-defensive-matchups') ?? card;
  anchor.after(section);

  if (moves === null) loadLearnset(pokemon, versionGroup, render);
  else if (moves.length) {
    loadMoveDetails(pokemon, moves, versionGroup, render, () =>
      state.study.pokemonResult?.id === pokemon.id && state.settings.gameVersionGroup === versionGroup
    );
  }
  if (comparisonName && !comparisonEntry) loadComparisonPokemon(pokemon, comparisonName, versionGroup, render);
  else if (comparison?.moves.length) {
    loadMoveDetails(comparison.pokemon, comparison.moves, versionGroup, render, () =>
      state.study.pokemonResult?.id === pokemon.id
      && state.study.moveComparisonPokemonName === comparisonName
      && state.settings.gameVersionGroup === versionGroup
    );
  }
}
