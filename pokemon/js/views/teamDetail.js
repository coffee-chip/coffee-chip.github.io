import { TYPES } from '../data/types.js';
import { getPokemon } from '../data/pokemonRepository.js';
import { getTeam, removePokemonFromTeam, reorderPokemonInTeam, setTeamPokemonAlias } from '../data/teamRepository.js';
import { getMultiplier, getTypeAdvantageScore } from '../engine/effectiveness.js';
import { state } from '../state.js';
import { createTypeList, createTypeIcon } from '../components/typeBadge.js';
import { createTeamActionsButton } from '../components/teamActionsMenu.js';

const resolvedPokemon = new Map();
const expandedMembers = new Set();
let loadingTeamId = null;
let activeTeamDetailMode = 'members';
let activeAnalysisMode = 'defense';
const activeAnalysisRelationships = { defense: new Set(['weak']), offense: new Set(['strong']) };

function el(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text) node.textContent = options.text;
  return node;
}

function memberExpansionKey(teamId, pokemonId) { return `${teamId}:${pokemonId}`; }
function getTeamMemberPokemon(member) {
  const resolved = resolvedPokemon.get(member.id);
  if (!resolved) return member;
  return { ...resolved, displayName: member.displayName || resolved.displayName };
}
function createBackLink() {
  const link = el('a', { className: 'secondary-button team-detail-back', text: '← Teams' });
  link.href = '#teams';
  return link;
}
function createTeamDetailTabs(render) {
  const tabs = el('div', { className: 'button-selector button-selector-three-column team-detail-tabs' });
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Team detail view');
  for (const [value, label] of [['members', 'Members'], ['matchups', 'Matchups'], ['advantage', 'Advantage']]) {
    const button = el('button', { className: 'secondary-button button-selector-option team-detail-tab', text: label });
    button.type = 'button';
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(activeTeamDetailMode === value));
    button.addEventListener('click', () => { if (activeTeamDetailMode !== value) { activeTeamDetailMode = value; render(); } });
    tabs.append(button);
  }
  return tabs;
}
function createMemberRemoveConfirmation(team, member, pokemon, card, render) {
  card.querySelector('.team-delete-confirmation')?.remove();
  const confirmation = el('div', { className: 'team-delete-confirmation' });
  const message = el('span', { text: `Remove ${pokemon.displayName} from “${team.title}”?` });
  const actions = el('div', { className: 'team-delete-actions' });
  const cancel = el('button', { className: 'secondary-button', text: 'Cancel' });
  const confirm = el('button', { className: 'danger-button', text: 'Remove' });
  cancel.type = confirm.type = 'button';
  cancel.addEventListener('click', () => confirmation.remove());
  confirm.addEventListener('click', () => {
    if (removePokemonFromTeam(team.id, member.id)) { expandedMembers.delete(memberExpansionKey(team.id, member.id)); render(); }
  });
  actions.append(cancel, confirm);
  confirmation.append(message, actions);
  card.append(confirmation);
}
function createMemberEditForm(team, member, pokemon, canonicalDisplayName, card, render) {
  card.querySelector('.team-member-edit-form')?.remove();
  const form = el('form', { className: 'team-member-edit-form' });
  const input = document.createElement('input');
  input.type = 'text'; input.maxLength = 60; input.value = member.displayName || pokemon.displayName; input.placeholder = canonicalDisplayName;
  input.setAttribute('aria-label', `Name for ${canonicalDisplayName} on ${team.title}`);
  const actions = el('div', { className: 'team-member-edit-actions' });
  const cancel = el('button', { className: 'secondary-button', text: 'Cancel' });
  const save = el('button', { className: 'primary-button', text: 'Save' });
  cancel.type = 'button'; save.type = 'submit';
  cancel.addEventListener('click', () => form.remove());
  form.addEventListener('submit', event => { event.preventDefault(); if (setTeamPokemonAlias(team.id, member.id, input.value, canonicalDisplayName)) render(); });
  actions.append(cancel, save); form.append(input, actions); card.append(form); input.focus(); input.select();
}
function createAdvantageIconList(types) {
  const list = el('span', { className: 'team-member-advantage-icons' });
  if (!types.length) { list.append(el('span', { className: 'muted', text: 'None' })); return list; }
  for (const type of types) {
    const icon = createTypeIcon(type, { className: 'team-member-advantage-icon' });
    icon.setAttribute('aria-label', `${type} type`); icon.setAttribute('role', 'img');
    const wrapper = el('span', { className: 'team-member-advantage-icon-wrap' }); wrapper.title = type; wrapper.append(icon); list.append(wrapper);
  }
  return list;
}
function createMemberAdvantagePanel(pokemon) {
  const positive = [], negative = [];
  for (const type of TYPES) { const score = getTypeAdvantageScore(pokemon.types, type); if (score > 0) positive.push(type); else if (score < 0) negative.push(type); }
  const panel = el('section', { className: 'team-member-advantage-panel' });
  const positiveRow = el('div', { className: 'team-member-advantage-row' });
  const negativeRow = el('div', { className: 'team-member-advantage-row' });
  positiveRow.append(el('strong', { text: 'Advantage' }), createAdvantageIconList(positive));
  negativeRow.append(el('strong', { text: 'Disadvantage' }), createAdvantageIconList(negative));
  panel.append(positiveRow, negativeRow); return panel;
}
function createMemberCard(team, member, index, render) {
  const pokemon = getTeamMemberPokemon(member);
  const canonicalDisplayName = resolvedPokemon.get(member.id)?.displayName ?? member.displayName;
  const expansionKey = memberExpansionKey(team.id, member.id), expanded = expandedMembers.has(expansionKey);
  const hasTypes = Array.isArray(pokemon.types) && pokemon.types.length;
  const card = el('article', { className: `panel team-detail-member${expanded ? ' team-detail-member-expanded' : ''}` }); card.dataset.memberIndex = String(index);
  const visual = el('div', { className: 'team-detail-member-visual' });
  if (pokemon.spriteUrl) { const image = document.createElement('img'); image.src = pokemon.spriteUrl; image.alt = pokemon.displayName; image.loading = 'lazy'; visual.append(image); }
  const content = el('div', { className: 'team-detail-member-content' });
  const header = el('div', { className: 'team-detail-member-header' });
  const name = el('strong', { className: 'team-detail-member-name', text: pokemon.displayName });
  const actions = el('div', { className: 'team-detail-member-actions' });
  const edit = el('button', { className: 'secondary-button team-member-action-button team-detail-edit', text: '✎' });
  const remove = el('button', { className: 'danger-button team-delete-button team-detail-remove', text: '×' });
  const handle = el('span', { className: 'team-drag-handle team-member-drag-handle', text: '↕' });
  edit.type = remove.type = 'button'; edit.setAttribute('aria-label', `Edit name for ${pokemon.displayName}`); edit.title = 'Edit team name';
  edit.addEventListener('click', () => createMemberEditForm(team, member, pokemon, canonicalDisplayName, card, render));
  remove.setAttribute('aria-label', `Remove ${pokemon.displayName} from ${team.title}`); remove.title = 'Remove from team';
  remove.addEventListener('click', () => createMemberRemoveConfirmation(team, member, pokemon, card, render));
  handle.setAttribute('aria-label', `Drag to reorder ${pokemon.displayName}`); handle.title = 'Drag to reorder';
  actions.append(edit, remove, handle); header.append(name, actions);
  const details = el('button', { className: 'transparent-button team-detail-member-details' });
  details.type = 'button'; details.disabled = !hasTypes; details.setAttribute('aria-expanded', String(expanded)); details.setAttribute('aria-label', `${expanded ? 'Collapse' : 'Expand'} type advantage summary for ${pokemon.displayName}`);
  if (hasTypes) details.append(createTypeList(pokemon.types)); else details.append(el('span', { className: 'muted', text: 'Loading types…' }));
  details.addEventListener('click', () => { expanded ? expandedMembers.delete(expansionKey) : expandedMembers.add(expansionKey); render(); });
  content.append(header, details); card.append(visual, content); if (expanded && hasTypes) card.append(createMemberAdvantagePanel(pokemon));
  let holdTimer = null, dragging = false, pointerId = null, proposedIndex = index, insertionMarker = null;
  function removeInsertionMarker() { insertionMarker?.remove(); insertionMarker = null; }
  function updateInsertionMarker(clientY) {
    const roster = card.closest('.team-detail-roster'); if (!roster) return;
    const otherCards = [...roster.querySelectorAll('.team-detail-member')].filter(candidate => candidate !== card);
    let insertionIndex = otherCards.length, insertBefore = null;
    for (let candidateIndex = 0; candidateIndex < otherCards.length; candidateIndex += 1) { const candidate = otherCards[candidateIndex], bounds = candidate.getBoundingClientRect(); if (clientY < bounds.top + bounds.height / 2) { insertionIndex = candidateIndex; insertBefore = candidate; break; } }
    proposedIndex = insertionIndex; insertionMarker ??= el('div', { className: 'team-insertion-marker' }); if (insertBefore) roster.insertBefore(insertionMarker, insertBefore); else roster.append(insertionMarker);
  }
  function stopDrag() {
    window.clearTimeout(holdTimer); holdTimer = null; if (pointerId !== null && handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId); pointerId = null;
    if (!dragging) return; dragging = false; card.classList.remove('team-card-dragging'); removeInsertionMarker(); if (proposedIndex !== index) reorderPokemonInTeam(team.id, index, proposedIndex); render();
  }
  handle.addEventListener('pointerdown', event => { if (event.button !== 0) return; pointerId = event.pointerId; proposedIndex = index; handle.setPointerCapture(pointerId); holdTimer = window.setTimeout(() => { dragging = true; card.classList.add('team-card-dragging'); updateInsertionMarker(event.clientY); }, event.pointerType === 'touch' ? 300 : 0); });
  handle.addEventListener('pointermove', event => { if (!dragging) return; event.preventDefault(); updateInsertionMarker(event.clientY); });
  handle.addEventListener('pointerup', stopDrag); handle.addEventListener('pointercancel', stopDrag); handle.addEventListener('lostpointercapture', stopDrag);
  return card;
}
function createRoster(team, render) {
  const roster = el('section', { className: 'team-detail-roster' });
  if (!team.pokemon.length) roster.append(el('p', { className: 'panel muted', text: 'This team has no Pokémon yet.' }));
  else team.pokemon.forEach((member, index) => roster.append(createMemberCard(team, member, index, render)));
  return roster;
}
function createPokemonColumnHeader(pokemon) {
  const header = document.createElement('th'); header.scope = 'col'; const content = el('span', { className: 'team-matchup-pokemon' });
  if (pokemon.spriteUrl) { const image = document.createElement('img'); image.src = pokemon.spriteUrl; image.alt = ''; image.loading = 'lazy'; content.append(image); }
  content.append(el('span', { className: 'team-matchup-pokemon-name', text: pokemon.displayName })); header.append(content); return header;
}
function getRelationshipRole(mode, relationship, isOpponent) {
  const favorableToTeam = (mode === 'defense' && relationship === 'resistant') || (mode === 'offense' && relationship === 'strong');
  return (isOpponent ? !favorableToTeam : favorableToTeam) ? 'success' : 'danger';
}
function createMatchupCell(results) {
  const cell = document.createElement('td'), result = results.find(candidate => candidate.marked); if (!result) return cell;
  const mark = el('span', { className: `team-matchup-dot team-matchup-dot-${result.role}` }); mark.setAttribute('aria-label', result.label); mark.title = result.label; cell.append(mark); return cell;
}
function getAnalysisCaption(mode, relationships) {
  const selected = [...relationships]; if (!selected.length) return 'Select one or both matchup relationships to display.';
  if (selected.length === 2) return mode === 'defense' ? 'Incoming move types each Pokémon is weak to or resists.' : 'Defending types each Pokémon is strong or weak against.';
  const relationship = selected[0]; if (mode === 'defense') return relationship === 'weak' ? 'Incoming move types that are super effective against each Pokémon.' : 'Incoming move types that each Pokémon resists or is immune to.';
  return relationship === 'strong' ? 'Defending types that at least one of each Pokémon’s own move types is super effective against.' : 'Defending types that resist or are immune to all of each Pokémon’s own move types.';
}
function getMatchupResult(member, type, mode, relationship) {
  if (mode === 'defense') { const multiplier = getMultiplier(type, member.types); return { marked: relationship === 'weak' ? multiplier > 1 : multiplier < 1, label: `${type} moves deal ${multiplier}× damage to ${member.displayName}` }; }
  const multipliers = member.types.map(attackingType => ({ attackingType, multiplier: getMultiplier(attackingType, [type]) }));
  if (relationship === 'strong') { const effective = multipliers.filter(entry => entry.multiplier > 1); return { marked: effective.length > 0, label: `${member.displayName}: ${effective.map(entry => entry.attackingType).join(' or ')} moves are super effective against ${type}` }; }
  return { marked: multipliers.every(entry => entry.multiplier < 1), label: `${member.displayName}: all own-type moves are resisted or ineffective against ${type}` };
}
function getResolvedTeamPokemon(team) {
  return team.pokemon.map(member => { const resolved = resolvedPokemon.get(member.id); return resolved ? { ...resolved, displayName: member.displayName || resolved.displayName } : null; }).filter(member => Array.isArray(member?.types) && member.types.length);
}
function createAnalysisTable(pokemon, mode, relationships, team) {
  const wrapper = el('div', { className: 'team-matchup-table-scroll' }), table = el('table', { className: 'team-matchup-table' }), caption = document.createElement('caption'); caption.textContent = getAnalysisCaption(mode, relationships); table.append(caption);
  const head = document.createElement('thead'), headRow = document.createElement('tr'), corner = document.createElement('th'); corner.scope = 'col'; corner.setAttribute('aria-label', 'Type'); headRow.append(corner); for (const member of pokemon) headRow.append(createPokemonColumnHeader(member)); head.append(headRow); table.append(head);
  const body = document.createElement('tbody');
  for (const type of TYPES) { const row = document.createElement('tr'), typeHeader = document.createElement('th'); typeHeader.scope = 'row'; typeHeader.title = type; typeHeader.setAttribute('aria-label', `${type} type`); typeHeader.append(createTypeIcon(type, { className: 'team-matchup-type-icon' })); row.append(typeHeader); for (const member of pokemon) { const results = [...relationships].map(relationship => ({ ...getMatchupResult(member, type, mode, relationship), role: getRelationshipRole(mode, relationship, team.isOpponent === true) })); row.append(createMatchupCell(results)); } body.append(row); }
  table.append(body); wrapper.append(table); return wrapper;
}
function createAnalysisSelector(className, label, options, activeValue, onChange) {
  const selector = el('div', { className }); selector.setAttribute('role', 'tablist'); selector.setAttribute('aria-label', label);
  for (const option of options) { const active = option.value === activeValue, button = el('button', { className: active ? 'primary-button' : 'secondary-button', text: option.label }); button.type = 'button'; button.setAttribute('role', 'tab'); button.setAttribute('aria-selected', String(active)); button.addEventListener('click', () => onChange(option.value)); selector.append(button); }
  return selector;
}
function createRelationshipToggles(mode, team, render) {
  const options = mode === 'defense' ? [{ value: 'weak', label: 'Weak' }, { value: 'resistant', label: 'Resistant' }] : [{ value: 'strong', label: 'Strong' }, { value: 'weak', label: 'Weak' }];
  const selected = activeAnalysisRelationships[mode], group = el('div', { className: 'team-analysis-relationship-tabs' }); group.setAttribute('role', 'group'); group.setAttribute('aria-label', `${mode} matchup relationships`);
  for (const option of options) { const active = selected.has(option.value), role = getRelationshipRole(mode, option.value, team.isOpponent === true), button = el('button', { className: `secondary-button team-analysis-status-${role}${active ? ' team-analysis-status-active' : ''}`, text: option.label }); button.type = 'button'; button.setAttribute('aria-pressed', String(active)); button.addEventListener('click', () => { active ? selected.delete(option.value) : selected.add(option.value); render(); }); group.append(button); }
  return group;
}
function createAnalysis(team, render) {
  const section = el('section', { className: 'team-analysis' }); section.append(createAnalysisSelector('team-analysis-tabs', 'Team matchup direction', [{ value: 'defense', label: 'Defense' }, { value: 'offense', label: 'Offense' }], activeAnalysisMode, mode => { activeAnalysisMode = mode; render(); })); section.append(createRelationshipToggles(activeAnalysisMode, team, render));
  const relationships = activeAnalysisRelationships[activeAnalysisMode], pokemon = getResolvedTeamPokemon(team);
  if (pokemon.length !== team.pokemon.length) section.append(el('p', { className: 'muted', text: 'Loading matchup data…' })); else if (!pokemon.length) section.append(el('p', { className: 'muted', text: 'Add Pokémon to this team to analyze its matchups.' })); else section.append(createAnalysisTable(pokemon, activeAnalysisMode, relationships, team)); return section;
}
function getAdvantageIntensity(score) { const magnitude = Math.abs(score); return magnitude >= 3 ? 3 : magnitude >= 2 ? 2 : 1; }
function createOverallMatchupMatrix(team) {
  const section = el('section', { className: 'team-overall-matchups' }), pokemon = getResolvedTeamPokemon(team); section.append(el('h3', { className: 'team-overall-matchups-title', text: 'Overall type matchups' }));
  if (pokemon.length !== team.pokemon.length) { section.append(el('p', { className: 'muted', text: 'Loading matchup data…' })); return section; }
  if (!pokemon.length) { section.append(el('p', { className: 'muted', text: 'Add Pokémon to this team to analyze its matchups.' })); return section; }
  const isOpponent = team.isOpponent === true, role = isOpponent ? 'danger' : 'success', wrapper = el('div', { className: 'team-matchup-table-scroll' }), table = el('table', { className: 'team-matchup-table team-overall-matchup-table' }), caption = document.createElement('caption'); caption.textContent = isOpponent ? 'Types that have an overall advantage against each opponent Pokémon.' : 'Types that each Pokémon has an overall advantage against.'; table.append(caption);
  const head = document.createElement('thead'), headRow = document.createElement('tr'), corner = document.createElement('th'); corner.scope = 'col'; corner.setAttribute('aria-label', 'Type'); headRow.append(corner); for (const member of pokemon) headRow.append(createPokemonColumnHeader(member)); head.append(headRow); table.append(head);
  const body = document.createElement('tbody');
  for (const type of TYPES) { const row = document.createElement('tr'), typeHeader = document.createElement('th'); typeHeader.scope = 'row'; typeHeader.title = type; typeHeader.setAttribute('aria-label', `${type} type`); typeHeader.append(createTypeIcon(type, { className: 'team-matchup-type-icon' })); row.append(typeHeader); for (const member of pokemon) { const score = getTypeAdvantageScore(member.types, type), shouldMark = isOpponent ? score < 0 : score > 0, cell = document.createElement('td'); if (shouldMark) { const intensity = getAdvantageIntensity(score), dot = el('span', { className: `team-advantage-dot team-advantage-dot-${role} team-advantage-dot-${intensity}` }), perspectiveScore = isOpponent ? -score : score, label = isOpponent ? `${type} has advantage score ${perspectiveScore} against ${member.displayName}` : `${member.displayName} has advantage score ${score} against ${type}`; dot.setAttribute('aria-label', label); dot.title = label; cell.append(dot); } row.append(cell); } body.append(row); }
  table.append(body); wrapper.append(table); section.append(wrapper); return section;
}
async function loadTeamPokemon(team, render) {
  if (!team.pokemon.length || loadingTeamId === team.id) return;
  const unresolved = team.pokemon.filter(member => !resolvedPokemon.has(member.id)); if (!unresolved.length) return; loadingTeamId = team.id;
  await Promise.all(unresolved.map(async member => { try { const result = await getPokemon(member.id); resolvedPokemon.set(member.id, result.pokemon); } catch (error) { console.warn(`Could not load ${member.displayName} for team analysis.`, error); } })); loadingTeamId = null;
  if (state.route === 'team' && state.routeParams.teamId === team.id) render();
}
export function renderTeamDetail(container, render) {
  const team = getTeam(state.routeParams.teamId), page = el('section', { className: 'page team-detail-page' }); page.append(createBackLink());
  if (!team) { const panel = el('section', { className: 'panel' }); panel.append(el('p', { className: 'muted', text: 'That team no longer exists.' })); page.append(panel); container.replaceChildren(page); return; }
  const heading = el('div', { className: 'team-detail-heading team-actions-host' });
  heading.append(el('h2', { className: `team-detail-title${team.isOpponent ? ' team-detail-title-opponent' : ''}`, text: team.title }));
  heading.append(createTeamActionsButton(team, heading, render, { onDelete: () => { location.hash = 'teams'; } }));
  page.append(heading, createTeamDetailTabs(render));
  if (activeTeamDetailMode === 'members') page.append(createRoster(team, render)); else if (activeTeamDetailMode === 'matchups') page.append(createAnalysis(team, render)); else page.append(createOverallMatchupMatrix(team));
  container.replaceChildren(page); loadTeamPokemon(team, render);
}
