import { getDefensiveMatchups } from '../engine/effectiveness.js';
import { createRelationshipKey } from '../relationships.js';
import { createMnemonicTypeBadge } from './mnemonicBadge.js';

const GROUP_LABELS = {
  4: '4× weakness',
  2: '2× weakness',
  0.5: '½× resistance',
  0.25: '¼× resistance',
  0: 'Immune'
};

function el(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text) node.textContent = options.text;
  return node;
}

function createMnemonicList(types, defendingTypes, onMnemonic) {
  const list = el('span', { className: 'type-badge-list' });
  for (const attackingType of types) {
    const relationshipKeys = defendingTypes.map(defendingType =>
      createRelationshipKey(attackingType, defendingType)
    );
    list.append(createMnemonicTypeBadge(attackingType, relationshipKeys, onMnemonic));
  }
  return list;
}

export function createPokemonDefensiveMatchups(defendingTypes, onMnemonic) {
  const groups = getDefensiveMatchups(defendingTypes);
  const section = el('section', { className: 'panel pokemon-matchups' });
  section.append(el('h3', { text: 'Incoming damage' }));
  section.append(el('p', {
    className: 'muted pokemon-matchups-intro',
    text: 'Move types to use or avoid against this Pokémon.'
  }));

  let rendered = 0;
  for (const multiplier of [4, 2, 0.5, 0.25, 0]) {
    const types = groups[multiplier] ?? [];
    if (!types.length) continue;
    const group = el('section', { className: 'matchup-group pokemon-matchup-group' });
    group.append(el('h4', { text: GROUP_LABELS[multiplier] }));
    group.append(createMnemonicList(types, defendingTypes, onMnemonic));
    section.append(group);
    rendered += 1;
  }

  if (!rendered) {
    section.append(el('p', { className: 'muted', text: 'No non-neutral matchups found.' }));
  }

  return section;
}
