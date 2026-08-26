export const DEFAULT_GAME_VERSION_GROUP = 'firered-leafgreen';

export const GAME_VERSION_GROUPS = Object.freeze([
  { id: 'red-blue', label: 'Red / Blue', generation: 'Generation I', generationNumber: 1 },
  { id: 'yellow', label: 'Yellow', generation: 'Generation I', generationNumber: 1 },
  { id: 'gold-silver', label: 'Gold / Silver', generation: 'Generation II', generationNumber: 2 },
  { id: 'crystal', label: 'Crystal', generation: 'Generation II', generationNumber: 2 },
  { id: 'ruby-sapphire', label: 'Ruby / Sapphire', generation: 'Generation III', generationNumber: 3 },
  { id: 'emerald', label: 'Emerald', generation: 'Generation III', generationNumber: 3 },
  { id: 'firered-leafgreen', label: 'FireRed / LeafGreen', generation: 'Generation III', generationNumber: 3 },
  { id: 'diamond-pearl', label: 'Diamond / Pearl', generation: 'Generation IV', generationNumber: 4 },
  { id: 'platinum', label: 'Platinum', generation: 'Generation IV', generationNumber: 4 },
  { id: 'heartgold-soulsilver', label: 'HeartGold / SoulSilver', generation: 'Generation IV', generationNumber: 4 },
  { id: 'black-white', label: 'Black / White', generation: 'Generation V', generationNumber: 5 },
  { id: 'black-2-white-2', label: 'Black 2 / White 2', generation: 'Generation V', generationNumber: 5 },
  { id: 'x-y', label: 'X / Y', generation: 'Generation VI', generationNumber: 6 },
  { id: 'omega-ruby-alpha-sapphire', label: 'Omega Ruby / Alpha Sapphire', generation: 'Generation VI', generationNumber: 6 },
  { id: 'sun-moon', label: 'Sun / Moon', generation: 'Generation VII', generationNumber: 7 },
  { id: 'ultra-sun-ultra-moon', label: 'Ultra Sun / Ultra Moon', generation: 'Generation VII', generationNumber: 7 },
  { id: 'lets-go-pikachu-lets-go-eevee', label: "Let's Go Pikachu / Eevee", generation: 'Generation VII', generationNumber: 7 },
  { id: 'sword-shield', label: 'Sword / Shield', generation: 'Generation VIII', generationNumber: 8 },
  { id: 'the-isle-of-armor', label: 'The Isle of Armor', generation: 'Generation VIII', generationNumber: 8 },
  { id: 'crown-tundra', label: 'The Crown Tundra', generation: 'Generation VIII', generationNumber: 8 },
  { id: 'brilliant-diamond-and-shining-pearl', label: 'Brilliant Diamond / Shining Pearl', generation: 'Generation VIII', generationNumber: 8 },
  { id: 'legends-arceus', label: 'Legends: Arceus', generation: 'Generation VIII', generationNumber: 8 },
  { id: 'scarlet-violet', label: 'Scarlet / Violet', generation: 'Generation IX', generationNumber: 9 },
  { id: 'the-teal-mask', label: 'The Teal Mask', generation: 'Generation IX', generationNumber: 9 },
  { id: 'the-indigo-disk', label: 'The Indigo Disk', generation: 'Generation IX', generationNumber: 9 },
  { id: 'legends-za', label: 'Legends: Z-A', generation: 'Generation IX', generationNumber: 9 }
]);

const GAME_VERSION_GROUP_BY_ID = new Map(GAME_VERSION_GROUPS.map(game => [game.id, game]));
const NATIONAL_DEX_LIMIT_BY_GENERATION = Object.freeze({
  1: 151,
  2: 251,
  3: 386,
  4: 493,
  5: 649,
  6: 721,
  7: 809,
  8: 905,
  9: 1025
});

export function isGameVersionGroup(value) {
  return GAME_VERSION_GROUP_BY_ID.has(value);
}

export function getGameVersionGroup(versionGroup = DEFAULT_GAME_VERSION_GROUP) {
  return GAME_VERSION_GROUP_BY_ID.get(versionGroup) ?? GAME_VERSION_GROUP_BY_ID.get(DEFAULT_GAME_VERSION_GROUP);
}

export function getGameVersionGroupOrder(versionGroup = DEFAULT_GAME_VERSION_GROUP) {
  const order = GAME_VERSION_GROUPS.findIndex(game => game.id === versionGroup);
  return order >= 0 ? order : GAME_VERSION_GROUPS.findIndex(game => game.id === DEFAULT_GAME_VERSION_GROUP);
}

export function getNationalDexLimitForGeneration(generationNumber) {
  return NATIONAL_DEX_LIMIT_BY_GENERATION[generationNumber] ?? NATIONAL_DEX_LIMIT_BY_GENERATION[9];
}

export function getNationalDexLimitForVersionGroup(versionGroup = DEFAULT_GAME_VERSION_GROUP) {
  return getNationalDexLimitForGeneration(getGameVersionGroup(versionGroup).generationNumber);
}

export function isPokemonAvailableInVersionGroup(pokemonId, versionGroup = DEFAULT_GAME_VERSION_GROUP) {
  return Number.isInteger(pokemonId) && pokemonId >= 1 && pokemonId <= getNationalDexLimitForVersionGroup(versionGroup);
}
