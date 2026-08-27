import { TYPE_META } from '../data/types.js';
import { state } from '../state.js';
import { getActiveTypes, getOffensiveMatchups, getDefensiveMatchups } from '../engine/effectiveness.js';
import { createTypeBadge, createTypeList } from '../components/typeBadge.js';
import { createMnemonicTypeBadge } from '../components/mnemonicBadge.js';
import { createRelationship, parseDirectionalRelationshipKey } from '../relationships.js';
import { getPokemon, getRecentPokemonLookups, loadRecentPokemonLookups, rememberPokemonLookup } from '../data/pokemonRepository.js';

const MULTIPLIER_LABELS = {
  4: '4× — extremely effective', 2: '2× — super effective', 1: '1× — neutral',
  0.5: '½× — resisted', 0.25: '¼× — strongly resisted', 0: '0× — no effect'
};

let activeMnemonicKey = null;
let activeMnemonicBanner = null;
let pokemonLookupToken = 0;

function el(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text) node.textContent = options.text;
  return node;
}

function createTypeSelect(value, includeNone = false) {
  const select = el('select');
  if (includeNone) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'None';
    select.append(option);
  }
  for (const type of getActiveTypes()) {
    const option = document.createElement('option');
    option.value = type;
    option.textContent = TYPE_META[type].label;
    option.selected = type === value;
    select.append(option);
  }
  return select;
}

function dismissMnemonicBanner() {
  activeMnemonicBanner?.remove();
  activeMnemonicBanner = null;
  activeMnemonicKey = null;
  for (const button of document.querySelectorAll('.mnemonic-badge-button[aria-pressed="true"]')) button.setAttribute('aria-pressed', 'false');
}

function showMnemonicBanner({ relationshipKeys, mnemonics, button }) {
  const selectionKey = relationshipKeys.join('|');
  if (activeMnemonicKey === selectionKey) { dismissMnemonicBanner(); return; }
  dismissMnemonicBanner();
  activeMnemonicKey = selectionKey;
  button.setAttribute('aria-pressed', 'true');
  const banner = el('button', { className: 'transparent-button mnemonic-banner' });
  banner.type = 'button';
  banner.setAttribute('aria-label', 'Dismiss mnemonic');
  banner.append(el('strong', { text: mnemonics.length === 1 ? 'Mnemonic' : 'Mnemonics' }));
  for (const mnemonic of mnemonics) {
    const { attackingType, defendingType } = parseDirectionalRelationshipKey(mnemonic.relationshipKey);
    const line = el('span', { className: 'mnemonic-banner-line' });
    line.append(createTypeBadge(attackingType), el('span', { className: 'relationship-arrow', text: '→' }), createTypeBadge(defendingType), el('span', { className: 'mnemonic-text', text: mnemonic.text }));
    banner.append(line);
  }
  banner.append(el('span', { className: 'mnemonic-dismiss-hint', text: 'Tap to dismiss' }));
  banner.addEventListener('click', dismissMnemonicBanner);
  document.body.append(banner);
  activeMnemonicBanner = banner;
}

function createMnemonicList(types, relationshipKeysForType) {
  const list = el('span', { className: 'type-badge-list' });
  for (const type of types) list.append(createMnemonicTypeBadge(type, relationshipKeysForType(type), showMnemonicBanner));
  return list;
}

function renderGroup(multiplier, types, relationshipKeysForType) {
  if (!types.length) return null;
  const group = el('section', { className: 'matchup-group' });
  group.append(el('h3', { text: MULTIPLIER_LABELS[multiplier] }), createMnemonicList(types, relationshipKeysForType));
  return group;
}

function renderTypeResults(page) {
  const results = el('div', { className: 'study-results' });
  if (state.study.mode === 'offense') {
    const attackingType = state.study.primaryType;
    const groups = getOffensiveMatchups(attackingType);
    const heading = el('div', { className: 'study-heading' });
    heading.append(createTypeBadge(attackingType), el('span', { text: 'attacks against each defending type' }));
    results.append(heading);
    for (const multiplier of [2, 1, 0.5, 0]) {
      const group = renderGroup(multiplier, groups[multiplier], defendingType => [createRelationship(attackingType, defendingType).key].filter(Boolean));
      if (group) results.append(group);
    }
  } else {
    const defendingTypes = [state.study.primaryType];
    if (state.study.secondaryType) defendingTypes.push(state.study.secondaryType);
    const groups = getDefensiveMatchups(defendingTypes);
    const heading = el('div', { className: 'study-heading' });
    heading.append(el('span', { text: 'Damage taken by' }), createTypeList(defendingTypes));
    results.append(heading);
    for (const multiplier of [4, 2, 1, 0.5, 0.25, 0]) {
      const group = renderGroup(multiplier, groups[multiplier], attackingType => defendingTypes.map(defendingType => createRelationship(attackingType, defendingType).key).filter(Boolean));
      if (group) results.append(group);
    }
  }
  page.append(results);
}

function renderPokemonResult(page) {
  if (state.study.pokemonStatus === 'loading') {
    page.append(el('p', { className: 'muted pokemon-lookup-status', text: 'Looking up Pokémon…' }));
    return;
  }
  if (state.study.pokemonError) page.append(el('p', { className: 'pokemon-lookup-error', text: state.study.pokemonError }));
  const pokemon = state.study.pokemonResult;
  if (!pokemon) return;
  const card = el('section', { className: 'panel pokemon-result-card' });
  const visual = el('div', { className: 'pokemon-result-visual' });
  if (pokemon.spriteUrl) {
    const image = document.createElement('img');
    image.src = pokemon.spriteUrl;
    image.alt = pokemon.displayName;
    image.loading = 'lazy';
    visual.append(image);
  } else visual.append(el('div', { className: 'pokemon-sprite-placeholder', text: 'No image' }));
  const details = el('div', { className: 'pokemon-result-details' });
  details.append(el('div', { className: 'pokemon-dex-number', text: `#${String(pokemon.id).padStart(4, '0')}` }), el('h3', { text: pokemon.displayName }), createTypeList(pokemon.types));
  card.append(visual, details);
  page.append(card);
}

async function lookupPokemon(identifier, render) {
  const token = ++pokemonLookupToken;
  const versionGroup = state.settings.gameVersionGroup;
  state.study.moveComparisonPokemonName = null;
  state.study.pokemonQuery = String(identifier);
  state.study.pokemonStatus = 'loading';
  state.study.pokemonError = null;
  render();
  try {
    const result = await getPokemon(identifier, { versionGroup });
    if (token !== pokemonLookupToken
      || state.settings.gameVersionGroup !== versionGroup
      || state.route !== 'study'
      || state.study.mode !== 'pokemon') return;
    state.study.pokemonResult = result.pokemon;
    state.study.pokemonSource = result.source;
    state.study.pokemonError = result.stale ? 'The live lookup failed, so this result may be out of date.' : null;
    state.study.pokemonStatus = 'success';
    state.study.pokemonQuery = result.pokemon.displayName;
    rememberPokemonLookup(result.pokemon);
  } catch (error) {
    if (token !== pokemonLookupToken
      || state.settings.gameVersionGroup !== versionGroup
      || state.route !== 'study'
      || state.study.mode !== 'pokemon'
      || error?.name === 'AbortError') return;
    state.study.pokemonResult = null;
    state.study.pokemonSource = null;
    state.study.pokemonError = error?.message ?? 'Could not look up that Pokémon.';
    state.study.pokemonStatus = 'error';
  }
  render();
}

function renderRecentPokemon(page, render) {
  const recent = getRecentPokemonLookups();
  if (!recent.length) return;
  const section = el('section', { className: 'pokemon-recent' });
  section.setAttribute('aria-label', 'Recently viewed Pokémon');
  const list = el('div', { className: 'pokemon-recent-list' });
  for (const pokemon of recent) {
    const button = el('button', { className: 'secondary-button pokemon-recent-button' });
    button.type = 'button';
    button.title = pokemon.displayName;
    button.setAttribute('aria-label', `Open ${pokemon.displayName}`);
    if (pokemon.spriteUrl) {
      const image = document.createElement('img');
      image.src = pokemon.spriteUrl;
      image.alt = '';
      image.loading = 'lazy';
      button.append(image);
    } else button.append(el('span', { className: 'pokemon-recent-placeholder', text: `#${pokemon.id}` }));
    button.append(el('span', { text: pokemon.displayName }));
    button.addEventListener('click', () => {
      button.blur();
      lookupPokemon(pokemon.id, render);
    });
    list.append(button);
  }
  section.append(list);
  page.append(section);
}

function renderPokemonLookup(page, render) {
  renderRecentPokemon(page, render);
  const form = el('div', { className: 'panel pokemon-lookup-form' });
  const label = el('label');
  label.append(el('span', { text: 'Pokémon name' }));
  const searchField = el('div', { className: 'search-field' });
  const input = document.createElement('input');
  input.type = 'search';
  input.dataset.pokemonAutocomplete = 'true';
  input.autocomplete = 'off';
  input.autocapitalize = 'none';
  input.spellcheck = false;
  input.placeholder = 'Start typing a Pokémon name';
  input.value = state.study.pokemonQuery;
  input.addEventListener('input', () => { state.study.pokemonQuery = input.value; });
  input.addEventListener('pokemon-autocomplete-select', event => {
    const name = event.detail?.name;
    if (name) lookupPokemon(name, render);
  });
  const clear = el('button', { className: 'transparent-button icon-button search-field-clear', text: '×' });
  clear.type = 'button';
  clear.setAttribute('aria-label', 'Clear Pokémon search');
  clear.addEventListener('click', () => {
    input.value = '';
    state.study.pokemonQuery = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  });
  searchField.append(input, clear);
  label.append(searchField);
  form.append(label);
  page.append(form);
  renderPokemonResult(page);
}

export function renderStudy(container, render) {
  dismissMnemonicBanner();
  const page = el('section', { className: 'page' });
  const controls = el('div', { className: 'panel study-controls' });
  const modeLabel = el('label');
  modeLabel.append(el('span', { text: 'Lookup' }));
  const modeSelect = el('select');
  for (const [value, label] of [['offense', 'Attacking with a type'], ['defense', 'Defending as a type'], ['pokemon', 'Pokémon by name or number']]) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    option.selected = state.study.mode === value;
    modeSelect.append(option);
  }
  modeSelect.addEventListener('change', () => { state.study.mode = modeSelect.value; render(); });
  modeLabel.append(modeSelect);
  controls.append(modeLabel);
  if (state.study.mode !== 'pokemon') {
    const primaryLabel = el('label');
    primaryLabel.append(el('span', { text: state.study.mode === 'offense' ? 'Attacking type' : 'First defending type' }));
    const primarySelect = createTypeSelect(state.study.primaryType);
    primarySelect.addEventListener('change', () => {
      state.study.primaryType = primarySelect.value;
      if (state.study.secondaryType === primarySelect.value) state.study.secondaryType = null;
      render();
    });
    primaryLabel.append(primarySelect);
    controls.append(primaryLabel);
  }
  if (state.study.mode === 'defense') {
    const secondaryLabel = el('label');
    secondaryLabel.append(el('span', { text: 'Second defending type' }));
    const secondarySelect = createTypeSelect(state.study.secondaryType, true);
    secondarySelect.addEventListener('change', () => {
      state.study.secondaryType = secondarySelect.value || null;
      if (state.study.secondaryType === state.study.primaryType) state.study.secondaryType = null;
      render();
    });
    secondaryLabel.append(secondarySelect);
    controls.append(secondaryLabel);
  }
  page.append(controls);
  if (state.study.mode === 'pokemon') renderPokemonLookup(page, render);
  else renderTypeResults(page);
  container.replaceChildren(page);
  if (state.study.mode === 'pokemon') {
    void loadRecentPokemonLookups().then(({ loaded }) => {
      if (loaded && state.route === 'study' && state.study.mode === 'pokemon') render();
    }).catch(error => console.warn('Could not load recent Pokémon.', error));
  }
}

window.addEventListener('hashchange', () => { if (location.hash !== '#study') dismissMnemonicBanner(); });
document.addEventListener('pokemon-game-data-cleared', () => { pokemonLookupToken += 1; });
