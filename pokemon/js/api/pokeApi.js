const API_BASE = 'https://pokeapi.co/api/v2';
const DEFAULT_TIMEOUT_MS = 10000;

export class PokeApiError extends Error {
  constructor(message, { code = 'api-error', status = null, cause = null } = {}) {
    super(message, { cause });
    this.name = 'PokeApiError';
    this.code = code;
    this.status = status;
  }
}

export function normalizePokemonIdentifier(identifier) {
  const normalized = String(identifier ?? '').trim().toLowerCase();
  if (!normalized) throw new PokeApiError('Enter a Pokémon name or Pokédex number.', { code: 'invalid-identifier' });
  return normalized;
}

async function fetchJson(url, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new PokeApiError(`PokéAPI returned ${response.status}.`, { code: 'http-error', status: response.status });
    }
    return await response.json();
  } catch (error) {
    if (error instanceof PokeApiError) throw error;
    if (error?.name === 'AbortError') {
      throw new PokeApiError('The PokéAPI request timed out.', { code: 'timeout', cause: error });
    }
    throw new PokeApiError('Could not reach PokéAPI.', { code: 'network-error', cause: error });
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchPokemon(identifier, options = {}) {
  const normalized = normalizePokemonIdentifier(identifier);
  try {
    return await fetchJson(`${API_BASE}/pokemon/${encodeURIComponent(normalized)}/`, options);
  } catch (error) {
    if (error instanceof PokeApiError && error.status === 404) {
      throw new PokeApiError(`No Pokémon found for “${normalized}”.`, { code: 'not-found', status: 404 });
    }
    throw error;
  }
}

export async function fetchPokemonSpecies(identifier, options = {}) {
  const normalized = normalizePokemonIdentifier(identifier);
  return fetchJson(`${API_BASE}/pokemon-species/${encodeURIComponent(normalized)}/`, options);
}

export async function fetchEvolutionChain(url, options = {}) {
  if (typeof url !== 'string' || !url.startsWith(`${API_BASE}/evolution-chain/`)) {
    throw new PokeApiError('PokéAPI returned an invalid evolution-chain URL.', { code: 'invalid-response' });
  }
  return fetchJson(url, options);
}

function pokemonIdFromUrl(url) {
  const match = typeof url === 'string' ? url.match(/\/pokemon\/(\d+)\/?$/) : null;
  const id = Number(match?.[1]);
  return Number.isInteger(id) && id > 0 ? id : Number.POSITIVE_INFINITY;
}

export async function fetchPokemonNameIndex(options = {}) {
  const summary = await fetchJson(`${API_BASE}/pokemon/?limit=1&offset=0`, options);
  const count = Number(summary?.count);
  if (!Number.isInteger(count) || count < 1) {
    throw new PokeApiError('PokéAPI returned an invalid Pokémon list count.', { code: 'invalid-response' });
  }

  const fullList = await fetchJson(`${API_BASE}/pokemon/?limit=${count}&offset=0`, options);
  const names = (fullList?.results ?? [])
    .filter(entry => typeof entry?.name === 'string' && entry.name.length > 0)
    .sort((a, b) => pokemonIdFromUrl(a.url) - pokemonIdFromUrl(b.url))
    .map(entry => entry.name);

  if (!names.length) {
    throw new PokeApiError('PokéAPI returned an empty Pokémon name list.', { code: 'invalid-response' });
  }
  return names;
}
