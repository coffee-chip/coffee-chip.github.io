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

  const banner = el('button', { className: 'transparent-button mnemonic-banner' });
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

export function enhancePokemonLookupResult(root) {
  dismissMnemonicBanner();
  if (state.route !== 'study' || state.study.mode !== 'pokemon' || !state.study.pokemonResult) return;
  root.querySelector('.pokemon-source')?.remove();
  if (root.querySelector('.pokemon-matchups')) return;
  const card = root.querySelector('.pokemon-result-card');
  if (!card) return;
  card.after(createPokemonDefensiveMatchups(state.study.pokemonResult.types, showMnemonicBanner));
}
