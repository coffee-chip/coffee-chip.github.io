import { createTypeButtonBadge } from './typeBadge.js';
import { getRelationshipMnemonic } from '../relationships.js';

function createLightbulbIcon() {
  const bulb = document.createElement('span');
  bulb.className = 'mnemonic-lightbulb';
  bulb.setAttribute('aria-hidden', 'true');
  bulb.textContent = '💡';
  return bulb;
}

export function createMnemonicTypeBadge(type, relationshipKeys, onActivate) {
  const keys = Array.isArray(relationshipKeys) ? relationshipKeys : [relationshipKeys];
  const mnemonics = keys.map(getRelationshipMnemonic).filter(Boolean);
  const hasMnemonic = mnemonics.length > 0;

  const button = createTypeButtonBadge(type, {
    className: `mnemonic-type-badge${hasMnemonic ? '' : ' no-mnemonic'}`,
    trailingIcon: hasMnemonic ? createLightbulbIcon() : null,
    ariaLabel: hasMnemonic ? `Show mnemonic for ${type}` : `${type} has no mnemonic`
  });
  button.dataset.relationshipKeys = keys.join(',');

  if (hasMnemonic) {
    button.addEventListener('click', () => onActivate?.({ relationshipKeys: keys, mnemonics, button }));
  } else {
    button.setAttribute('aria-disabled', 'true');
    button.tabIndex = -1;
  }

  return button;
}
