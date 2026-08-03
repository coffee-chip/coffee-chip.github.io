import { state } from '../state.js';
import { parseRelationshipKey } from '../relationships.js';
import { createTypeBadge } from './typeBadge.js';
import { createPokemonDefensiveMatchups } from './pokemonMatchups.js';

let activeMnemonicKey = null;
let activeMnemonicBanner = null;

function el(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text) node.textContent = options.text;
  return node;
}

function displayName(name) {
  return name.split('-').map(part => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ');
}

function dismissMnemonicBanner() {
  activeMnemonicBanner?.remove();
  activeMnemonicBanner = null;
  activeMnemonicKey = null;
  for (const button of document.querySelectorAll('.mnemonic-badge-button[aria-pressed="true"]')) {
    button.setAttribute('aria-pressed', 'false');
  }
}

function showMnemonicBanner({ relationshipKeys, mnemonics, button }) {
  const selectionKey = relationshipKeys.join('|');
  if (activeMnemonicKey === selectionKey) {
    dismissMnemonicBanner();
    return;
  }

  dismissMnemonicBanner();
  activeMnemonicKey = selectionKey;
  button.setAttribute('aria-pressed', 'true');

  const banner = el('button', { className: 'mnemonic-banner' });
  banner.type = 'button';
  banner.setAttribute('aria-label', 'Dismiss mnemonic');
  banner.append(el('strong', { text: mnemonics.length === 1 ? 'Mnemonic' : 'Mnemonics' }));

  for (const mnemonic of mnemonics) {
    const { attackingType, defendingType } = parseRelationshipKey(mnemonic.relationshipKey);
    const line = el('span', { className: 'mnemonic-banner-line' });
    line.append(createTypeBadge(attackingType));
    line.append(el('span', { className: 'relationship-arrow', text: '→' }));
    line.append(createTypeBadge(defendingType));
    line.append(el('span', { className: 'mnemonic-text', text: mnemonic.text }));
    banner.append(line);
  }

  banner.append(el('span', { className: 'mnemonic-dismiss-hint', text: 'Tap to dismiss' }));
  banner.addEventListener('click', dismissMnemonicBanner);
  document.body.append(banner);
  activeMnemonicBanner = banner;
}

function createEvolutionButton(name, direction) {
  const button = el('button', {
    className: 'secondary-button pokemon-evolution-button',
    text: `${direction === 'previous' ? '← ' : ''}${displayName(name)}${direction === 'next' ? ' →' : ''}`
  });
  button.type = 'button';
  button.addEventListener('click', () => {
    const form = document.querySelector('.pokemon-lookup-form');
    const input = form?.querySelector('input[type="search"]');
    if (!form || !input) return;
    input.value = name;
    state.study.pokemonQuery = name;
    form.requestSubmit();
  });
  return button;
}

function createEvolutionNavigation(evolution) {
  const previous = Array.isArray(evolution?.previous) ? evolution.previous : [];
  const next = Array.isArray(evolution?.next) ? evolution.next : [];
  if (!previous.length && !next.length) return null;

  const nav = el('section', { className: 'panel pokemon-evolution-nav' });
  nav.append(el('h3', { text: 'Evolution' }));

  if (previous.length) {
    const group = el('div', { className: 'pokemon-evolution-group' });
    group.append(el('span', { className: 'muted pokemon-evolution-label', text: 'Evolves from' }));
    const actions = el('div', { className: 'pokemon-evolution-actions' });
    previous.forEach(name => actions.append(createEvolutionButton(name, 'previous')));
    group.append(actions);
    nav.append(group);
  }

  if (next.length) {
    const group = el('div', { className: 'pokemon-evolution-group' });
    group.append(el('span', { className: 'muted pokemon-evolution-label', text: 'Evolves to' }));
    const actions = el('div', { className: 'pokemon-evolution-actions' });
    next.forEach(name => actions.append(createEvolutionButton(name, 'next')));
    group.append(actions);
    nav.append(group);
  }

  return nav;
}

export function enhancePokemonLookupResult(root) {
  dismissMnemonicBanner();
  if (state.route !== 'study' || state.study.mode !== 'pokemon' || !state.study.pokemonResult) return;
  if (root.querySelector('.pokemon-matchups')) return;
  const card = root.querySelector('.pokemon-result-card');
  if (!card) return;

  let anchor = card;
  const evolutionNav = createEvolutionNavigation(state.study.pokemonResult.evolution);
  if (evolutionNav) {
    anchor.after(evolutionNav);
    anchor = evolutionNav;
  }
  anchor.after(createPokemonDefensiveMatchups(state.study.pokemonResult.types, showMnemonicBanner));
}
