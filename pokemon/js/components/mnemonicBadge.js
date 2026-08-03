import { createTypeBadge } from './typeBadge.js';
import { getMnemonicsForRelationships } from '../data/mnemonics.js';

export function createMnemonicTypeBadge(type, relationshipKeys, onActivate) {
  const keys = Array.isArray(relationshipKeys) ? relationshipKeys : [relationshipKeys];
  const mnemonics = getMnemonicsForRelationships(keys);
  if (!mnemonics.length) return createTypeBadge(type);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'mnemonic-badge-button';
  button.dataset.relationshipKeys = keys.join(',');
  button.setAttribute('aria-label', `Show mnemonic for ${type}`);
  button.append(createTypeBadge(type));

  const bulb = document.createElement('span');
  bulb.className = 'mnemonic-lightbulb';
  bulb.setAttribute('aria-hidden', 'true');
  bulb.textContent = '💡';
  button.append(bulb);

  button.addEventListener('click', () => onActivate?.({ relationshipKeys: keys, mnemonics, button }));
  return button;
}
