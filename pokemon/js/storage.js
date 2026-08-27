import { DEFAULT_GAME_VERSION_GROUP } from './data/gameVersions.js';

export const STORAGE_VERSION = 13;

const DATABASE_NAME = 'pokemon-type-trainer';
const DATABASE_VERSION = 1;
const APP_STATE_STORE = 'app-state';
const POKEMON_STORE = 'pokemon';
const MOVE_STORE = 'moves';
const NAME_INDEX_STORE = 'pokemon-name-indexes';
const APP_STATE_KEY = 'current';

export const DEFAULT_PERSISTENT_DATA = Object.freeze({
  version: STORAGE_VERSION,
  settings: {
    paletteTheme: 'classic', appearance: 'system', gameVersionGroup: DEFAULT_GAME_VERSION_GROUP,
    developer: { autoUpdateOnLaunch: false, showOverlay: false, showErrorOverlay: false },
    quiz: { defaultMode: 'choose-switch', modes: { 'choose-switch': {} } }
  },
  progress: { quizStats: {}, relationshipStats: {}, pokemonRecognitionStats: {} },
  starredMoves: [],
  recentPokemonIds: [],
  pokemonInstances: {},
  myPokemonIds: [],
  teams: [
    { id: 'my-team', title: 'My team', isOpponent: false, rivalTeamId: null, memberIds: [] },
    { id: 'opponents', title: 'Opponents', isOpponent: true, rivalTeamId: null, memberIds: [] }
  ]
});

const memoryStores = {
  [APP_STATE_STORE]: new Map(),
  [POKEMON_STORE]: new Map(),
  [MOVE_STORE]: new Map(),
  [NAME_INDEX_STORE]: new Map()
};

let databasePromise = null;
let persistentData = null;
let writeQueue = Promise.resolve();

function cloneDefaults() { return structuredClone(DEFAULT_PERSISTENT_DATA); }
function clone(value) { return structuredClone(value); }
function supportsIndexedDb() { return typeof indexedDB !== 'undefined'; }

function openDatabase() {
  if (!supportsIndexedDb()) return Promise.resolve(null);
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(APP_STATE_STORE)) database.createObjectStore(APP_STATE_STORE, { keyPath: 'key' });
      if (!database.objectStoreNames.contains(POKEMON_STORE)) {
        const store = database.createObjectStore(POKEMON_STORE, { keyPath: 'id' });
        store.createIndex('name', 'name', { unique: true });
      }
      if (!database.objectStoreNames.contains(MOVE_STORE)) database.createObjectStore(MOVE_STORE, { keyPath: 'name' });
      if (!database.objectStoreNames.contains(NAME_INDEX_STORE)) database.createObjectStore(NAME_INDEX_STORE, { keyPath: 'versionGroup' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open Pokémon data storage.'));
  }).catch(error => {
    console.warn('IndexedDB is unavailable; Pokémon data will only persist for this session.', error);
    return null;
  });
  return databasePromise;
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

async function readStore(storeName, key) {
  try {
    const database = await openDatabase();
    if (!database) return clone(memoryStores[storeName].get(key) ?? null);
    const transaction = database.transaction(storeName, 'readonly');
    return requestResult(transaction.objectStore(storeName).get(key));
  } catch (error) {
    console.warn(`Could not read ${storeName} from Pokémon data storage.`, error);
    return clone(memoryStores[storeName].get(key) ?? null);
  }
}

async function readPokemonByName(name) {
  try {
    const database = await openDatabase();
    if (database) {
      const transaction = database.transaction(POKEMON_STORE, 'readonly');
      return requestResult(transaction.objectStore(POKEMON_STORE).index('name').get(name));
    }
  } catch (error) {
    console.warn('Could not read Pokémon by name from Pokémon data storage.', error);
  }
  for (const pokemon of memoryStores[POKEMON_STORE].values()) if (pokemon.name === name) return clone(pokemon);
  return null;
}

async function countStore(storeName) {
  try {
    const database = await openDatabase();
    if (!database) return memoryStores[storeName].size;
    const transaction = database.transaction(storeName, 'readonly');
    return requestResult(transaction.objectStore(storeName).count());
  } catch (error) {
    console.warn(`Could not count ${storeName} in Pokémon data storage.`, error);
    return memoryStores[storeName].size;
  }
}

async function writeStore(storeName, value, key = null) {
  const database = await openDatabase();
  if (!database) {
    const memoryKey = key ?? value.id ?? value.name ?? value.versionGroup;
    memoryStores[storeName].set(memoryKey, clone(value));
    return;
  }
  const transaction = database.transaction(storeName, 'readwrite');
  transaction.objectStore(storeName).put(value);
  await new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB write failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB write was aborted.'));
  });
}

async function clearStores(storeNames) {
  const database = await openDatabase();
  if (!database) {
    storeNames.forEach(storeName => memoryStores[storeName].clear());
    return;
  }
  const transaction = database.transaction(storeNames, 'readwrite');
  storeNames.forEach(storeName => transaction.objectStore(storeName).clear());
  await new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB clear failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB clear was aborted.'));
  });
}

function queueWrite(write) {
  writeQueue = writeQueue.then(write).catch(error => console.warn('Could not save Pokémon data.', error));
  return writeQueue;
}

function currentData() {
  persistentData ??= cloneDefaults();
  return persistentData;
}

function queueAppStateWrite() {
  const value = { key: APP_STATE_KEY, data: clone(currentData()) };
  void queueWrite(() => writeStore(APP_STATE_STORE, value, APP_STATE_KEY));
  return true;
}

function normalizedAppData(value) {
  if (!value || value.version !== STORAGE_VERSION) return cloneDefaults();
  return clone(value);
}

export async function loadPersistentData() {
  if (persistentData) return clone(persistentData);
  const record = await readStore(APP_STATE_STORE, APP_STATE_KEY);
  persistentData = normalizedAppData(record?.data);
  if (!record || record.data?.version !== STORAGE_VERSION) queueAppStateWrite();
  return clone(persistentData);
}

export function getPersistentDataSnapshot() { return clone(currentData()); }

export function saveSettings(settings) {
  currentData().settings = clone(settings);
  return queueAppStateWrite();
}

export function saveProgress(progress) {
  currentData().progress = clone(progress);
  return queueAppStateWrite();
}

export function saveStarredMoves(starredMoves) {
  currentData().starredMoves = [...starredMoves];
  return queueAppStateWrite();
}

export function saveRecentPokemonIds(recentPokemonIds) {
  currentData().recentPokemonIds = [...recentPokemonIds];
  return queueAppStateWrite();
}

export function savePokemonCollections(pokemonInstances, myPokemonIds, teams) {
  Object.assign(currentData(), {
    pokemonInstances: clone(pokemonInstances),
    myPokemonIds: [...myPokemonIds],
    teams: clone(teams)
  });
  return queueAppStateWrite();
}

export function flushPersistentWrites() { return writeQueue; }

export async function readCachedPokemonById(id) { return readStore(POKEMON_STORE, id); }
export async function readCachedPokemonByName(name) { return readPokemonByName(name); }
export function saveCachedPokemon(pokemon) { return queueWrite(() => writeStore(POKEMON_STORE, clone(pokemon))); }
export async function readCachedMove(name) { return readStore(MOVE_STORE, name); }
export function saveCachedMove(move) { return queueWrite(() => writeStore(MOVE_STORE, clone(move))); }
export async function readCachedPokemonNameIndex(versionGroup) { return readStore(NAME_INDEX_STORE, versionGroup); }
export function saveCachedPokemonNameIndex(index) { return queueWrite(() => writeStore(NAME_INDEX_STORE, clone(index))); }

export async function getCachedDataCounts() {
  const [pokemon, moves, nameIndexes] = await Promise.all([
    countStore(POKEMON_STORE), countStore(MOVE_STORE), countStore(NAME_INDEX_STORE)
  ]);
  return { pokemon, moves, nameIndexes };
}

export function clearCachedData() {
  return queueWrite(() => clearStores([POKEMON_STORE, MOVE_STORE, NAME_INDEX_STORE]));
}

export async function clearPersistentData() {
  persistentData = cloneDefaults();
  const initialState = { key: APP_STATE_KEY, data: clone(persistentData) };
  await queueWrite(async () => {
    await clearStores([APP_STATE_STORE, POKEMON_STORE, MOVE_STORE, NAME_INDEX_STORE]);
    await writeStore(APP_STATE_STORE, initialState, APP_STATE_KEY);
  });
}
