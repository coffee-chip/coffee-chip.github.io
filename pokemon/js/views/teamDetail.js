import { TYPES } from '../data/types.js';
import { getPokemon } from '../data/pokemonRepository.js';
import { getTeam, removePokemonFromTeam } from '../data/teamRepository.js';
import { getMultiplier } from '../engine/effectiveness.js';
import { state } from '../state.js';
import { createTypeList, createTypeIcon } from '../components/typeBadge.js';

const resolvedPokemon = new Map();
let loadingTeamId = null;
let activeAnalysisMode = 'defense';

function el(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text) node.textContent = options.text;
  return node;
}

function createBackLink() {
  const link = el('a', { className: 'secondary-button team-detail-back', text: '← Teams' });
  link.href = '#teams';
  return link;
}

function createMemberRemoveConfirmation(team, member, pokemon, card, render) {
  card.querySelector('.team-delete-confirmation')?.remove();
  const confirmation = el('div', { className: 'team-delete-confirmation' });
  const message = el('span', { text: `Remove ${pokemon.displayName} from “${team.title}”?` });
  const actions = el('div', { className: 'team-delete-actions' });
  const cancel = el('button', { className: 'secondary-button', text: 'Cancel' });
  cancel.type = 'button';
  cancel.addEventListener('click', () => confirmation.remove());
  const confirm = el('button', { className: 'danger-button', text: 'Remove' });
  confirm.type = 'button';
  confirm.addEventListener('click', () => {
    if (removePokemonFromTeam(team.id, member.id)) render();
  });
  actions.append(cancel, confirm);
  confirmation.append(message, actions);
  card.append(confirmation);
}

function createMemberCard(team, member, render) {
  const pokemon = resolvedPokemon.get(member.id) ?? member;
  const card = el('article', { className: 'panel team-detail-member' });
  const visual = el('div', { className: 'team-detail-member-visual' });
  if (pokemon.spriteUrl) {
    const image = document.createElement('img');
    image.src = pokemon.spriteUrl;
    image.alt = pokemon.displayName;
    image.loading = 'lazy';
    visual.append(image);
  }

  const details = el('div', { className: 'team-detail-member-details' });
  details.append(el('strong', { text: pokemon.displayName }));
  if (Array.isArray(pokemon.types) && pokemon.types.length) {
    details.append(createTypeList(pokemon.types));
  } else {
    details.append(el('span', { className: 'muted', text: 'Loading types…' }));
  }

  const remove = el('button', { className: 'danger-button team-delete-button team-detail-remove', text: '×' });
  remove.type = 'button';
  remove.setAttribute('aria-label', `Remove ${pokemon.displayName} from ${team.title}`);
  remove.title = 'Remove from team';
  remove.addEventListener('click', () => createMemberRemoveConfirmation(team, member, pokemon, card, render));

  card.append(visual, details, remove);
  return card;
}

function createPokemonColumnHeader(pokemon) {
  const header = document.createElement('th');
  header.scope = 'col';
  const content = el('span', { className: 'team-matchup-pokemon' });
  if (pokemon.spriteUrl) {
    const image = document.createElement('img');
    image.src = pokemon.spriteUrl;
    image.alt = '';
    image.loading = 'lazy';
    content.append(image);
  }
  content.append(el('span', { className: 'team-matchup-pokemon-name', text: pokemon.displayName }));
  header.append(content);
  return header;
}

function createMatchupCell(marked, label) {
  const cell = document.createElement('td');
  if (!marked) return cell;
  const mark = el('span', { className: 'team-matchup-check', text: '✓' });
  mark.setAttribute('aria-label', label);
  cell.append(mark);
  return cell;
}

function createAnalysisTable(pokemon, mode) {
  const wrapper = el('div', { className: 'team-matchup-table-scroll' });
  const table = el('table', { className: 'team-matchup-table' });
  const caption = document.createElement('caption');
  caption.textContent = mode === 'defense'
    ? 'Incoming move types that are super effective against each Pokémon.'
    : 'Defending types that at least one of each Pokémon’s own move types is super effective against.';
  table.append(caption);

  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  const corner = document.createElement('th');
  corner.scope = 'col';
  corner.setAttribute('aria-label', 'Type');
  headRow.append(corner);
  for (const member of pokemon) headRow.append(createPokemonColumnHeader(member));
  head.append(headRow);
  table.append(head);

  const body = document.createElement('tbody');
  for (const type of TYPES) {
    const row = document.createElement('tr');
    const typeHeader = document.createElement('th');
    typeHeader.scope = 'row';
    typeHeader.title = type;
    typeHeader.setAttribute('aria-label', `${type} type`);
    typeHeader.append(createTypeIcon(type, { className: 'team-matchup-type-icon' }));
    row.append(typeHeader);

    for (const member of pokemon) {
      if (mode === 'defense') {
        const multiplier = getMultiplier(type, member.types);
        row.append(createMatchupCell(multiplier > 1, `${type} moves deal ${multiplier}× damage to ${member.displayName}`));
      } else {
        const effectiveTypes = member.types.filter(attackingType => getMultiplier(attackingType, [type]) > 1);
        row.append(createMatchupCell(
          effectiveTypes.length > 0,
          `${member.displayName}: ${effectiveTypes.join(' or ')} moves are super effective against ${type}`
        ));
      }
    }
    body.append(row);
  }
  table.append(body);
  wrapper.append(table);
  return wrapper;
}

function createAnalysis(team, render) {
  const section = el('section', { className: 'team-analysis' });
  const tabs = el('div', { className: 'team-analysis-tabs' });
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Team matchup analysis');

  for (const mode of ['defense', 'offense']) {
    const button = el('button', {
      className: mode === activeAnalysisMode ? 'primary-button' : 'secondary-button',
      text: mode === 'defense' ? 'Defense' : 'Offense'
    });
    button.type = 'button';
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(mode === activeAnalysisMode));
    button.addEventListener('click', () => {
      activeAnalysisMode = mode;
      render();
    });
    tabs.append(button);
  }
  section.append(tabs);

  const pokemon = team.pokemon
    .map(member => resolvedPokemon.get(member.id))
    .filter(member => Array.isArray(member?.types) && member.types.length);
  if (pokemon.length !== team.pokemon.length) {
    section.append(el('p', { className: 'muted', text: 'Loading matchup data…' }));
  } else if (!pokemon.length) {
    section.append(el('p', { className: 'muted', text: 'Add Pokémon to this team to analyze its matchups.' }));
  } else {
    section.append(createAnalysisTable(pokemon, activeAnalysisMode));
  }
  return section;
}

async function loadTeamPokemon(team, render) {
  if (!team.pokemon.length || loadingTeamId === team.id) return;
  const unresolved = team.pokemon.filter(member => !resolvedPokemon.has(member.id));
  if (!unresolved.length) return;
  loadingTeamId = team.id;
  await Promise.all(unresolved.map(async member => {
    try {
      const result = await getPokemon(member.id);
      resolvedPokemon.set(member.id, result.pokemon);
    } catch (error) {
      console.warn(`Could not load ${member.displayName} for team analysis.`, error);
    }
  }));
  loadingTeamId = null;
  if (state.route === 'team' && state.routeParams.teamId === team.id) render();
}

export function renderTeamDetail(container, render) {
  const team = getTeam(state.routeParams.teamId);
  const page = el('section', { className: 'page team-detail-page' });
  page.append(createBackLink());

  if (!team) {
    const panel = el('section', { className: 'panel' });
    panel.append(el('p', { className: 'muted', text: 'That team no longer exists.' }));
    page.append(panel);
    container.replaceChildren(page);
    return;
  }

  page.append(el('h2', { className: 'team-detail-title', text: team.title }));
  const roster = el('section', { className: 'team-detail-roster' });
  if (!team.pokemon.length) {
    roster.append(el('p', { className: 'panel muted', text: 'This team has no Pokémon yet.' }));
  } else {
    for (const member of team.pokemon) roster.append(createMemberCard(team, member, render));
  }
  page.append(roster, createAnalysis(team, render));
  container.replaceChildren(page);
  loadTeamPokemon(team, render);
}
