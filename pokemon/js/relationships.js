import { TYPES } from './data/types.js';
import { getMultiplier } from './engine/effectiveness.js';
import { getMnemonicForRelationship } from './data/mnemonics.js';

const RELATIONSHIP_SEPARATOR = '>';

export function isValidType(type) {
  return TYPES.includes(type);
}

export function createRelationshipKey(attackingType, defendingType) {
  if (!isValidType(attackingType)) throw new Error(`Unknown attacking type: ${attackingType}`);
  if (!isValidType(defendingType)) throw new Error(`Unknown defending type: ${defendingType}`);
  return `${attackingType}${RELATIONSHIP_SEPARATOR}${defendingType}`;
}

export function parseRelationshipKey(key) {
  if (typeof key !== 'string') throw new Error('Relationship key must be a string.');
  const parts = key.split(RELATIONSHIP_SEPARATOR);
  if (parts.length !== 2) throw new Error(`Invalid relationship key: ${key}`);
  const [attackingType, defendingType] = parts;
  const canonicalKey = createRelationshipKey(attackingType, defendingType);
  if (canonicalKey !== key) throw new Error(`Invalid relationship key: ${key}`);
  return { key: canonicalKey, attackingType, defendingType };
}

export function isValidRelationshipKey(key) {
  try {
    parseRelationshipKey(key);
    return true;
  } catch {
    return false;
  }
}

export function createRelationship(attackingType, defendingType, extra = {}) {
  return {
    ...extra,
    key: createRelationshipKey(attackingType, defendingType),
    attackingType,
    defendingType
  };
}

export function getRelationshipMultiplier(relationshipOrKey) {
  const relationship = typeof relationshipOrKey === 'string'
    ? parseRelationshipKey(relationshipOrKey)
    : createRelationship(relationshipOrKey.attackingType, relationshipOrKey.defendingType);
  return getMultiplier(relationship.attackingType, [relationship.defendingType]);
}

export function getRelationshipMnemonic(relationshipOrKey) {
  const key = typeof relationshipOrKey === 'string'
    ? parseRelationshipKey(relationshipOrKey).key
    : createRelationshipKey(relationshipOrKey.attackingType, relationshipOrKey.defendingType);
  return getMnemonicForRelationship(key);
}

export function getRelationshipProgress(progress, relationshipOrKey) {
  const key = typeof relationshipOrKey === 'string'
    ? parseRelationshipKey(relationshipOrKey).key
    : createRelationshipKey(relationshipOrKey.attackingType, relationshipOrKey.defendingType);
  return progress?.relationshipStats?.[key] ?? null;
}

export function getRelationshipMastery(record) {
  return record?.attempts > 0 ? record.earnedScore / record.attempts : 0;
}

export function resolveRelationship(relationshipOrKey, progress = null) {
  const base = typeof relationshipOrKey === 'string'
    ? parseRelationshipKey(relationshipOrKey)
    : createRelationship(relationshipOrKey.attackingType, relationshipOrKey.defendingType);
  const progressRecord = progress ? getRelationshipProgress(progress, base.key) : null;
  return {
    ...base,
    multiplier: getRelationshipMultiplier(base),
    mnemonic: getRelationshipMnemonic(base),
    progress: progressRecord,
    mastery: getRelationshipMastery(progressRecord)
  };
}
