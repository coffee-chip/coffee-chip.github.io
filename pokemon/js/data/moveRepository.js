import { TYPES } from './types.js';
import { state } from '../state.js';
import { readCachedMove, saveCachedMove } from '../storage.js';
import { fetchMove, PokeApiError } from '../api/pokeApi.js';
import { DEFAULT_GAME_VERSION_GROUP, GAME_VERSION_GROUPS, getGameVersionGroup, isGameVersionGroup } from './gameVersions.js';

const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MOVE_CACHE_SCHEMA_VERSION = 2;
const DAMAGE_CLASSES = new Set(['physical', 'special', 'status']);
const PRE_SPLIT_PHYSICAL_TYPES = new Set(['normal', 'fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'steel']);
const movesByName = new Map();
const pendingMoves = new Map();
const moveCommitQueues = new Map();
let moveEpoch = 0;

function staleRequestError() {
  return new DOMException('This move data request is no longer current.', 'AbortError');
}
function assertCurrentEpoch(epoch) {
  if (epoch !== moveEpoch) throw staleRequestError();
}

function titleCase(value) {
  return value.split('-').map(part => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ');
}

function isFresh(record) {
  const fetchedAt = Date.parse(record?.fetchedAt);
  return Number.isFinite(fetchedAt) && Date.now() - fetchedAt < CACHE_MAX_AGE_MS;
}

function validStat(value) {
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function normalizeDescription(value) {
  return typeof value === 'string' ? value.replace(/[\n\f\r]+/g, ' ').replace(/\s+/g, ' ').trim() : '';
}

function englishShortEffect(entries) {
  return (entries ?? []).find(entry => entry?.language?.name === 'en')?.short_effect ?? '';
}

function englishDescription(raw, pastValue, versionGroup) {
  const entries = Array.isArray(raw.flavor_text_entries) ? raw.flavor_text_entries : [];
  const inSelectedGame = entries.find(entry => entry?.language?.name === 'en' && entry.version_group?.name === versionGroup);
  const anyEnglish = entries.find(entry => entry?.language?.name === 'en');
  return normalizeDescription(
    inSelectedGame?.flavor_text
    ?? englishShortEffect(pastValue?.effect_entries)
    ?? englishShortEffect(raw.effect_entries)
    ?? anyEnglish?.flavor_text
  );
}

function damageClassForVersionGroup(raw, type, versionGroup) {
  const currentDamageClass = raw.damage_class?.name;
  if (!DAMAGE_CLASSES.has(currentDamageClass)) {
    throw new PokeApiError('PokéAPI returned a move with an unknown damage class.', { code: 'invalid-response' });
  }
  if (currentDamageClass === 'status' || getGameVersionGroup(versionGroup).generationNumber >= 4) {
    return currentDamageClass;
  }
  return PRE_SPLIT_PHYSICAL_TYPES.has(type) ? 'physical' : 'special';
}

function normalizeApiMove(raw) {
  if (!Number.isInteger(raw?.id) || raw.id < 1 || typeof raw.name !== 'string' || !raw.name) {
    throw new PokeApiError('PokéAPI returned an incomplete move record.', { code: 'invalid-response' });
  }
  const versionData = {};
  for (const game of GAME_VERSION_GROUPS) {
    const pastValue = (raw.past_values ?? []).find(entry => entry?.version_group?.name === game.id) ?? {};
    const type = pastValue.type?.name ?? raw.type?.name;
    if (!TYPES.includes(type)) throw new PokeApiError('PokéAPI returned a move with an unknown type.', { code: 'invalid-response' });
    versionData[game.id] = {
      type,
      power: validStat(pastValue.power ?? raw.power),
      accuracy: validStat(pastValue.accuracy ?? raw.accuracy),
      damageClass: damageClassForVersionGroup(raw, type, game.id),
      description: englishDescription(raw, pastValue, game.id)
    };
  }
  return {
    cacheSchemaVersion: MOVE_CACHE_SCHEMA_VERSION,
    id: raw.id,
    name: raw.name,
    displayName: titleCase(raw.name),
    versionData,
    fetchedAt: new Date().toISOString()
  };
}

function isValidVersionData(value) {
  return value && TYPES.includes(value.type)
    && (value.power === null || validStat(value.power) !== null)
    && (value.accuracy === null || validStat(value.accuracy) !== null)
    && DAMAGE_CLASSES.has(value.damageClass)
    && typeof value.description === 'string';
}

function isValidCachedMove(value) {
  return value && value.cacheSchemaVersion === MOVE_CACHE_SCHEMA_VERSION
    && Number.isInteger(value.id) && value.id > 0
    && typeof value.name === 'string' && typeof value.displayName === 'string'
    && value.versionData && typeof value.versionData === 'object'
    && GAME_VERSION_GROUPS.every(game => isValidVersionData(value.versionData[game.id]))
    && typeof value.fetchedAt === 'string';
}

function normalizeIdentifier(identifier) {
  const normalized = String(identifier ?? '').trim().toLowerCase();
  if (!normalized) throw new PokeApiError('Enter a move name.', { code: 'invalid-identifier' });
  return normalized;
}

function rememberCachedMove(move) {
  if (!isValidCachedMove(move)) return null;
  movesByName.set(move.name, move);
  return move;
}

async function getCached(identifier) {
  const normalized = normalizeIdentifier(identifier);
  return movesByName.get(normalized) ?? rememberCachedMove(await readCachedMove(normalized));
}

function cacheMove(move, epoch = moveEpoch) {
  if (epoch !== moveEpoch) return false;
  if (!rememberCachedMove(move)) return;
  void saveCachedMove(move);
  return true;
}
function commitMoveUpdate(name, epoch, update) {
  const previous = moveCommitQueues.get(name) ?? Promise.resolve();
  const request = previous.catch(() => null).then(async () => {
    assertCurrentEpoch(epoch);
    const latest = await getCached(name);
    assertCurrentEpoch(epoch);
    const move = update(latest);
    if (!cacheMove(move, epoch)) throw staleRequestError();
    return move;
  }).finally(() => {
    if (moveCommitQueues.get(name) === request) moveCommitQueues.delete(name);
  });
  moveCommitQueues.set(name, request);
  return request;
}

function mergeMove(existing, refreshed) {
  return {
    ...existing,
    ...refreshed,
    versionData: { ...(existing?.versionData ?? {}), ...refreshed.versionData }
  };
}

async function loadMove(identifier, { versionGroup, epoch }) {
  const normalized = normalizeIdentifier(identifier);
  const selectedVersionGroup = versionGroup;
  const cached = await getCached(normalized);
  assertCurrentEpoch(epoch);
  if (cached && isFresh(cached) && isValidVersionData(cached.versionData?.[selectedVersionGroup])) {
    return { move: cached, source: 'cache', stale: false };
  }
  try {
    const refreshed = normalizeApiMove(await fetchMove(normalized));
    assertCurrentEpoch(epoch);
    const move = await commitMoveUpdate(normalized, epoch, latest => mergeMove(latest ?? cached, refreshed));
    return { move, source: 'network', stale: false };
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    if (cached) return { move: cached, source: 'stale-cache', stale: true, error };
    throw error;
  }
}

export function getMove(identifier, { versionGroup = state.settings.gameVersionGroup } = {}) {
  const normalized = normalizeIdentifier(identifier);
  const selectedVersionGroup = isGameVersionGroup(versionGroup) ? versionGroup : DEFAULT_GAME_VERSION_GROUP;
  const epoch = moveEpoch;
  const key = `${epoch}:${selectedVersionGroup}:${normalized}`;
  if (pendingMoves.has(key)) return pendingMoves.get(key);
  const request = loadMove(normalized, { versionGroup: selectedVersionGroup, epoch })
    .finally(() => {
      if (pendingMoves.get(key) === request) pendingMoves.delete(key);
    });
  pendingMoves.set(key, request);
  return request;
}

export async function getMoves(identifiers, options = {}) {
  const names = [...new Set((identifiers ?? []).map(normalizeIdentifier))];
  const results = new Map();
  const concurrency = 6;
  let nextIndex = 0;
  async function loadNext() {
    while (nextIndex < names.length) {
      const name = names[nextIndex];
      nextIndex += 1;
      try {
        const result = await getMove(name, options);
        results.set(name, result.move);
      } catch (error) {
        if (error?.name === 'AbortError') throw error;
        console.warn(`Could not preload move details for ${name}.`, error);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, names.length) }, loadNext));
  return results;
}

export function getMoveVersionData(move, versionGroup = state.settings.gameVersionGroup) {
  const selectedVersionGroup = isGameVersionGroup(versionGroup) ? versionGroup : DEFAULT_GAME_VERSION_GROUP;
  return isValidVersionData(move?.versionData?.[selectedVersionGroup]) ? move.versionData[selectedVersionGroup] : null;
}

globalThis.document?.addEventListener('pokemon-game-data-cleared', event => {
  moveEpoch += 1;
  pendingMoves.clear();
  moveCommitQueues.clear();
  if (event.detail?.reason === 'cache-clear') movesByName.clear();
});
