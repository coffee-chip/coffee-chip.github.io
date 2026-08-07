import { TYPES } from '../data/types.js';
import { getPokemon } from '../data/pokemonRepository.js';
import { getTeam, removePokemonFromTeam, setTeamOpponent } from '../data/teamRepository.js';
import { getMultiplier, getTypeAdvantageScore } from '../engine/effectiveness.js';
import { state } from '../state.js';
import { createTypeList, createTypeIcon } from '../components/typeBadge.js';

const resolvedPokemon = new Map();
const expandedMembers = new Set();
let loadingTeamId = null;
let activeAnalysisMode = 'defense';
const activeAnalysisRelationship = { defense: 'weak', offense: 'strong' };

function el(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text) node.textContent = options.text;
  return node;
}

function memberExpansionKey(teamId, pokemonId) {
  return `${teamId}:${pokemonId}`;
}

function createBackLink() {
  const link = el('a', { className: 'secondary-button team-detail-back', text: '← Teams' });
  link.href = '#teams';
  return link;
}

function createOpponentToggle(team, render) {
  const label = el('label', { className: 'toggle-field team-opponent-toggle' });
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = team.isOpponent === true;
  input.addEventListener('change', () => {
    if (setTeamOpponent(team.id, input.checked)) render();
  });
  label.append(input, el('span', { text: 'Opponent' }));
  return label;
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
    if (removePokemonFromTeam(team.id, member.id)) {
      expandedMembers.delete(memberExpansionKey(team.id, member.id));
      render();
    }
  });
  actions.append(cancel, confirm);
  confirmation.append(message, actions);
  card.append(confirmation);
}

function createAdvantageIconList(types) {
  const list = el('span', { className: 'team-member-advantage-icons' });
  if (!types.length) {
    list.append(el('span', { className: 'muted', text: 'None' }));
    return list;
  }
  for (const type of types) {
    const icon = createTypeIcon(type, { className: 'team-member-advantage-icon' });
    icon.setAttribute('aria-label', `${type} type`);
    icon.setAttribute('role', 'img');
    const wrapper = el('span', { className: 'team-member-advantage-icon-wrap' });
    wrapper.title = type;
    wrapper.append(icon);
    list.append(wrapper);
  }
  return list;
}

function createMemberAdvantagePanel(pokemon) {
  const positive = [];
  const negative = [];
  for (const type of TYPES) {
    const score = getTypeAdvantageScore(pokemon.types, type);
    if (score > 0) positive.push(type);
    else if (score < 0) negative.push(type);
  }

  const panel = el('section', { className: 'team-member-advantage-panel' });
  const positiveRow = el('div', { className: 'team-member-advantage-row' });
  positiveRow.append(el('strong', { text: 'Advantage' }), createAdvantageIconList(positive));
  const negativeRow = el('div', { className: 'team-member-advantage-row' });
  negativeRow.append(el('strong', { text: 'Disadvantage' }), createAdvantageIconList(negative));
  panel.append(positiveRow, negativeRow);
  return panel;
}

function createMemberCard(team, member, render) {
  const pokemon = resolvedPokemon.get(member.id) ?? member;
  const expansionKey = memberExpansionKey(team.id, member.id);
  const expanded = expandedMembers.has(expansionKey);
  const hasTypes = Array.isArray(pokemon.types) && pokemon.types.length;
  const card = el('article', { className: `panel team-detail-member${expanded ? ' team-detail-member-expanded' : ''}` });

  const visual = el('div', { className: 'team-detail-member-visual' });
  if (pokemon.spriteUrl) {
    const image = document.createElement('img');
    image.src = pokemon.spriteUrl;
    image.alt = pokemon.displayName;
    image.loading = 'lazy';
    visual.append(image);
  }

  const details = el('button', { className: 'transparent-button team-detail-member-details' });
  details.type = 'button';
  details.disabled = !hasTypes;
  details.setAttribute('aria-expanded', String(expanded));
  details.setAttribute('aria-label', `${expanded ? 'Collapse' : 'Expand'} type advantage summary for ${pokemon.displayName}`);
  details.append(el('strong', { text: pokemon.displayName }));
  if (hasTypes) details.append(createTypeList(pokemon.types));
  else details.append(el('span', { className: 'muted', text: 'Loading types…' }));
  const disclosure = el('span', { className: 'team-member-disclosure', text: expanded ? '▲' : '▼' });
  disclosure.setAttribute('aria-hidden', 'true');
  details.append(disclosure);
  details.addEventListener('click', () => {
    if (expanded) expandedMembers.delete(expansionKey);
    else expandedMembers.add(expansionKey);
    render();
  });

  const remove = el('button', { className: 'danger-button team-delete-button team-detail-remove', text: '×' });
  remove.type = 'button';
  remove.setAttribute('aria-label', `Remove ${pokemon.displayName} from ${team.title}`);
  remove.title = 'Remove from team';
  remove.addEventListener('click', () => createMemberRemoveConfirmation(team, member, pokemon, card, render));

  card.append(visual, details, remove);
  if (expanded && hasTypes) card.append(createMemberAdvantagePanel(pokemon));
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

function getRelationshipRole(mode, relationship, isOpponent) {
  const favorableToTeam = (mode === 'defense' && relationship === 'resistant')
    || (mode === 'offense' && relationship === 'strong');
  const favorableToUser = isOpponent ? !favorableToTeam : favorableToTeam;
  return favorableToUser ? 'success' : 'danger';
}

function createMatchupCell(marked, label, role) {
  const cell = document.createElement('td');
  if (!marked) return cell;
  const mark = el('span', { className: `team-matchup-check team-matchup-check-${role}`, text: '✓' });
  mark.setAttribute('aria-label', label);
  cell.append(mark);
  return cell;
}

function getAnalysisCaption(mode, relationship) {
  if (mode === 'defense') {
    return relationship === 'weak'
      ? 'Incoming move types that are super effective against each Pokémon.'
      : 'Incoming move types that each Pokémon resists or is immune to.';
  }
  return relationship === 'strong'
    ? 'Defending types that at least one of each Pokémon’s own move types is super effective against.'
    : 'Defending types that resist or are immune to all of each Pokémon’s own move types.';
}

function getMatchupResult(member, type, mode, relationship) {
  if (mode === 'defense') {
    const multiplier = getMultiplier(type, member.types);
    const marked = relationship === 'weak' ? multiplier > 1 : multiplier < 1;
    return { marked, label: `${type} moves deal ${multiplier}× damage to ${member.displayName}` };
  }

  const multipliers = member.types.map(attackingType => ({
    attackingType,
    multiplier: getMultiplier(attackingType, [type])
  }));
  if (relationship === 'strong') {
    const effective = multipliers.filter(entry => entry.multiplier > 1);
    return {
      marked: effective.length > 0,
      label: `${member.displayName}: ${effective.map(entry => entry.attackingType).join(' or ')} moves are super effective against ${type}`
    };
  }

  return {
    marked: multipliers.every(entry => entry.multiplier < 1),
    label: `${member.displayName}: all own-type moves are resisted or ineffective against ${type}`
  };
}

function createAnalysisTable(pokemon, mode, relationship, role) {
  const wrapper = el('div', { className: 'team-matchup-table-scroll' });
  const table = el('table', { className: `team-matchup-table team-matchup-table-${role}` });
  const caption = document.createElement('caption');
  caption.textContent = getAnalysisCaption(mode, relationship);
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
      const result = getMatchupResult(member, type, mode, relationship);
      row.append(createMatchupCell(result.marked, result.label, role));
    }
    body.append(row);
  }
  table.append(body);
  wrapper.append(table);
  return wrapper;
}

function createAnalysisSelector(className, label, options, activeValue, onChange, roleForOption = null) {
  const selector = el('div', { className });
  selector.setAttribute('role', 'tablist');
  selector.setAttribute('aria-label', label);
  for (const option of options) {
    const role = roleForOption?.(option.value) ?? null;
    const active = option.value === activeValue;
    const roleClass = role ? ` team-analysis-status-${role}` : '';
    const activeClass = active ? ' team-analysis-status-active' : '';
    const button = el('button', {
      className: `${active && !role ? 'primary-button' : 'secondary-button'}${roleClass}${activeClass}`,
      text: option.label
    });
    button.type = 'button';
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(active));
    button.addEventListener('click', () => onChange(option.value));
    selector.append(button);
  }
  return selector;
}

function createAnalysis(team, render) {
  const section = el('section', { className: 'team-analysis' });
  section.append(createAnalysisSelector(
    'team-analysis-tabs',
    'Team matchup direction',
    [{ value: 'defense', label: 'Defense' }, { value: 'offense', label: 'Offense' }],
    activeAnalysisMode,
    mode => { activeAnalysisMode = mode; render(); }
  ));

  const relationshipOptions = activeAnalysisMode === 'defense'
    ? [{ value: 'weak', label: 'Weak' }, { value: 'resistant', label: 'Resistant' }]
    : [{ value: 'strong', label: 'Strong' }, { value: 'weak', label: 'Weak' }];
  const relationship = activeAnalysisRelationship[activeAnalysisMode];
  const roleForRelationship = value => getRelationshipRole(activeAnalysisMode, value, team.isOpponent === true);
  section.append(createAnalysisSelector(
    'team-analysis-relationship-tabs',
    `${activeAnalysisMode} matchup relationship`,
    relationshipOptions,
    relationship,
    value => { activeAnalysisRelationship[activeAnalysisMode] = value; render(); },
    roleForRelationship
  ));

  const pokemon = team.pokemon
    .map(member => resolvedPokemon.get(member.id))
    .filter(member => Array.isArray(member?.types) && member.types.length);
  if (pokemon.length !== team.pokemon.length) {
    section.append(el('p', { className: 'muted', text: 'Loading matchup data…' }));
  } else if (!pokemon.length) {
    section.append(el('p', { className: 'muted', text: 'Add Pokémon to this team to analyze its matchups.' }));
  } else {
    section.append(createAnalysisTable(
      pokemon,
      activeAnalysisMode,
      relationship,
      roleForRelationship(relationship)
    ));
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

  const heading = el('div', { className: 'team-detail-heading' });
  heading.append(
    el('h2', { className: `team-detail-title${team.isOpponent ? ' team-detail-title-opponent' : ''}`, text: team.title }),
    createOpponentToggle(team, render)
  );
  page.append(heading);

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
