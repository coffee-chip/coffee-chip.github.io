import { state } from '../state.js';
import { getGameVersionGroup } from '../data/gameVersions.js';
import { getPokemonEncounterLocations, loadPokemonEncounterLocations } from '../data/pokemonRepository.js';

const pendingLoads = new Map();
const loadErrors = new Map();

function el(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text) node.textContent = options.text;
  return node;
}

function titleCase(value) {
  return value.split('-').map(part => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ');
}

function formatLevelRange(detail) {
  return detail.minLevel === detail.maxLevel ? `Lv. ${detail.minLevel}` : `Lv. ${detail.minLevel}–${detail.maxLevel}`;
}

function formatVersions(versions, game) {
  const appliesToWholeGroup = game.versions.length === versions.length
    && game.versions.every(version => versions.includes(version));
  return appliesToWholeGroup ? null : versions.map(titleCase).join(' / ');
}

function createEncounterDetail(detail, game) {
  const row = el('li', { className: 'pokemon-encounter-detail' });
  const versionLabel = formatVersions(detail.versions, game);
  if (versionLabel) row.append(el('strong', { text: versionLabel }));
  const facts = [titleCase(detail.method), formatLevelRange(detail)];
  if (detail.chance !== null) facts.push(`${detail.chance}%`);
  if (detail.conditions.length) facts.push(detail.conditions.map(titleCase).join(', '));
  row.append(el('span', { text: facts.join(' · ') }));
  return row;
}

function createEncounterSection(pokemon, versionGroup) {
  const game = getGameVersionGroup(versionGroup);
  const locations = getPokemonEncounterLocations(pokemon, versionGroup);
  const section = el('section', { className: 'panel pokemon-encounters' });
  section.append(el('h3', { text: 'Where to find' }));
  section.append(el('p', { className: 'muted pokemon-encounters-intro', text: game.label }));

  const key = `${pokemon.id}:${versionGroup}`;
  if (locations === null) {
    const error = loadErrors.get(key);
    section.append(el('p', {
      className: 'muted pokemon-encounters-status',
      text: error ? (error.message ?? 'Could not load encounter locations.') : 'Loading encounter locations…'
    }));
    return section;
  }
  if (!locations.length) {
    section.append(el('p', { className: 'muted', text: `No wild encounter locations are listed for ${game.label}.` }));
  } else {
    const list = el('div', { className: 'pokemon-encounter-locations' });
    for (const location of locations) {
      const item = el('section', { className: 'pokemon-encounter-location' });
      item.append(el('h4', { text: location.displayName }));
      const details = el('ul');
      for (const detail of location.details) details.append(createEncounterDetail(detail, game));
      item.append(details);
      list.append(item);
    }
    section.append(list);
  }
  section.append(el('p', {
    className: 'muted pokemon-encounters-note',
    text: 'PokéAPI lists encounters; gifts, trades, fossils, and evolution-only sources may not appear.'
  }));
  return section;
}

function loadLocations(pokemon, versionGroup, render) {
  const key = `${pokemon.id}:${versionGroup}`;
  if (pendingLoads.has(key) || loadErrors.has(key)) return;
  const request = loadPokemonEncounterLocations(pokemon.id, { versionGroup })
    .then(result => {
      loadErrors.delete(key);
      if (state.study.pokemonResult?.id === pokemon.id && state.settings.gameVersionGroup === versionGroup) {
        state.study.pokemonResult = result.pokemon;
        render();
      }
    })
    .catch(error => {
      loadErrors.set(key, error);
      if (state.study.pokemonResult?.id === pokemon.id && state.settings.gameVersionGroup === versionGroup) render();
    })
    .finally(() => pendingLoads.delete(key));
  pendingLoads.set(key, request);
}

export function enhancePokemonEncounterLocations(root, render) {
  root.querySelector('.pokemon-encounters')?.remove();
  if (state.route !== 'study' || state.study.mode !== 'pokemon') return;
  const pokemon = state.study.pokemonResult;
  const page = root.querySelector('.page');
  if (!pokemon || !page) return;
  const versionGroup = state.settings.gameVersionGroup;
  page.append(createEncounterSection(pokemon, versionGroup));
  if (getPokemonEncounterLocations(pokemon, versionGroup) === null) loadLocations(pokemon, versionGroup, render);
}
