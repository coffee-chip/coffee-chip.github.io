import { state } from '../state.js';
import { getPokemon } from '../data/pokemonRepository.js';
import {
  getMyPokemonById,
  setPokemonInstanceLevel,
  setPokemonInstanceSpecies
} from '../data/pokemonInstanceRepository.js';
import { createTypeList } from '../components/typeBadge.js';
import { createPokemonEvolutionControls, createPokemonEvolutionSpacer } from '../components/pokemonEvolutionControls.js';
import { openPokemonInStudy } from '../components/pokemonStudyNavigation.js';

const pendingLoads = new Map();
let pendingSpeciesChange = false;
let speciesChangeToken = 0;
let actionError = '';
let levelError = '';

function el(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text) node.textContent = options.text;
  return node;
}

function resetDetailState(instance) {
  state.ownedPokemonDetail = {
    instanceId: instance.id,
    speciesId: instance.speciesId,
    status: 'loading',
    pokemon: null,
    error: null,
    moveComparisonPokemonName: null
  };
}

function loadEntryPokemon(instance, render) {
  const versionGroup = state.settings.gameVersionGroup;
  const key = `${instance.id}:${instance.speciesId}:${versionGroup}`;
  if (pendingLoads.has(key)) return;
  const request = getPokemon(instance.speciesId, { versionGroup })
    .then(result => {
      if (state.route !== 'owned-pokemon'
        || state.routeParams.instanceId !== instance.id
        || state.settings.gameVersionGroup !== versionGroup
        || getMyPokemonById(instance.id)?.speciesId !== instance.speciesId) return;
      state.ownedPokemonDetail.pokemon = result.pokemon;
      state.ownedPokemonDetail.status = 'success';
      state.ownedPokemonDetail.error = result.stale ? 'The live lookup failed, so this result may be out of date.' : null;
      render();
    })
    .catch(error => {
      if (error?.name === 'AbortError'
        || state.route !== 'owned-pokemon'
        || state.routeParams.instanceId !== instance.id
        || state.settings.gameVersionGroup !== versionGroup
        || getMyPokemonById(instance.id)?.speciesId !== instance.speciesId) return;
      state.ownedPokemonDetail.status = 'error';
      state.ownedPokemonDetail.error = error?.message ?? 'Could not load this Pokémon.';
      render();
    })
    .finally(() => {
      if (pendingLoads.get(key) === request) pendingLoads.delete(key);
    });
  pendingLoads.set(key, request);
}

function createStudyLinkVisual(instance, pokemon, displayName) {
  const visual = el('div', { className: 'pokemon-result-visual owned-pokemon-study-link' });
  if (pokemon?.spriteUrl) {
    const image = document.createElement('img');
    image.src = pokemon.spriteUrl;
    image.alt = '';
    visual.append(image);
  } else {
    visual.append(el('span', { className: 'owned-pokemon-placeholder', text: `#${instance.speciesId}` }));
  }
  visual.tabIndex = 0;
  visual.setAttribute('role', 'button');
  visual.setAttribute('aria-label', `Open ${displayName} in Study`);
  const openStudy = () => openPokemonInStudy(instance.speciesId);
  visual.addEventListener('click', openStudy);
  visual.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openStudy();
  });
  return visual;
}

async function changeSpecies(instance, target, render) {
  if (!target?.name || pendingSpeciesChange) return;
  const token = ++speciesChangeToken;
  const versionGroup = state.settings.gameVersionGroup;
  const originalSpeciesId = instance.speciesId;
  pendingSpeciesChange = true;
  actionError = '';
  render();
  try {
    const result = await getPokemon(target.name, { versionGroup });
    if (token !== speciesChangeToken
      || state.route !== 'owned-pokemon'
      || state.routeParams.instanceId !== instance.id
      || state.settings.gameVersionGroup !== versionGroup
      || getMyPokemonById(instance.id)?.speciesId !== originalSpeciesId) return;
    const updated = setPokemonInstanceSpecies(instance.id, result.pokemon);
    if (!updated) throw new Error('Could not save the evolution change.');
    state.ownedPokemonDetail = {
      instanceId: updated.id,
      speciesId: updated.speciesId,
      status: 'success',
      pokemon: result.pokemon,
      error: null,
      moveComparisonPokemonName: null
    };
  } catch (error) {
    if (token !== speciesChangeToken || error?.name === 'AbortError') return;
    actionError = error?.message ?? 'Could not change this Pokémon’s evolution.';
  } finally {
    if (token === speciesChangeToken) {
      pendingSpeciesChange = false;
      render();
    }
  }
}

function createLevelSection(instance, render) {
  const level = instance.level;
  const section = el('div', { className: 'owned-pokemon-level' });
  section.append(el('span', { className: 'owned-pokemon-level-label', text: 'Level' }));

  const controls = el('div', { className: 'owned-pokemon-level-stepper' });
  const decrease = el('button', { className: 'secondary-button icon-button', text: '−' });
  decrease.type = 'button';
  decrease.disabled = level <= 1;
  decrease.setAttribute('aria-label', `Decrease level from ${level} to ${Math.max(1, level - 1)}`);

  const value = el('output', { className: 'owned-pokemon-level-value', text: String(level) });
  value.setAttribute('aria-live', 'polite');
  value.setAttribute('aria-label', `Current level ${level}`);

  const increase = el('button', { className: 'secondary-button icon-button', text: '+' });
  increase.type = 'button';
  increase.disabled = level >= 100;
  increase.setAttribute('aria-label', `Increase level from ${level} to ${Math.min(100, level + 1)}`);

  const updateLevel = nextLevel => {
    if (!setPokemonInstanceLevel(instance.id, nextLevel)) {
      levelError = 'Could not save this Pokémon’s level.';
      render();
      return;
    }
    levelError = '';
    render();
  };
  decrease.addEventListener('click', () => updateLevel(level - 1));
  increase.addEventListener('click', () => updateLevel(level + 1));
  controls.append(decrease, value, increase);
  section.append(controls);
  if (levelError) section.append(el('span', { className: 'pokemon-lookup-error owned-pokemon-level-error', text: levelError }));
  return section;
}

function createInfoCard(instance, pokemon, root, render) {
  const displayName = instance.nickname || pokemon?.displayName || `Pokémon #${instance.speciesId}`;
  const card = el('section', { className: 'panel pokemon-result-card owned-pokemon-detail-card' });
  const details = el('div', { className: 'pokemon-result-details owned-pokemon-detail-content' });
  details.append(el('h3', { className: 'owned-pokemon-detail-name', text: displayName }));
  if (instance.nickname) details.append(el('span', { className: 'muted owned-pokemon-species', text: pokemon?.displayName ?? `Pokémon #${instance.speciesId}` }));
  if (pokemon?.types?.length) details.append(createTypeList(pokemon.types));

  const previous = pokemon?.evolution?.previous ?? [];
  const next = pokemon?.evolution?.next ?? [];
  const identityRow = el('div', { className: 'pokemon-result-identity-row' });
  identityRow.append(
    previous.length
      ? createPokemonEvolutionControls('previous', previous, {
          root,
          card,
          onSelect: target => changeSpecies(instance, target, render)
        })
      : createPokemonEvolutionSpacer(),
    details,
    next.length
      ? createPokemonEvolutionControls('next', next, {
          root,
          card,
          onSelect: target => changeSpecies(instance, target, render)
        })
      : createPokemonEvolutionSpacer()
  );
  card.append(createStudyLinkVisual(instance, pokemon, displayName), identityRow);
  return card;
}

export function renderOwnedPokemonDetail(container, render) {
  const instance = getMyPokemonById(state.routeParams.instanceId);
  const page = el('section', { className: 'page owned-pokemon-detail-page' });
  const back = el('a', { className: 'owned-pokemon-detail-back', text: '← My Pokémon' });
  back.href = '#my-pokemon';
  page.append(back);

  if (!instance) {
    page.append(el('section', { className: 'panel muted', text: 'This Pokémon is no longer in My Pokémon.' }));
    container.replaceChildren(page);
    return;
  }

  const detail = state.ownedPokemonDetail;
  if (detail.instanceId !== instance.id || detail.speciesId !== instance.speciesId) {
    actionError = '';
    levelError = '';
    resetDetailState(instance);
  }
  const pokemon = state.ownedPokemonDetail.pokemon;
  if (pokemon) page.append(createInfoCard(instance, pokemon, container, render));
  else page.append(createInfoCard(instance, null, container, render));
  page.append(createLevelSection(instance, render));

  if (pendingSpeciesChange) {
    page.append(el('p', { className: 'panel muted', text: 'Changing evolution…' }));
  } else if (actionError) {
    page.append(el('p', { className: 'pokemon-lookup-error', text: actionError }));
  } else if (state.ownedPokemonDetail.error) {
    page.append(el('p', { className: 'pokemon-lookup-error', text: state.ownedPokemonDetail.error }));
  } else if (state.ownedPokemonDetail.status === 'loading') {
    page.append(el('p', { className: 'panel muted', text: 'Loading Pokémon details…' }));
  }

  container.replaceChildren(page);
  if (state.ownedPokemonDetail.status === 'loading') loadEntryPokemon(instance, render);
}

document.addEventListener('pokemon-game-data-cleared', () => {
  speciesChangeToken += 1;
  pendingSpeciesChange = false;
  pendingLoads.clear();
  if (state.route !== 'owned-pokemon') return;
  const instance = getMyPokemonById(state.routeParams.instanceId);
  if (!instance) return;
  actionError = '';
  resetDetailState(instance);
});
