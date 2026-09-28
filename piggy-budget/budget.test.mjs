import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INTERVALS, normalizeBudget, allocatedForGroup, balanceFor, netSpentFor,
  netTransfersFor, currentInterval, dailyAccrual
} from './budget.js';

const category = (id, intervalCents, groupId = 'general') => ({
  id, name: id, groupId, createdDay: '2026-09-28', startingCents: 0,
  changes: [{ day: '2026-09-28', intervalCents }]
});

test('legacy supercategories and monthly allocations migrate to groups and 30 days', () => {
  const legacy = {
    categories: [{ id: 'clothes', name: 'Clothes', supercategoryId: 'fun', createdDay: '2026-09-28', startingCents: 5000, changes: [{ day: '2026-09-28', monthlyCents: 5000 }] }],
    supercategories: [{ id: 'fun', name: 'Fun', monthlyCents: 5000 }],
    purchases: []
  };
  const upgraded = normalizeBudget(legacy);
  assert.equal(upgraded.groups[0].intervalCents, 5000);
  assert.equal(upgraded.categories[0].groupId, 'fun');
  assert.equal(upgraded.categories[0].changes[0].intervalCents, 5000);
  assert.equal(currentInterval(upgraded), '30-days');
});

test('group allocation previews include changed, moved, and new categories', () => {
  const categories = [category('clothes', 5000, 'needs'), category('games', 2000, 'fun')];
  assert.equal(allocatedForGroup(categories, 'needs'), 5000);
  assert.equal(allocatedForGroup(categories, 'needs', category('crafts', 3000, 'needs')), 8000);
  assert.equal(allocatedForGroup(categories, 'needs', category('games', 4000, 'needs')), 9000);
  assert.equal(allocatedForGroup(categories, 'fun', category('games', 4000, 'needs')), 0);
});

test('daily accrual uses the selected budget interval', () => {
  const item = category('games', 14000);
  assert.equal(dailyAccrual(item, '2-weeks'), 1000);
  assert.equal(dailyAccrual(item, '4-weeks'), 500);
  assert.ok(Math.abs(dailyAccrual(item, '30-days') - 14000 / 30) < 1e-9);
  assert.ok(Math.abs(dailyAccrual(item, '1-month') - 14000 * 12 / 365) < 1e-9);
});

test('interval changes affect future accrual without rewriting earlier days', () => {
  const budget = normalizeBudget({
    groups: [{ id: 'general', name: 'General', intervalCents: 3000 }],
    categories: [{ ...category('clothes', 3000), startingCents: 0 }],
    purchases: [], transfers: [],
    intervalChanges: [{ day: '2026-09-28', interval: '30-days' }, { day: '2026-09-30', interval: '2-weeks' }]
  });
  const item = budget.categories[0];
  assert.ok(Math.abs(balanceFor(item, [], budget, '2026-09-30') - 200) < 1e-9);
  assert.ok(Math.abs(balanceFor(item, [], budget, '2026-10-01') - (200 + 3000 / 14)) < 1e-9);
});

test('transfers move balance without changing spending', () => {
  const budget = normalizeBudget({
    groups: [{ id: 'general', name: 'General', intervalCents: 6000 }],
    categories: [
      { ...category('clothes', 3000), startingCents: 3000 },
      { ...category('games', 3000), startingCents: 1000 }
    ],
    purchases: [],
    transfers: [{ id: 't1', fromCategoryId: 'clothes', toCategoryId: 'games', amountCents: 750, day: '2026-09-28', createdAt: '2026-09-28T12:00:00.000Z' }],
    intervalChanges: [{ day: '2026-09-28', interval: '30-days' }]
  });
  const clothes = budget.categories[0], games = budget.categories[1];
  assert.equal(balanceFor(clothes, [], budget, '2026-09-28'), 2250);
  assert.equal(balanceFor(games, [], budget, '2026-09-28'), 1750);
  assert.equal(netTransfersFor(clothes, budget.transfers, '2026-09-28'), -750);
  assert.equal(netTransfersFor(games, budget.transfers, '2026-09-28'), 750);
  assert.equal(netSpentFor(clothes, [], '2026-09-28'), 0);
});

test('one month uses 365/12 days', () => {
  assert.equal(INTERVALS['1-month'].days, 365 / 12);
});
