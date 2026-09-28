import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INTERVALS, emptyBudget, allocatedForGroup, balanceFor, netSpentFor,
  netTransfersFor, currentDaily, currentAllocation, groupAllocation,
  dailyCentsFromInterval
} from './budget.js';

const category = (id, dailyCents, groupId = 'general') => ({
  id,
  name: id,
  groupId,
  createdDay: '2026-09-28',
  startingCents: 0,
  changes: [{ day: '2026-09-28', dailyCents }]
});

test('new budgets use the clean v2 shape and 30-day interval', () => {
  const budget = emptyBudget();
  assert.deepEqual(budget.groups, []);
  assert.deepEqual(budget.categories, []);
  assert.deepEqual(budget.purchases, []);
  assert.deepEqual(budget.transfers, []);
  assert.equal(budget.interval, '30-days');
  assert.equal(budget.dayOffset, 0);
});

test('interval allocations derive from a constant daily rate', () => {
  const item = category('games', 100);
  assert.equal(currentDaily(item), 100);
  assert.equal(currentAllocation(item, '2-weeks'), 1400);
  assert.equal(currentAllocation(item, '4-weeks'), 2800);
  assert.equal(currentAllocation(item, '30-days'), 3000);
  assert.ok(Math.abs(currentAllocation(item, '1-month') - 100 * 365 / 12) < 1e-9);
});

test('entering equivalent interval budgets produces the same daily accrual', () => {
  assert.equal(dailyCentsFromInterval(1400, '2-weeks'), 100);
  assert.equal(dailyCentsFromInterval(2800, '4-weeks'), 100);
  assert.equal(dailyCentsFromInterval(3000, '30-days'), 100);
  assert.ok(Math.abs(dailyCentsFromInterval(100 * 365 / 12, '1-month') - 100) < 1e-9);
});

test('group targets change display amount with the interval while daily target stays constant', () => {
  const group = { id: 'fun', name: 'Fun', dailyCents: 250 };
  assert.equal(groupAllocation(group, '2-weeks'), 3500);
  assert.equal(groupAllocation(group, '4-weeks'), 7000);
  assert.equal(groupAllocation(group, '30-days'), 7500);
  assert.ok(Math.abs(groupAllocation(group, '1-month') - 250 * 365 / 12) < 1e-9);
});

test('group allocation previews include changed, moved, and new categories', () => {
  const categories = [category('clothes', 100, 'needs'), category('games', 50, 'fun')];
  assert.equal(allocatedForGroup(categories, 'needs', '30-days'), 3000);
  assert.equal(allocatedForGroup(categories, 'needs', '30-days', category('crafts', 25, 'needs')), 3750);
  assert.equal(allocatedForGroup(categories, 'needs', '30-days', category('games', 75, 'needs')), 5250);
  assert.equal(allocatedForGroup(categories, 'fun', '30-days', category('games', 75, 'needs')), 0);
});

test('balance accrues the stored daily rate regardless of display interval', () => {
  const item = { ...category('clothes', 100), startingCents: 1000 };
  const budget30 = { groups: [], categories: [item], purchases: [], transfers: [], interval: '30-days', dayOffset: 0 };
  const budget2w = { ...budget30, interval: '2-weeks' };
  assert.equal(balanceFor(item, [], budget30, '2026-09-30'), 1200);
  assert.equal(balanceFor(item, [], budget2w, '2026-09-30'), 1200);
});

test('transfers move balance without changing spending', () => {
  const clothes = { ...category('clothes', 100), startingCents: 3000 };
  const games = { ...category('games', 100), startingCents: 1000 };
  const transfer = {
    id: 't1',
    fromCategoryId: 'clothes',
    toCategoryId: 'games',
    amountCents: 750,
    day: '2026-09-28',
    createdAt: '2026-09-28T12:00:00.000Z'
  };
  const budget = {
    groups: [],
    categories: [clothes, games],
    purchases: [],
    transfers: [transfer],
    interval: '30-days',
    dayOffset: 0
  };
  assert.equal(balanceFor(clothes, [], budget, '2026-09-28'), 2250);
  assert.equal(balanceFor(games, [], budget, '2026-09-28'), 1750);
  assert.equal(netTransfersFor(clothes, budget.transfers, '2026-09-28'), -750);
  assert.equal(netTransfersFor(games, budget.transfers, '2026-09-28'), 750);
  assert.equal(netSpentFor(clothes, [], '2026-09-28'), 0);
});

test('one month is 365/12 days', () => {
  assert.equal(INTERVALS['1-month'].days, 365 / 12);
});
