import { DEFAULT_GAME_VERSION_GROUP } from './data/gameVersions.js';

export const STORAGE_VERSION = 14;

const DATABASE_NAME = 'pokemon-type-trainer';
const DATABASE_VERSION = 2;
const APP_STATE_STORE = 'app-state';
const POKEMON_STORE = 'pokemon';
const MOVE_STORE = 'moves';
const NAME_INDEX_STORE = 'pokemon-name-indexes';
const APP_STATE_KEY = 'current';
const NAME_INDEX_KEY = 'national-dex';
const STORE_NAMES = [APP_STATE_STORE, POKEMON_STORE, MOVE_STORE, NAME_INDEX_STORE];

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

const memoryStores = Object.fromEntries(STORE_NAMES.map(storeName => [storeName, new Map()]));
const storageListeners = new Set();

export const storageStatus = {
  backend: 'opening',
  appState: 'idle',
  cache: 'idle',
  pendingAppStateWrites: 0,
  pendingCacheWrites: 0,
  lastAppStateCommit: null,
  lastError: null
};

let databasePromise = null;
let persistentData = null;
let appStateRevision = 0;
let queuedAppState = null;
let appStateDrainPromise = null;
let appStateWaiters = [];
let cacheWriteQueue = Promise.resolve(true);

function cloneDefaults() { return structuredClone(DEFAULT_PERSISTENT_DATA); }
function clone(value) { return structuredClone(value); }
function supportsIndexedDb() { return typeof indexedDB !== 'undefined'; }
function emitStorageStatus() {
  const snapshot = { ...storageStatus };
  for (const listener of storageListeners) {
    try { listener(snapshot); }
    catch (error) { console.error('Storage status listener failed.', error); }
  }
}
function setStorageError(scope, error) {
  storageStatus[scope] = 'error';
  storageStatus.lastError = {
    scope,
    message: error?.message ?? String(error ?? 'Unknown storage error'),
    at: new Date().toISOString()
  };
  console.warn(`Could not save Pokémon ${scope === 'appState' ? 'app state' : 'cache data'}.`, error);
  emitStorageStatus();
}
function createStores(database) {
  database.createObjectStore(APP_STATE_STORE, { keyPath: 'key' });
  const pokemon = database.createObjectStore(POKEMON_STORE, { keyPath: 'id' });
  pokemon.createIndex('name', 'name', { unique: true });
  database.createObjectStore(MOVE_STORE, { keyPath: 'name' });
  database.createObjectStore(NAME_INDEX_STORE, { keyPath: 'key' });
}

function openDatabase() {
  if (!supportsIndexedDb()) {
    storageStatus.backend = 'memory';
    emitStorageStatus();
    return Promise.resolve(null);
  }
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      // Storage v14 intentionally starts from one clean schema. Active development
      // does not preserve older state or cache records.
      const existingStores = Array.from(
        { length: database.objectStoreNames.length },
        (_, index) => database.objectStoreNames.item(index)
      ).filter(Boolean);
      for (const storeName of existingStores) database.deleteObjectStore(storeName);
      createStores(database);
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        databasePromise = null;
        storageStatus.backend = 'opening';
        emitStorageStatus();
      };
      storageStatus.backend = 'indexeddb';
      emitStorageStatus();
      resolve(database);
    };
    request.onerror = () => reject(request.error ?? new Error('Could not open Pokémon data storage.'));
    request.onblocked = () => console.warn('Pokémon data storage upgrade is waiting for another app tab to close.');
  }).catch(error => {
    databasePromise = null;
    storageStatus.backend = 'memory';
    storageStatus.lastError = { scope: 'database', message: error.message, at: new Date().toISOString() };
    console.warn('IndexedDB is unavailable; Pokémon data will only persist for this session.', error);
    emitStorageStatus();
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

async function readStore(storeName, key, { fallbackToMemory = true } = {}) {
  try {
    const database = await openDatabase();
    if (!database) return clone(memoryStores[storeName].get(key) ?? null);
    const transaction = database.transaction(storeName, 'readonly');
    return requestResult(transaction.objectStore(storeName).get(key));
  } catch (error) {
    console.warn(`Could not read ${storeName} from Pokémon data storage.`, error);
    if (!fallbackToMemory) throw error;
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

async function writeStore(storeName, value) {
  const database = await openDatabase();
  if (!database) {
    const memoryKey = value.key ?? value.id ?? value.name ?? value.versionGroup;
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

function currentData() {
  persistentData ??= cloneDefaults();
  return persistentData;
}

function resolveAppStateWaiters(revision, saved) {
  const completed = appStateWaiters.filter(waiter => waiter.revision <= revision);
  appStateWaiters = appStateWaiters.filter(waiter => waiter.revision > revision);
  for (const waiter of completed) waiter.resolve(saved);
  storageStatus.pendingAppStateWrites = appStateWaiters.length;
}

function ensureAppStateDrain() {
  if (appStateDrainPromise) return;
  appStateDrainPromise = (async () => {
    while (queuedAppState) {
      const pending = queuedAppState;
      queuedAppState = null;
      storageStatus.appState = 'writing';
      emitStorageStatus();
      try {
        await writeStore(APP_STATE_STORE, pending.value);
        const durable = storageStatus.backend === 'indexeddb';
        storageStatus.appState = durable ? 'idle' : 'session-only';
        if (durable) storageStatus.lastAppStateCommit = new Date().toISOString();
        if (storageStatus.lastError?.scope === 'appState') storageStatus.lastError = null;
        resolveAppStateWaiters(pending.revision, durable);
      } catch (error) {
        setStorageError('appState', error);
        resolveAppStateWaiters(pending.revision, false);
      }
      emitStorageStatus();
    }
  })().finally(() => {
    appStateDrainPromise = null;
    if (queuedAppState) ensureAppStateDrain();
  });
}

function queueAppStateWrite() {
  const revision = ++appStateRevision;
  queuedAppState = {
    revision,
    value: { key: APP_STATE_KEY, data: clone(currentData()) }
  };
  const saved = new Promise(resolve => appStateWaiters.push({ revision, resolve }));
  storageStatus.pendingAppStateWrites = appStateWaiters.length;
  storageStatus.appState = 'queued';
  emitStorageStatus();
  ensureAppStateDrain();
  return saved;
}

function queueCacheWrite(write) {
  storageStatus.pendingCacheWrites += 1;
  storageStatus.cache = 'queued';
  emitStorageStatus();
  const task = cacheWriteQueue.then(async () => {
    storageStatus.cache = 'writing';
    emitStorageStatus();
    try {
      await write();
      if (storageStatus.lastError?.scope === 'cache') storageStatus.lastError = null;
      return true;
    } catch (error) {
      setStorageError('cache', error);
      return false;
    }
  }).finally(() => {
    storageStatus.pendingCacheWrites -= 1;
    if (!storageStatus.pendingCacheWrites) storageStatus.cache = storageStatus.lastError?.scope === 'cache' ? 'error' : 'idle';
    emitStorageStatus();
  });
  cacheWriteQueue = task;
  return task;
}

function isRecord(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function isValidAppData(value) {
  return isRecord(value)
    && value.version === STORAGE_VERSION
    && isRecord(value.settings)
    && isRecord(value.settings.developer)
    && isRecord(value.settings.quiz)
    && isRecord(value.settings.quiz.modes)
    && isRecord(value.progress)
    && isRecord(value.progress.quizStats)
    && isRecord(value.progress.relationshipStats)
    && isRecord(value.progress.pokemonRecognitionStats)
    && Array.isArray(value.starredMoves)
    && Array.isArray(value.recentPokemonIds)
    && isRecord(value.pokemonInstances)
    && Array.isArray(value.myPokemonIds)
    && Array.isArray(value.teams)
    && value.teams.every(team =>
      isRecord(team)
      && typeof team.id === 'string'
      && typeof team.title === 'string'
      && Array.isArray(team.memberIds)
    );
}
function normalizedAppData(value) {
  if (!isValidAppData(value)) return cloneDefaults();
  return clone(value);
}

export function subscribeStorageStatus(listener) {
  storageListeners.add(listener);
  return () => storageListeners.delete(listener);
}

export function getStorageStatus() { return clone(storageStatus); }

export async function loadPersistentData() {
  if (persistentData) return clone(persistentData);
  // Never turn a transient app-state read failure into a default-state write.
  const record = await readStore(APP_STATE_STORE, APP_STATE_KEY, { fallbackToMemory: false });
  persistentData = normalizedAppData(record?.data);
  if (!isValidAppData(record?.data)) void queueAppStateWrite();
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

export async function flushPersistentWrites() {
  while (queuedAppState || appStateDrainPromise) {
    ensureAppStateDrain();
    if (appStateDrainPromise) await appStateDrainPromise;
  }
  while (storageStatus.pendingCacheWrites) await cacheWriteQueue;
  return !storageStatus.lastError;
}

export async function readCachedPokemonById(id) { return readStore(POKEMON_STORE, id); }
export async function readCachedPokemonByName(name) { return readPokemonByName(name); }
export function saveCachedPokemon(pokemon) { return queueCacheWrite(() => writeStore(POKEMON_STORE, clone(pokemon))); }
export async function readCachedMove(name) { return readStore(MOVE_STORE, name); }
export function saveCachedMove(move) { return queueCacheWrite(() => writeStore(MOVE_STORE, clone(move))); }
export async function readCachedPokemonNameIndex() { return readStore(NAME_INDEX_STORE, NAME_INDEX_KEY); }
export function saveCachedPokemonNameIndex(index) {
  return queueCacheWrite(() => writeStore(NAME_INDEX_STORE, { ...clone(index), key: NAME_INDEX_KEY }));
}

export async function getCachedDataCounts() {
  const [pokemon, moves, nameIndexes] = await Promise.all([
    countStore(POKEMON_STORE), countStore(MOVE_STORE), countStore(NAME_INDEX_STORE)
  ]);
  return { pokemon, moves, nameIndexes };
}

export function clearCachedData() {
  return queueCacheWrite(() => clearStores([POKEMON_STORE, MOVE_STORE, NAME_INDEX_STORE]));
}
