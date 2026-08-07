import { getPokemon } from '../data/pokemonRepository.js';
import { getPokemonTypeAdvantageScore } from './effectiveness.js';

export async function getPokemonAdvantageScore(firstPokemonIdentifier, secondPokemonIdentifier) {
  const [firstResult, secondResult] = await Promise.all([
    getPokemon(firstPokemonIdentifier),
    getPokemon(secondPokemonIdentifier)
  ]);

  return getPokemonTypeAdvantageScore(
    firstResult.pokemon.types,
    secondResult.pokemon.types
  );
}
