import { expect, test } from '@playwright/test';

const DATABASE_NAME = 'pokemon-type-trainer';
const DATABASE_VERSION = 2;

function seededAppState() {
  const instanceId = 'ci-owned-bulbasaur';
  return {
    version: 14,
    settings: {
      paletteTheme: 'classic',
      appearance: 'system',
      gameVersionGroup: 'firered-leafgreen',
      developer: { autoUpdateOnLaunch: false, showOverlay: false, showErrorOverlay: false },
      quiz: { defaultMode: 'choose-switch', modes: { 'choose-switch': {} } }
    },
    progress: { quizStats: {}, relationshipStats: {}, pokemonRecognitionStats: {} },
    starredMoves: [],
    recentPokemonIds: [],
    pokemonInstances: {
      [instanceId]: { id: instanceId, speciesId: 1, nickname: 'Sprout', level: 12, currentMoves: ['tackle'] }
    },
    myPokemonIds: [instanceId],
    teams: [
      { id: 'my-team', title: 'My team', isOpponent: false, rivalTeamId: null, memberIds: [instanceId] },
      { id: 'opponents', title: 'Opponents', isOpponent: true, rivalTeamId: null, memberIds: [] }
    ]
  };
}

function seededPokemon() {
  return {
    cacheSchemaVersion: 2,
    id: 1,
    name: 'bulbasaur',
    displayName: 'Bulbasaur',
    currentTypes: ['grass', 'poison'],
    typeHistory: [],
    spriteUrl: './icons/app-icon.svg',
    speciesName: 'bulbasaur',
    evolution: { previous: [], next: [] },
    encounterLocations: {},
    levelUpMoveHistory: [],
    fetchedAt: new Date().toISOString()
  };
}

async function seedPopulatedTeam(page) {
  await page.goto('/pokemon/ci-seed-origin');
  await page.evaluate(async ({ databaseName, databaseVersion, appState, pokemon }) => {
    await new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(databaseName);
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('IndexedDB reset was blocked.'));
    });

    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open(databaseName, databaseVersion);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore('app-state', { keyPath: 'key' });
        const pokemonStore = db.createObjectStore('pokemon', { keyPath: 'id' });
        pokemonStore.createIndex('name', 'name', { unique: true });
        db.createObjectStore('moves', { keyPath: 'name' });
        db.createObjectStore('pokemon-name-indexes', { keyPath: 'key' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    await new Promise((resolve, reject) => {
      const transaction = database.transaction(['app-state', 'pokemon'], 'readwrite');
      transaction.objectStore('app-state').put({ key: 'current', data: appState });
      transaction.objectStore('pokemon').put(pokemon);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
  }, {
    databaseName: DATABASE_NAME,
    databaseVersion: DATABASE_VERSION,
    appState: seededAppState(),
    pokemon: seededPokemon()
  });
}

async function expectOwnedPokemon(page) {
  await expect(page).toHaveURL(/#my-pokemon$/);
  await expect(page.locator('.owned-pokemon-page')).toBeVisible();
  await expect(page.locator('.owned-pokemon-name')).toHaveText('Sprout');
}

async function expectTeams(page) {
  await expect(page).toHaveURL(/#teams$/);
  await expect(page.locator('.teams-page')).toBeVisible();
  await expect(page.locator('.team-pokemon-slot img')).toHaveCount(1);
  await expect(page.locator('.team-pokemon-slot')).toHaveAttribute('aria-label', 'Sprout');
}

test('a populated team remains navigable and hydrated across repeated route changes', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await seedPopulatedTeam(page);
  await page.goto('/pokemon/#my-pokemon');
  await expectOwnedPokemon(page);

  const addButton = page.getByRole('button', { name: 'Add Pokémon' });
  await expect(addButton).toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'Pokémon name' })).toHaveCount(0);
  await addButton.click();
  await expect(page.getByRole('searchbox', { name: 'Pokémon name' })).toBeFocused();
  await page.getByRole('button', { name: 'Close Add Pokémon' }).click();
  await expect(page.getByRole('searchbox', { name: 'Pokémon name' })).toHaveCount(0);

  const filter = page.getByRole('searchbox', { name: 'Search My Pokémon' });
  await filter.fill('missing');
  await expect(page.locator('.owned-pokemon-card')).toBeHidden();
  await expect(page.locator('.owned-pokemon-count')).toHaveText('0 matching Pokémon');
  await filter.fill('prout');
  await expect(page.locator('.owned-pokemon-card')).toBeHidden();
  await filter.fill('spr');
  await expect(page.locator('.owned-pokemon-card')).toBeVisible();
  await filter.fill('rass');
  await expect(page.locator('.owned-pokemon-card')).toBeHidden();
  await filter.fill('gra');
  await expect(page.locator('.owned-pokemon-card')).toBeVisible();
  await filter.fill('');

  for (let pass = 0; pass < 3; pass += 1) {
    await page.getByRole('tab', { name: 'Teams' }).click();
    await expectTeams(page);
    await page.getByRole('tab', { name: 'My Pokémon' }).click();
    await expectOwnedPokemon(page);
  }

  await page.getByRole('tab', { name: 'Teams' }).click();
  await expectTeams(page);
  await page.getByRole('link', { name: 'Open My team' }).click();
  await expect(page).toHaveURL(/#team\/my-team$/);
  await expect(page.locator('.team-detail-member-name')).toHaveText('Sprout');

  await page.getByRole('link', { name: 'Progress' }).click();
  await expect(page).toHaveURL(/#progress$/);
  await page.getByRole('link', { name: 'Teams' }).click();
  await expectOwnedPokemon(page);

  await page.reload();
  await expectOwnedPokemon(page);
  await page.getByRole('tab', { name: 'Teams' }).click();
  await expectTeams(page);
  expect(pageErrors).toEqual([]);
});

test('the installed shell starts offline', async ({ browserName, context, page }) => {
  test.skip(browserName !== 'chromium', 'The navigation regression runs in WebKit; the offline service-worker assertion runs once in Chromium.');
  await page.goto('/pokemon/#my-pokemon');
  await expect(page.locator('.owned-pokemon-page')).toBeVisible();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; return true; });
  await expect.poll(() => page.evaluate(async () => {
    const names = await caches.keys();
    return names.some(name => name.startsWith('pokemon-type-trainer-'));
  })).toBe(true);

  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('.owned-pokemon-page')).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});
