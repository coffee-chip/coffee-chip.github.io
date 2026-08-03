import { createInlineTypeBadge, createTypeButtonBadge } from './typeBadge.js';
import { getMnemonicsForRelationships } from '../data/mnemonics.js';

function createLightbulbIcon() {
  const bulb = document.createElement('span');
  bulb.className = 'mnemonic-lightbulb';
  bulb.setAttribute('aria-hidden', 'true');
  bulb.textContent = '💡';
  return bulb;
}

export function createMnemonicTypeBadge(type, relationshipKeys, onActivate) {
  const keys = Array.isArray(relationshipKeys) ? relationshipKeys : [relationshipKeys];
  const mnemonics = getMnemonicsForRelationships(keys);
  if (!mnemonics.length) return createInlineTypeBadge(type);

  const button = createTypeButtonBadge(type, {
    className: 'mnemonic-type-badge',
    trailingIcon: createLightbulbIcon(),
    ariaLabel: `Show mnemonic for ${type}`
  });
  button.dataset.relationshipKeys = keys.join(',');
  button.addEventListener('click', () => onActivate?.({ relationshipKeys: keys, mnemonics, button }));
  return button;
}
