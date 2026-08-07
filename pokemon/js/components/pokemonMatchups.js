import { TYPES } from '../data/types.js';
import { getDefensiveMatchups, getMultiplier } from '../engine/effectiveness.js';
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

function createOutgoingMnemonicList(types, pokemonTypes, onMnemonic) {
  const list = el('span', { className: 'type-badge-list' });
  for (const defendingType of types) {
    const relationshipKeys = pokemonTypes.map(attackingType => createRelationshipKey(attackingType, defendingType));
    list.append(createMnemonicTypeBadge(defendingType, relationshipKeys, onMnemonic));
  }
  return list;
}

export function createPokemonDefensiveMatchups(defendingTypes, onMnemonic) {
  const groups = getDefensiveMatchups(defendingTypes);
  const section = el('section', { className: 'panel pokemon-matchups pokemon-defensive-matchups' });
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

  if (!rendered) section.append(el('p', { className: 'muted', text: 'No non-neutral matchups found.' }));
  return section;
}

export function createPokemonOffensiveMatchups(pokemonTypes, onMnemonic) {
  const strong = [];
  const weak = [];
  for (const defendingType of TYPES) {
    const multipliers = pokemonTypes.map(attackingType => getMultiplier(attackingType, [defendingType]));
    if (multipliers.some(multiplier => multiplier > 1)) strong.push(defendingType);
    else if (multipliers.every(multiplier => multiplier < 1)) weak.push(defendingType);
  }

  const section = el('section', { className: 'panel pokemon-matchups pokemon-offensive-matchups' });
  section.append(el('h3', { text: 'Outgoing attacks' }));
  section.append(el('p', {
    className: 'muted pokemon-matchups-intro',
    text: 'Defending types this Pokémon’s own move types are strong or weak against.'
  }));

  const strongGroup = el('section', { className: 'matchup-group pokemon-matchup-group' });
  strongGroup.append(el('h4', { text: 'Strong against' }), createOutgoingMnemonicList(strong, pokemonTypes, onMnemonic));
  section.append(strongGroup);

  const weakGroup = el('section', { className: 'matchup-group pokemon-matchup-group' });
  weakGroup.append(el('h4', { text: 'Weak against' }), createOutgoingMnemonicList(weak, pokemonTypes, onMnemonic));
  section.append(weakGroup);

  return section;
}
