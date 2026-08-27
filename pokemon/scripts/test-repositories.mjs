import assert from 'node:assert/strict';

globalThis.document = new EventTarget();

let pokemonFetches = 0;
let moveFetches = 0;
let nameIndexFetches = 0;
let releaseDelayedPokemon = null;

function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => structuredClone(body) };
}

function rawPokemon(id, name) {
  return {
    id,
    name,
    past_types: [],
    types: [{ slot: 1, type: { name: 'normal' } }],
    sprites: { front_default: null, other: { 'official-artwork': { front_default: null } } },
    species: { name },
    moves: [{
      move: { name: 'tackle' },
      version_group_details: [
        { version_group: { name: 'red-blue' }, move_learn_method: { name: 'level-up' }, level_learned_at: 5 },
        { version_group: { name: 'firered-leafgreen' }, move_learn_method: { name: 'level-up' }, level_learned_at: 7 }
      ]
    }]
  };
}

globalThis.fetch = async urlValue => {
  const url = new URL(urlValue);
  if (url.pathname === '/api/v2/pokemon/') {
    nameIndexFetches += 1;
    const results = Array.from({ length: 1025 }, (_, index) => ({
      name: index === 0 ? 'bulbasaur' : `pokemon-${index + 1}`,
      url: `https://pokeapi.co/api/v2/pokemon/${index + 1}/`
    }));
    return response(url.searchParams.get('limit') === '1' ? { count: results.length, results: results.slice(0, 1) } : { count: results.length, results });
  }
  const pokemonMatch = url.pathname.match(/\/api\/v2\/pokemon\/(\d+)\/$/);
  if (pokemonMatch) {
    const id = Number(pokemonMatch[1]);
    pokemonFetches += 1;
    if (id === 3) {
      return new Promise(resolve => {
        releaseDelayedPokemon = () => resolve(response(rawPokemon(3, 'venusaur')));
      });
    }
    return response(rawPokemon(id, id === 1 ? 'bulbasaur' : 'ivysaur'));
  }
  const moveMatch = url.pathname.match(/\/api\/v2\/move\/([a-z-]+)\/$/);
  if (moveMatch) {
    moveFetches += 1;
    if (moveMatch[1] === 'missing-move') return response({}, 404);
    return response({
      id: moveMatch[1] === 'bite' ? 44 : 33,
      name: moveMatch[1],
      type: { name: moveMatch[1] === 'bite' ? 'dark' : 'normal' },
      power: moveMatch[1] === 'bite' ? 60 : 40,
      accuracy: 100,
      damage_class: { name: 'physical' },
      past_values: [],
      effect_entries: [{ language: { name: 'en' }, short_effect: 'Deals damage.' }],
      flavor_text_entries: []
    });
  }
  const speciesMatch = url.pathname.match(/\/api\/v2\/pokemon-species\/(?:\d+|[a-z-]+)\/$/);
  if (speciesMatch) return response({ evolution_chain: null });
  if (url.pathname.endsWith('/encounters')) return response([]);
  return response({}, 404);
};

const [{ state }, repository, moveRepository, storage] = await Promise.all([
  import('../js/state.js'),
  import('../js/data/pokemonRepository.js'),
  import('../js/data/moveRepository.js'),
  import('../js/storage.js')
]);

state.settings.gameVersionGroup = 'firered-leafgreen';

const beforeDedupe = pokemonFetches;
const sameRequests = await Promise.all([
  repository.getPokemon(1),
  repository.getPokemon(1),
  repository.getPokemon(1)
]);
assert.equal(pokemonFetches - beforeDedupe, 1, 'Identical in-flight Pokémon requests should be shared.');
assert.ok(sameRequests.every(result => result.pokemon.id === 1));
assert.equal(repository.getLevelUpMoves(sameRequests[0].pokemon, 'firered-leafgreen')[0].level, 7);
assert.equal(repository.getLevelUpMoves(sameRequests[0].pokemon, 'red-blue')[0].level, 5);

await storage.flushPersistentWrites();
const canonical = await storage.readCachedPokemonById(1);
assert.equal(Object.hasOwn(canonical, 'types'), false, 'Resolved game types must not leak into the canonical cache.');
assert.deepEqual(canonical.currentTypes, ['normal']);
assert.equal(canonical.levelUpMoveHistory[0].levels['red-blue'], 5);
assert.equal(canonical.levelUpMoveHistory[0].levels['firered-leafgreen'], 7);

await repository.getPokemon(2, { versionGroup: 'red-blue' });
const cachedFetchCount = pokemonFetches;
await repository.getPokemon(2, { versionGroup: 'firered-leafgreen' });
assert.equal(pokemonFetches, cachedFetchCount, 'One canonical Pokémon payload should serve other version groups.');

const beforeMoveDedupe = moveFetches;
const moves = await Promise.all([
  moveRepository.getMove('tackle', { versionGroup: 'red-blue' }),
  moveRepository.getMove('tackle', { versionGroup: 'red-blue' })
]);
assert.equal(moveFetches - beforeMoveDedupe, 1, 'Identical in-flight move requests should be shared.');
assert.equal(moveRepository.getMoveVersionData(moves[0].move, 'red-blue').power, 40);
const cachedMoveFetchCount = moveFetches;
await moveRepository.getMove('tackle', { versionGroup: 'firered-leafgreen' });
assert.equal(moveFetches, cachedMoveFetchCount, 'One canonical move payload should serve other version groups.');
const bite = (await moveRepository.getMove('bite')).move;
assert.equal(moveRepository.getMoveVersionData(bite, 'firered-leafgreen').damageClass, 'special');
assert.equal(moveRepository.getMoveVersionData(bite, 'diamond-pearl').damageClass, 'physical');
const originalWarn = console.warn;
console.warn = () => {};
const partialMoves = await moveRepository.getMoves(['tackle', 'missing-move']);
console.warn = originalWarn;
assert.deepEqual([...partialMoves.keys()], ['tackle'], 'A failed move must not discard successful move details.');

const genOneNames = await repository.getPokemonNameIndex({ versionGroup: 'red-blue' });
const indexFetchCount = nameIndexFetches;
const genThreeNames = await repository.getPokemonNameIndex({ versionGroup: 'firered-leafgreen' });
assert.equal(genOneNames.names.length, 151);
assert.equal(genThreeNames.names.length, 386);
assert.equal(nameIndexFetches, indexFetchCount, 'One National Dex index should serve every generation slice.');
await storage.flushPersistentWrites();
assert.equal((await storage.getCachedDataCounts()).nameIndexes, 1);

const delayed = repository.getPokemon(3);
while (!releaseDelayedPokemon) await new Promise(resolve => setTimeout(resolve, 0));
await repository.clearGameDataCache();
releaseDelayedPokemon();
await assert.rejects(delayed, error => error?.name === 'AbortError');
await storage.flushPersistentWrites();
assert.deepEqual(await storage.getCachedDataCounts(), { pokemon: 0, moves: 0, nameIndexes: 0 });

console.log('Repository deduplication, canonical materialization, cross-version reuse, and invalidation checks passed.');
