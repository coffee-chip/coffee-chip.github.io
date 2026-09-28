import test from 'node:test';
import assert from 'node:assert/strict';
import { allocatedFor, balanceFor, netSpentFor, netTransfersFor, withSupercategories } from './budget.js';

const category = (id, monthlyCents, supercategoryId) => ({ id, supercategoryId, changes: [{ day: '2026-09-28', monthlyCents }] });

test('old budgets retain their allocations in a General supercategory', () => {
  const old = { categories: [category('clothes', 5000), category('games', 2000)], purchases: [{ id: 'one' }] };
  const upgraded = withSupercategories(old);
  assert.equal(upgraded.supercategories[0].monthlyCents, 7000);
  assert.deepEqual(upgraded.categories.map((entry) => entry.supercategoryId), ['general', 'general']);
  assert.deepEqual(upgraded.purchases, old.purchases);
});

test('projected allocation includes new categories and changed or moved ones', () => {
  const categories = [category('clothes', 5000, 'needs'), category('games', 2000, 'fun')];
  assert.equal(allocatedFor(categories, 'needs'), 5000);
  assert.equal(allocatedFor(categories, 'needs', category('crafts', 3000, 'needs')), 8000);
  assert.equal(allocatedFor(categories, 'needs', category('games', 4000, 'needs')), 9000);
  assert.equal(allocatedFor(categories, 'fun', category('games', 4000, 'needs')), 0);
});

test('accumulated equals remaining plus spending net of refunds', () => {
  const bucket = { ...category('clothes', 3000, 'general'), createdDay: '2026-09-28', startingCents: 3000 };
  const purchases = [
    { categoryId: 'clothes', day: '2026-09-28', amountCents: 1200 },
    { categoryId: 'clothes', day: '2026-09-28', amountCents: -300 },
    { categoryId: 'games', day: '2026-09-28', amountCents: 500 },
    { categoryId: 'clothes', day: '2026-09-30', amountCents: 200 }
  ];
  const remaining = balanceFor(bucket, purchases, '2026-09-29');
  const spent = netSpentFor(bucket, purchases, '2026-09-29');
  assert.equal(spent, 900);
  assert.equal(remaining + spent, 3100);
});


test('old budgets gain an empty transfer list', () => {
  const upgraded = withSupercategories({ categories: [], supercategories: [], purchases: [], dayOffset: 0 });
  assert.deepEqual(upgraded.transfers, []);
});

test('transfers move balance without changing spending', () => {
  const clothes = { ...category('clothes', 3000, 'general'), createdDay: '2026-09-28', startingCents: 3000 };
  const games = { ...category('games', 3000, 'general'), createdDay: '2026-09-28', startingCents: 1000 };
  const transfers = [{ id: 't1', fromCategoryId: 'clothes', toCategoryId: 'games', amountCents: 750, day: '2026-09-28', createdAt: '2026-09-28T12:00:00.000Z' }];
  assert.equal(balanceFor(clothes, [], '2026-09-28', transfers), 2250);
  assert.equal(balanceFor(games, [], '2026-09-28', transfers), 1750);
  assert.equal(netTransfersFor(clothes, transfers, '2026-09-28'), -750);
  assert.equal(netTransfersFor(games, transfers, '2026-09-28'), 750);
  assert.equal(netSpentFor(clothes, [], '2026-09-28'), 0);
  assert.equal(netSpentFor(games, [], '2026-09-28'), 0);
});
