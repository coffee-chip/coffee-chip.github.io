import assert from 'node:assert/strict';

function clone(value) { return value == null ? value : structuredClone(value); }

class MockDatabase {
  constructor() {
    this.objectStoreNames = [];
    this.objectStoreNames.item = index => this.objectStoreNames[index] ?? null;
    this.stores = new Map();
    this.failNextAppWrite = false;
    this.failNextAppRead = false;
    this.onversionchange = null;
  }

  createObjectStore(name, { keyPath }) {
    this.objectStoreNames.push(name);
    const definition = { keyPath, records: new Map(), indexes: new Map() };
    this.stores.set(name, definition);
    return {
      createIndex: (indexName, field) => definition.indexes.set(indexName, field)
    };
  }

  deleteObjectStore(name) {
    this.objectStoreNames = this.objectStoreNames.filter(candidate => candidate !== name);
    this.objectStoreNames.item = index => this.objectStoreNames[index] ?? null;
    this.stores.delete(name);
  }

  close() {}

  transaction(storeNames, mode) {
    const names = Array.isArray(storeNames) ? storeNames : [storeNames];
    const transaction = { oncomplete: null, onerror: null, onabort: null, error: null };
    const delay = names.some(name => name !== 'app-state') && mode === 'readwrite' ? 40 : 0;
    const request = result => {
      const value = {};
      queueMicrotask(() => {
        value.result = clone(result());
        value.onsuccess?.();
      });
      return value;
    };
    const failedRequest = error => {
      const value = {};
      queueMicrotask(() => {
        value.error = error;
        value.onerror?.();
      });
      return value;
    };
    transaction.objectStore = name => {
      const store = this.stores.get(name);
      return {
        get: key => {
          if (name === 'app-state' && this.failNextAppRead) {
            this.failNextAppRead = false;
            return failedRequest(new Error('Synthetic app-state read failure'));
          }
          return request(() => store.records.get(key) ?? null);
        },
        count: () => request(() => store.records.size),
        put: value => {
          store.records.set(value[store.keyPath], clone(value));
          return {};
        },
        clear: () => store.records.clear(),
        index: indexName => ({
          get: key => request(() => {
            const field = store.indexes.get(indexName);
            return [...store.records.values()].find(value => value[field] === key) ?? null;
          })
        })
      };
    };
    if (mode === 'readwrite') {
      setTimeout(() => {
        if (names.includes('app-state') && this.failNextAppWrite) {
          this.failNextAppWrite = false;
          transaction.error = new Error('Synthetic app-state failure');
          transaction.onabort?.();
        } else transaction.oncomplete?.();
      }, delay);
    }
    return transaction;
  }
}

const database = new MockDatabase();
let databaseOpened = false;
globalThis.indexedDB = {
  open() {
    const request = {};
    queueMicrotask(() => {
      request.result = database;
      if (!databaseOpened) {
        databaseOpened = true;
        request.onupgradeneeded?.();
      }
      queueMicrotask(() => request.onsuccess?.());
    });
    return request;
  }
};

const storage = await import(`../js/storage.js?test=${Date.now()}`);
const initial = await storage.loadPersistentData();
assert.equal(initial.version, 14);
assert.equal(await storage.flushPersistentWrites(), true);

const settings = structuredClone(initial.settings);
const writes = [];
for (const appearance of ['light', 'dark', 'system']) {
  settings.appearance = appearance;
  writes.push(storage.saveSettings(settings));
}
assert.deepEqual(await Promise.all(writes), [true, true, true]);
assert.equal(storage.getPersistentDataSnapshot().settings.appearance, 'system');
assert.equal(storage.getStorageStatus().pendingAppStateWrites, 0);

const cacheWrite = storage.saveCachedPokemon({ id: 1, name: 'bulbasaur' });
settings.appearance = 'dark';
const stateWrite = storage.saveSettings(settings);
assert.equal(await stateWrite, true, 'App state must not wait behind disposable cache writes.');
assert.equal(storage.getStorageStatus().pendingCacheWrites, 1);
assert.equal(await cacheWrite, true);

database.failNextAppWrite = true;
settings.appearance = 'light';
const originalWarn = console.warn;
console.warn = () => {};
assert.equal(await storage.saveSettings(settings), false);
console.warn = originalWarn;
assert.equal(storage.getStorageStatus().appState, 'error');
assert.equal(storage.getStorageStatus().lastError?.scope, 'appState');

settings.appearance = 'system';
assert.equal(await storage.saveSettings(settings), true);
assert.equal(storage.getStorageStatus().appState, 'idle');
assert.equal(storage.getStorageStatus().lastError, null);
assert.equal(await storage.flushPersistentWrites(), true);

database.failNextAppRead = true;
const secondStorageContext = await import(`../js/storage.js?read-failure=${Date.now()}`);
console.warn = () => {};
await assert.rejects(secondStorageContext.loadPersistentData(), /Synthetic app-state read failure/);
console.warn = originalWarn;
assert.equal(secondStorageContext.getStorageStatus().pendingAppStateWrites, 0, 'A failed read must not queue a default-state overwrite.');

database.stores.get('app-state').records.set('current', { key: 'current', data: { version: 14, settings: null } });
const corruptedStorageContext = await import(`../js/storage.js?corrupt=${Date.now()}`);
const recovered = await corruptedStorageContext.loadPersistentData();
assert.equal(recovered.settings.gameVersionGroup, 'firered-leafgreen');
assert.equal(recovered.teams.length, 2);
assert.equal(await corruptedStorageContext.flushPersistentWrites(), true);

console.log('Storage queue, coalescing, priority, and failure recovery checks passed.');
