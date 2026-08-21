import { TYPES } from './data/types.js';
import { getMultiplier, getMultiplierForVersionGroup } from './engine/effectiveness.js';
import { getMnemonicForRelationship } from './data/mnemonics.js';

const GENERIC_RELATIONSHIP_SEPARATOR = '>';
const DIRECTIONAL_RELATIONSHIP_SEPARATOR = ':';

export const RELATIONSHIP_DIRECTIONS = Object.freeze({
  ATTACKER_ADVANTAGE: 'atk-adv',
  DEFENDER_ADVANTAGE: 'def-adv'
});

const DIRECTION_VALUES = new Set(Object.values(RELATIONSHIP_DIRECTIONS));

export function isValidType(type) {
  return TYPES.includes(type);
}

export function createGenericRelationshipKey(attackingType, defendingType) {
  if (!isValidType(attackingType)) throw new Error(`Unknown attacking type: ${attackingType}`);
  if (!isValidType(defendingType)) throw new Error(`Unknown defending type: ${defendingType}`);
  return `${attackingType}${GENERIC_RELATIONSHIP_SEPARATOR}${defendingType}`;
}

export function parseGenericRelationshipKey(key) {
  if (typeof key !== 'string') throw new Error('Generic relationship key must be a string.');
  const parts = key.split(GENERIC_RELATIONSHIP_SEPARATOR);
  if (parts.length !== 2) throw new Error(`Invalid generic relationship key: ${key}`);
  const [attackingType, defendingType] = parts;
  const canonicalKey = createGenericRelationshipKey(attackingType, defendingType);
  if (canonicalKey !== key) throw new Error(`Invalid generic relationship key: ${key}`);
  return { key: canonicalKey, attackingType, defendingType };
}

export function getRelationshipDirectionForMultiplier(multiplier) {
  if (multiplier > 1) return RELATIONSHIP_DIRECTIONS.ATTACKER_ADVANTAGE;
  if (multiplier < 1) return RELATIONSHIP_DIRECTIONS.DEFENDER_ADVANTAGE;
  return null;
}

function genericRelationshipFrom(relationshipOrKey) {
  if (typeof relationshipOrKey === 'string') {
    return relationshipOrKey.includes(DIRECTIONAL_RELATIONSHIP_SEPARATOR)
      ? parseDirectionalRelationshipKey(relationshipOrKey)
      : parseGenericRelationshipKey(relationshipOrKey);
  }
  if (relationshipOrKey?.genericKey) return parseGenericRelationshipKey(relationshipOrKey.genericKey);
  return parseGenericRelationshipKey(
    createGenericRelationshipKey(relationshipOrKey?.attackingType, relationshipOrKey?.defendingType)
  );
}

export function createDirectionalRelationshipKey(relationshipOrKey, versionGroup) {
  const relationship = genericRelationshipFrom(relationshipOrKey);
  const multiplier = versionGroup === undefined
    ? getMultiplier(relationship.attackingType, [relationship.defendingType])
    : getMultiplierForVersionGroup(relationship.attackingType, [relationship.defendingType], versionGroup);
  const direction = getRelationshipDirectionForMultiplier(multiplier);
  return direction ? `${relationship.key}${DIRECTIONAL_RELATIONSHIP_SEPARATOR}${direction}` : null;
}

export function parseDirectionalRelationshipKey(key) {
  if (typeof key !== 'string') throw new Error('Directional relationship key must be a string.');
  const parts = key.split(DIRECTIONAL_RELATIONSHIP_SEPARATOR);
  if (parts.length !== 2 || !DIRECTION_VALUES.has(parts[1])) throw new Error(`Invalid directional relationship key: ${key}`);
  const generic = parseGenericRelationshipKey(parts[0]);
  const direction = parts[1];
  return {
    key: `${generic.key}${DIRECTIONAL_RELATIONSHIP_SEPARATOR}${direction}`,
    genericKey: generic.key,
    attackingType: generic.attackingType,
    defendingType: generic.defendingType,
    direction
  };
}

export function isValidDirectionalRelationshipKey(key) {
  try {
    parseDirectionalRelationshipKey(key);
    return true;
  } catch {
    return false;
  }
}

export function createRelationship(attackingType, defendingType, extra = {}) {
  const genericKey = createGenericRelationshipKey(attackingType, defendingType);
  const multiplier = getMultiplier(attackingType, [defendingType]);
  const direction = getRelationshipDirectionForMultiplier(multiplier);
  return {
    ...extra,
    key: direction ? `${genericKey}${DIRECTIONAL_RELATIONSHIP_SEPARATOR}${direction}` : null,
    genericKey,
    direction,
    attackingType,
    defendingType,
    multiplier
  };
}

export function getRelationshipMultiplier(relationshipOrKey) {
  const relationship = genericRelationshipFrom(relationshipOrKey);
  return getMultiplier(relationship.attackingType, [relationship.defendingType]);
}

function directionalRelationshipKeyFrom(relationshipOrKey) {
  if (typeof relationshipOrKey === 'string') {
    return relationshipOrKey.includes(DIRECTIONAL_RELATIONSHIP_SEPARATOR)
      ? parseDirectionalRelationshipKey(relationshipOrKey).key
      : createDirectionalRelationshipKey(relationshipOrKey);
  }
  if (typeof relationshipOrKey?.key === 'string') return parseDirectionalRelationshipKey(relationshipOrKey.key).key;
  return createRelationship(relationshipOrKey?.attackingType, relationshipOrKey?.defendingType).key;
}

export function getRelationshipMnemonic(relationshipOrKey) {
  const key = directionalRelationshipKeyFrom(relationshipOrKey);
  return key ? getMnemonicForRelationship(key) : null;
}

export function getRelationshipProgress(progress, relationshipOrKey) {
  const key = directionalRelationshipKeyFrom(relationshipOrKey);
  return key ? progress?.relationshipStats?.[key] ?? null : null;
}

export function getRelationshipMastery(record) {
  return record?.attempts > 0 ? record.earnedScore / record.attempts : 0;
}

export function resolveRelationship(relationshipOrKey, progress = null) {
  const generic = genericRelationshipFrom(relationshipOrKey);
  const relationship = createRelationship(generic.attackingType, generic.defendingType);
  const progressRecord = relationship.key && progress ? getRelationshipProgress(progress, relationship.key) : null;
  return {
    ...relationship,
    mnemonic: getRelationshipMnemonic(relationship),
    progress: progressRecord,
    mastery: getRelationshipMastery(progressRecord)
  };
}
