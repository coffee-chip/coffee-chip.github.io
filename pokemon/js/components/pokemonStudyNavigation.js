import { state } from '../state.js';
import { getPokemon, rememberPokemonLookup } from '../data/pokemonRepository.js';

let navigationToken = 0;

export async function openPokemonInStudy(id) {
  const token = ++navigationToken;
  const versionGroup = state.settings.gameVersionGroup;
  const originHash = location.hash;
  try {
    const result = await getPokemon(id, { versionGroup });
    if (token !== navigationToken || state.settings.gameVersionGroup !== versionGroup || location.hash !== originHash) return;
    state.study.mode = 'pokemon';
    state.study.pokemonResult = result.pokemon;
    state.study.pokemonSource = result.source;
    state.study.pokemonError = result.stale ? 'The live lookup failed, so this result may be out of date.' : null;
    state.study.pokemonStatus = 'success';
    state.study.pokemonQuery = result.pokemon.displayName;
    rememberPokemonLookup(result.pokemon);
  } catch (error) {
    if (token !== navigationToken || state.settings.gameVersionGroup !== versionGroup || location.hash !== originHash || error?.name === 'AbortError') return;
    state.study.mode = 'pokemon';
    state.study.pokemonResult = null;
    state.study.pokemonSource = null;
    state.study.pokemonError = error?.message ?? 'Could not look up that Pokémon.';
    state.study.pokemonStatus = 'error';
    state.study.pokemonQuery = String(id);
  }
  location.hash = 'study';
}

document.addEventListener('pokemon-game-data-cleared', () => { navigationToken += 1; });
