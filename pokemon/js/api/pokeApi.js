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

export async function fetchPokemon(identifier, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const normalized = normalizePokemonIdentifier(identifier);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE}/pokemon/${encodeURIComponent(normalized)}/`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal
    });

    if (response.status === 404) {
      throw new PokeApiError(`No Pokémon found for “${normalized}”.`, { code: 'not-found', status: 404 });
    }
    if (!response.ok) {
      throw new PokeApiError(`PokéAPI returned ${response.status}.`, { code: 'http-error', status: response.status });
    }
    return await response.json();
  } catch (error) {
    if (error instanceof PokeApiError) throw error;
    if (error?.name === 'AbortError') {
      throw new PokeApiError('The Pokémon lookup timed out.', { code: 'timeout', cause: error });
    }
    throw new PokeApiError('Could not reach PokéAPI.', { code: 'network-error', cause: error });
  } finally {
    clearTimeout(timeout);
  }
}
