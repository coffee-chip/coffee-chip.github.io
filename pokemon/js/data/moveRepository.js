import { TYPES } from './types.js';
import { state } from '../state.js';
import { saveCache } from '../storage.js';
import { fetchMove, PokeApiError } from '../api/pokeApi.js';
import { DEFAULT_GAME_VERSION_GROUP, isGameVersionGroup } from './gameVersions.js';

const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

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

function englishDescription(raw, versionGroup) {
  const entries = Array.isArray(raw.flavor_text_entries) ? raw.flavor_text_entries : [];
  const inSelectedGame = entries.find(entry => entry?.language?.name === 'en' && entry.version_group?.name === versionGroup);
  const anyEnglish = entries.find(entry => entry?.language?.name === 'en');
  const effect = (raw.effect_entries ?? []).find(entry => entry?.language?.name === 'en')?.short_effect;
  return normalizeDescription(inSelectedGame?.flavor_text ?? anyEnglish?.flavor_text ?? effect);
}

function normalizeApiMove(raw, versionGroup) {
  if (!Number.isInteger(raw?.id) || raw.id < 1 || typeof raw.name !== 'string' || !raw.name) {
    throw new PokeApiError('PokéAPI returned an incomplete move record.', { code: 'invalid-response' });
  }
  const pastValue = (raw.past_values ?? []).find(entry => entry?.version_group?.name === versionGroup) ?? {};
  const type = pastValue.type?.name ?? raw.type?.name;
  if (!TYPES.includes(type)) throw new PokeApiError('PokéAPI returned a move with an unknown type.', { code: 'invalid-response' });
  return {
    id: raw.id,
    name: raw.name,
    displayName: titleCase(raw.name),
    versionData: {
      [versionGroup]: {
        type,
        power: validStat(pastValue.power ?? raw.power),
        accuracy: validStat(pastValue.accuracy ?? raw.accuracy),
        description: englishDescription(raw, versionGroup)
      }
    },
    fetchedAt: new Date().toISOString()
  };
}

function isValidVersionData(value) {
  return value && TYPES.includes(value.type)
    && (value.power === null || validStat(value.power) !== null)
    && (value.accuracy === null || validStat(value.accuracy) !== null)
    && typeof value.description === 'string';
}

function isValidCachedMove(value) {
  return value && Number.isInteger(value.id) && value.id > 0
    && typeof value.name === 'string' && typeof value.displayName === 'string'
    && value.versionData && typeof value.versionData === 'object'
    && Object.values(value.versionData).every(isValidVersionData)
    && typeof value.fetchedAt === 'string';
}

function normalizeIdentifier(identifier) {
  const normalized = String(identifier ?? '').trim().toLowerCase();
  if (!normalized) throw new PokeApiError('Enter a move name.', { code: 'invalid-identifier' });
  return normalized;
}

function getCached(identifier) {
  const normalized = normalizeIdentifier(identifier);
  const direct = state.cache.moves?.[normalized];
  if (isValidCachedMove(direct)) return direct;
  return Object.values(state.cache.moves ?? {}).find(move => isValidCachedMove(move) && move.name === normalized) ?? null;
}

function cacheMove(move) {
  state.cache.moves ??= {};
  state.cache.moves[move.name] = move;
  saveCache(state.cache);
}

function mergeMove(existing, refreshed) {
  return {
    ...existing,
    ...refreshed,
    versionData: { ...(existing?.versionData ?? {}), ...refreshed.versionData }
  };
}

export async function getMove(identifier, { versionGroup = state.settings.gameVersionGroup } = {}) {
  const normalized = normalizeIdentifier(identifier);
  const selectedVersionGroup = isGameVersionGroup(versionGroup) ? versionGroup : DEFAULT_GAME_VERSION_GROUP;
  const cached = getCached(normalized);
  if (cached && isFresh(cached) && isValidVersionData(cached.versionData?.[selectedVersionGroup])) {
    return { move: cached, source: 'cache', stale: false };
  }
  try {
    const refreshed = normalizeApiMove(await fetchMove(normalized), selectedVersionGroup);
    const move = mergeMove(cached, refreshed);
    cacheMove(move);
    return { move, source: 'network', stale: false };
  } catch (error) {
    if (cached) return { move: cached, source: 'stale-cache', stale: true, error };
    throw error;
  }
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
      const result = await getMove(name, options);
      results.set(name, result.move);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, names.length) }, loadNext));
  return results;
}

export function getMoveVersionData(move, versionGroup = state.settings.gameVersionGroup) {
  const selectedVersionGroup = isGameVersionGroup(versionGroup) ? versionGroup : DEFAULT_GAME_VERSION_GROUP;
  return isValidVersionData(move?.versionData?.[selectedVersionGroup]) ? move.versionData[selectedVersionGroup] : null;
}

export function getMoveCacheEntryCount() {
  return new Set(Object.values(state.cache.moves ?? {}).filter(isValidCachedMove).map(move => move.id)).size;
}
