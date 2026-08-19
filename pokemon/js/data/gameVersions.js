export const DEFAULT_GAME_VERSION_GROUP = 'firered-leafgreen';

export const GAME_VERSION_GROUPS = Object.freeze([
  { id: 'red-blue', label: 'Red / Blue', generation: 'Generation I' },
  { id: 'yellow', label: 'Yellow', generation: 'Generation I' },
  { id: 'gold-silver', label: 'Gold / Silver', generation: 'Generation II' },
  { id: 'crystal', label: 'Crystal', generation: 'Generation II' },
  { id: 'ruby-sapphire', label: 'Ruby / Sapphire', generation: 'Generation III' },
  { id: 'emerald', label: 'Emerald', generation: 'Generation III' },
  { id: 'firered-leafgreen', label: 'FireRed / LeafGreen', generation: 'Generation III' },
  { id: 'diamond-pearl', label: 'Diamond / Pearl', generation: 'Generation IV' },
  { id: 'platinum', label: 'Platinum', generation: 'Generation IV' },
  { id: 'heartgold-soulsilver', label: 'HeartGold / SoulSilver', generation: 'Generation IV' },
  { id: 'black-white', label: 'Black / White', generation: 'Generation V' },
  { id: 'black-2-white-2', label: 'Black 2 / White 2', generation: 'Generation V' },
  { id: 'x-y', label: 'X / Y', generation: 'Generation VI' },
  { id: 'omega-ruby-alpha-sapphire', label: 'Omega Ruby / Alpha Sapphire', generation: 'Generation VI' },
  { id: 'sun-moon', label: 'Sun / Moon', generation: 'Generation VII' },
  { id: 'ultra-sun-ultra-moon', label: 'Ultra Sun / Ultra Moon', generation: 'Generation VII' },
  { id: 'lets-go-pikachu-lets-go-eevee', label: "Let's Go Pikachu / Eevee", generation: 'Generation VII' },
  { id: 'sword-shield', label: 'Sword / Shield', generation: 'Generation VIII' },
  { id: 'the-isle-of-armor', label: 'The Isle of Armor', generation: 'Generation VIII' },
  { id: 'crown-tundra', label: 'The Crown Tundra', generation: 'Generation VIII' },
  { id: 'brilliant-diamond-and-shining-pearl', label: 'Brilliant Diamond / Shining Pearl', generation: 'Generation VIII' },
  { id: 'legends-arceus', label: 'Legends: Arceus', generation: 'Generation VIII' },
  { id: 'scarlet-violet', label: 'Scarlet / Violet', generation: 'Generation IX' },
  { id: 'the-teal-mask', label: 'The Teal Mask', generation: 'Generation IX' },
  { id: 'the-indigo-disk', label: 'The Indigo Disk', generation: 'Generation IX' },
  { id: 'legends-za', label: 'Legends: Z-A', generation: 'Generation IX' }
]);

const GAME_VERSION_GROUP_BY_ID = new Map(GAME_VERSION_GROUPS.map(game => [game.id, game]));

export function isGameVersionGroup(value) {
  return GAME_VERSION_GROUP_BY_ID.has(value);
}

export function getGameVersionGroup(versionGroup = DEFAULT_GAME_VERSION_GROUP) {
  return GAME_VERSION_GROUP_BY_ID.get(versionGroup) ?? GAME_VERSION_GROUP_BY_ID.get(DEFAULT_GAME_VERSION_GROUP);
}
