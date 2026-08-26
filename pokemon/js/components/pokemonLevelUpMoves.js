import { state } from '../state.js';
import { getGameVersionGroup } from '../data/gameVersions.js';
import { getMove, getMoves, getMoveVersionData } from '../data/moveRepository.js';
import { getLevelUpMoves, getPokemon } from '../data/pokemonRepository.js';
import { getPokemonInstance, setPokemonInstanceCurrentMove } from '../data/pokemonInstanceRepository.js';
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

function getActiveContext(root) {
  const versionGroup = state.settings.gameVersionGroup;
  if (state.route === 'study' && state.study.mode === 'pokemon' && state.study.pokemonResult) {
    return {
      pokemon: state.study.pokemonResult,
      getComparisonName: () => state.study.moveComparisonPokemonName,
      setComparisonName: value => { state.study.moveComparisonPokemonName = value; },
      isCurrent: pokemonId => state.route === 'study'
        && state.study.pokemonResult?.id === pokemonId
        && state.settings.gameVersionGroup === versionGroup,
      updatePokemon: pokemon => { state.study.pokemonResult = pokemon; },
      supportsCurrentMoves: false,
      insertSection: (section, card) => {
        const anchor = root.querySelector('.pokemon-offensive-matchups') ?? root.querySelector('.pokemon-defensive-matchups') ?? card;
        anchor?.after(section);
      }
    };
  }
  if (state.route === 'owned-pokemon' && state.ownedPokemonDetail?.pokemon) {
    const instanceId = state.ownedPokemonDetail.instanceId;
    return {
      pokemon: state.ownedPokemonDetail.pokemon,
      getComparisonName: () => state.ownedPokemonDetail.moveComparisonPokemonName,
      setComparisonName: value => { state.ownedPokemonDetail.moveComparisonPokemonName = value; },
      isCurrent: pokemonId => state.route === 'owned-pokemon'
        && state.ownedPokemonDetail.instanceId === instanceId
        && state.ownedPokemonDetail.pokemon?.id === pokemonId
        && state.settings.gameVersionGroup === versionGroup,
      updatePokemon: pokemon => { state.ownedPokemonDetail.pokemon = pokemon; },
      supportsCurrentMoves: true,
      getCurrentMoves: () => getPokemonInstance(instanceId)?.currentMoves ?? [],
      setCurrentMove: (moveName, selected) => Boolean(setPokemonInstanceCurrentMove(instanceId, moveName, selected)),
      insertSection: section => { root.querySelector('.owned-pokemon-detail-page')?.append(section); }
    };
  }
  return null;
}
function createComparisonControl(pokemon, render, context) {
  const options = getEvolutionOptions(pokemon);
  if (!options.length) return null;
  if (!options.some(option => option.name === context.getComparisonName())) {
    context.setComparisonName(null);
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
    entry.selected = option.name === context.getComparisonName();
    select.append(entry);
  }
  select.addEventListener('change', () => {
    context.setComparisonName(select.value || null);
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

function createCurrentMovesSummary(context, versionGroup) {
  if (!context.supportsCurrentMoves) return null;
  const currentMoves = context.getCurrentMoves();
  const summary = el('div', { className: 'pokemon-current-moves' });
  const heading = el('div', { className: 'pokemon-current-moves-heading' });
  heading.append(
    el('strong', { text: 'Current moves' }),
    el('span', { className: 'muted', text: `${currentMoves.length}/4` })
  );
  summary.append(heading);
  if (!currentMoves.length) {
    summary.append(el('p', { className: 'muted pokemon-current-moves-empty', text: 'Select moves from the table below.' }));
    return summary;
  }
  const list = el('div', { className: 'pokemon-current-moves-list' });
  for (const moveName of currentMoves) {
    const button = el('button', {
      className: 'secondary-button pokemon-level-up-move-button pokemon-current-move-chip',
      text: titleCase(moveName)
    });
    button.type = 'button';
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-label', `Show details for ${titleCase(moveName)}`);
    button.addEventListener('click', () => showMoveDetails(moveName, versionGroup, button));
    list.append(button);
  }
  summary.append(list);
  return summary;
}

function createCurrentMoveButton(move, context, render) {
  if (move.isComparison) return el('span', { className: 'muted', text: '—' });
  const currentMoves = context.getCurrentMoves();
  const selected = currentMoves.includes(move.name);
  const button = el('button', {
    className: 'transparent-button icon-button pokemon-level-up-move-current',
    text: selected ? '✓' : '+'
  });
  button.type = 'button';
  button.setAttribute('aria-pressed', String(selected));
  button.setAttribute('aria-label', `${selected ? 'Remove' : 'Add'} ${move.displayName} ${selected ? 'from' : 'to'} current moves`);
  button.title = button.getAttribute('aria-label');
  button.disabled = !selected && currentMoves.length >= 4;
  button.addEventListener('click', () => {
    if (context.setCurrentMove(move.name, !selected)) render();
  });
  return button;
}

function createMovesTable(rows, versionGroup, moveDetailsByPokemonId, render, context) {
  const table = el('table', { className: 'pokemon-level-up-moves-table' });
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  const labels = context.supportsCurrentMoves ? ['Level', 'Move', 'Type', 'Current', 'Star'] : ['Level', 'Move', 'Type', 'Star'];
  for (const label of labels) {
    const heading = el('th', { text: label === 'Star' ? '★' : label });
    if (label === 'Star') {
      heading.className = 'pokemon-level-up-move-star-column';
      heading.setAttribute('aria-label', 'Starred');
      heading.title = 'Starred';
    } else if (label === 'Current') {
      heading.className = 'pokemon-level-up-move-current-column';
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
    if (context.supportsCurrentMoves) {
      const current = document.createElement('td');
      current.className = 'pokemon-level-up-move-current-cell';
      current.append(createCurrentMoveButton(move, context, render));
      row.append(current);
    }
    const star = document.createElement('td');
    star.className = 'pokemon-level-up-move-star-cell';
    star.append(createStarButton(move.name, move.displayName, render));
    row.append(star);
    body.append(row);
  }
  table.append(head, body);
  return table;
}

function createMovesSection(pokemon, versionGroup, currentDetails, comparison, comparisonStatus, render, context) {
  const game = getGameVersionGroup(versionGroup);
  const section = el('section', { className: 'panel pokemon-level-up-moves' });
  section.append(el('h3', { text: 'Moves learned by level' }));
  section.append(el('p', { className: 'muted pokemon-level-up-moves-intro', text: game.label }));
  const currentMovesSummary = createCurrentMovesSummary(context, versionGroup);
  if (currentMovesSummary) section.append(currentMovesSummary);
  const comparisonControl = createComparisonControl(pokemon, render, context);
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
  section.append(createMovesTable(rows, versionGroup, detailsByPokemonId, render, context));
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

function loadLearnset(pokemon, versionGroup, render, context) {
  const key = `${pokemon.id}:${versionGroup}`;
  if (pendingLearnsetLoads.has(key)) return;
  const request = getPokemon(pokemon.id, { versionGroup })
    .then(result => {
      if (context.isCurrent(pokemon.id) && state.settings.gameVersionGroup === versionGroup) {
        context.updatePokemon(result.pokemon);
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

function loadComparisonPokemon(pokemon, comparisonName, versionGroup, render, context) {
  const key = getComparisonKey(pokemon, comparisonName, versionGroup);
  if (comparisonPokemonByKey.has(key) || pendingLearnsetLoads.has(key)) return;
  const request = getPokemon(comparisonName, { versionGroup })
    .then(result => {
      comparisonPokemonByKey.set(key, { pokemon: result.pokemon, error: null });
      if (context.isCurrent(pokemon.id)
        && context.getComparisonName() === comparisonName
        && state.settings.gameVersionGroup === versionGroup) render();
    })
    .catch(error => {
      comparisonPokemonByKey.set(key, { pokemon: null, error });
      if (context.isCurrent(pokemon.id)
        && context.getComparisonName() === comparisonName
        && state.settings.gameVersionGroup === versionGroup) render();
    })
    .finally(() => pendingLearnsetLoads.delete(key));
  pendingLearnsetLoads.set(key, request);
}

export function enhancePokemonLevelUpMoves(root, render) {
  dismissMoveDetails();
  root.querySelector('.pokemon-level-up-moves')?.remove();
  const context = getActiveContext(root);
  if (!context) return;
  const pokemon = context.pokemon;
  const card = root.querySelector('.pokemon-result-card');
  const versionGroup = state.settings.gameVersionGroup;
  const moves = getLevelUpMoves(pokemon, versionGroup);
  const currentDetails = moves === null ? null : moveDetailsByLearnset.get(`${pokemon.id}:${versionGroup}`);

  const options = getEvolutionOptions(pokemon);
  if (!options.some(option => option.name === context.getComparisonName())) {
    context.setComparisonName(null);
  }
  const comparisonName = context.getComparisonName();
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

  const section = createMovesSection(pokemon, versionGroup, currentDetails, comparison, comparisonStatus, render, context);
  context.insertSection(section, card);

  if (moves === null) loadLearnset(pokemon, versionGroup, render, context);
  else if (moves.length) {
    loadMoveDetails(pokemon, moves, versionGroup, render, () =>
      context.isCurrent(pokemon.id) && state.settings.gameVersionGroup === versionGroup
    );
  }
  if (comparisonName && !comparisonEntry) loadComparisonPokemon(pokemon, comparisonName, versionGroup, render, context);
  else if (comparison?.moves.length) {
    loadMoveDetails(comparison.pokemon, comparison.moves, versionGroup, render, () =>
      context.isCurrent(pokemon.id)
      && context.getComparisonName() === comparisonName
      && state.settings.gameVersionGroup === versionGroup
    );
  }
}
