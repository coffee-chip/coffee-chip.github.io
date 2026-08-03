import { TYPES, TYPE_META } from '../data/types.js';
import { state } from '../state.js';
import { getOffensiveMatchups, getDefensiveMatchups } from '../engine/effectiveness.js';
import { createTypeBadge, createTypeList } from '../components/typeBadge.js';
import { createMnemonicTypeBadge } from '../components/mnemonicBadge.js';
import { createRelationshipKey, parseRelationshipKey } from '../relationships.js';

const MULTIPLIER_LABELS = {
  4: '4× — extremely effective',
  2: '2× — super effective',
  1: '1× — neutral',
  0.5: '½× — resisted',
  0.25: '¼× — strongly resisted',
  0: '0× — no effect'
};

let activeMnemonicKey = null;
let activeMnemonicBanner = null;

function el(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text) node.textContent = options.text;
  return node;
}

function createTypeSelect(value, includeNone = false) {
  const select = el('select');
  if (includeNone) {
    const none = document.createElement('option');
    none.value = '';
    none.textContent = 'None';
    select.append(none);
  }

  for (const type of TYPES) {
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

function createMnemonicList(types, relationshipKeysForType) {
  const list = el('span', { className: 'type-badge-list' });
  for (const type of types) {
    list.append(createMnemonicTypeBadge(type, relationshipKeysForType(type), showMnemonicBanner));
  }
  return list;
}

function renderGroup(multiplier, types, relationshipKeysForType) {
  if (!types.length) return null;
  const group = el('section', { className: 'matchup-group' });
  group.append(el('h3', { text: MULTIPLIER_LABELS[multiplier] }));
  group.append(createMnemonicList(types, relationshipKeysForType));
  return group;
}

function renderResults(page) {
  const results = el('div', { className: 'study-results' });

  if (state.study.mode === 'offense') {
    const attackingType = state.study.primaryType;
    const groups = getOffensiveMatchups(attackingType);
    const heading = el('div', { className: 'study-heading' });
    heading.append(createTypeBadge(attackingType));
    heading.append(el('span', { text: 'attacks against each defending type' }));
    results.append(heading);
    for (const multiplier of [2, 1, 0.5, 0]) {
      const group = renderGroup(multiplier, groups[multiplier], defendingType => [
        createRelationshipKey(attackingType, defendingType)
      ]);
      if (group) results.append(group);
    }
  } else {
    const defendingTypes = [state.study.primaryType];
    if (state.study.secondaryType) defendingTypes.push(state.study.secondaryType);
    const groups = getDefensiveMatchups(defendingTypes);
    const heading = el('div', { className: 'study-heading' });
    heading.append(el('span', { text: 'Damage taken by' }));
    heading.append(createTypeList(defendingTypes));
    results.append(heading);
    for (const multiplier of [4, 2, 1, 0.5, 0.25, 0]) {
      const group = renderGroup(multiplier, groups[multiplier], attackingType =>
        defendingTypes.map(defendingType => createRelationshipKey(attackingType, defendingType))
      );
      if (group) results.append(group);
    }
  }

  page.append(results);
}

export function renderStudy(container, render) {
  dismissMnemonicBanner();
  const page = el('section', { className: 'page' });
  page.append(el('h2', { text: 'Study' }));

  const controls = el('div', { className: 'panel study-controls' });
  const modeLabel = el('label');
  modeLabel.append(el('span', { text: 'Lookup' }));
  const modeSelect = el('select');
  for (const [value, label] of [['offense', 'Attacking with a type'], ['defense', 'Defending as a type']]) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    option.selected = state.study.mode === value;
    modeSelect.append(option);
  }
  modeSelect.addEventListener('change', () => {
    state.study.mode = modeSelect.value;
    render();
  });
  modeLabel.append(modeSelect);
  controls.append(modeLabel);

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
  renderResults(page);
  container.replaceChildren(page);
}

window.addEventListener('hashchange', () => {
  if (location.hash !== '#study') dismissMnemonicBanner();
});
