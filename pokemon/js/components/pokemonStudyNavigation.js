import { state } from '../state.js';
import { getPokemon, rememberPokemonLookup } from '../data/pokemonRepository.js';

export async function openPokemonInStudy(id) {
  try {
    const result = await getPokemon(id);
    state.study.mode = 'pokemon';
    state.study.pokemonResult = result.pokemon;
    state.study.pokemonSource = result.source;
    state.study.pokemonError = result.stale ? 'The live lookup failed, so this result may be out of date.' : null;
    state.study.pokemonStatus = 'success';
    state.study.pokemonQuery = result.pokemon.displayName;
    rememberPokemonLookup(result.pokemon);
  } catch (error) {
    state.study.mode = 'pokemon';
    state.study.pokemonResult = null;
    state.study.pokemonSource = null;
    state.study.pokemonError = error?.message ?? 'Could not look up that Pokémon.';
    state.study.pokemonStatus = 'error';
    state.study.pokemonQuery = String(id);
  }
  location.hash = 'study';
}
