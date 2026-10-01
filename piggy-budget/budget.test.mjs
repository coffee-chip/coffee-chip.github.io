import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INTERVALS, emptyBudget, allocatedForGroup, balanceFor, goalBalanceFor,
  bucketBalanceFor, canTransferFrom, netSpentFor, netTransfersFor, bucketRef, currentDaily, currentAllocation,
  groupAllocation, dailyCentsFromInterval
} from './budget.js';

const category = (id, dailyCents, groupId = 'general') => ({
  id,
  name: id,
  groupId,
  createdDay: '2026-09-28',
  startingCents: 0,
  changes: [{ day: '2026-09-28', dailyCents }]
});

const goal = (id, targetCents, groupId = 'general') => ({
  id,
  name: id,
  groupId,
  icon: '🎯',
  targetCents,
  startingCents: 0,
  createdDay: '2026-09-28'
});

test('new budgets seed one unlimited General group and use the v3 shape', () => {
  const budget = emptyBudget();
  assert.deepEqual(budget.groups, [{
    id: 'general',
    name: 'General',
    dailyCents: 0,
    unlimited: true
  }]);
  assert.deepEqual(budget.categories, []);
  assert.deepEqual(budget.goals, []);
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
  const groupEntry = { id: 'fun', name: 'Fun', dailyCents: 250 };
  assert.equal(groupAllocation(groupEntry, '2-weeks'), 3500);
  assert.equal(groupAllocation(groupEntry, '4-weeks'), 7000);
  assert.equal(groupAllocation(groupEntry, '30-days'), 7500);
  assert.ok(Math.abs(groupAllocation(groupEntry, '1-month') - 250 * 365 / 12) < 1e-9);
});

test('goals do not count toward group category allocation totals', () => {
  const categories = [category('clothes', 100, 'needs'), category('games', 50, 'fun')];
  assert.equal(allocatedForGroup(categories, 'needs', '30-days'), 3000);
  assert.equal(allocatedForGroup(categories, 'fun', '30-days'), 1500);
});

test('category balances accrue daily regardless of display interval', () => {
  const item = { ...category('clothes', 100), startingCents: 1000 };
  const budget30 = { groups: [], categories: [item], goals: [], purchases: [], transfers: [], interval: '30-days', dayOffset: 0 };
  const budget2w = { ...budget30, interval: '2-weeks' };
  assert.equal(balanceFor(item, [], budget30, '2026-09-30'), 1200);
  assert.equal(balanceFor(item, [], budget2w, '2026-09-30'), 1200);
});

test('transfers move money between categories and goals', () => {
  const clothes = { ...category('clothes', 100), startingCents: 3000 };
  const vacation = goal('vacation', 10000);
  const transfer = {
    id: 't1',
    fromBucketId: bucketRef('category', 'clothes'),
    toBucketId: bucketRef('goal', 'vacation'),
    amountCents: 750,
    day: '2026-09-28',
    createdAt: '2026-09-28T12:00:00.000Z'
  };
  const budget = {
    groups: [],
    categories: [clothes],
    goals: [vacation],
    purchases: [],
    transfers: [transfer],
    interval: '30-days',
    dayOffset: 0
  };
  assert.equal(balanceFor(clothes, [], budget, '2026-09-28'), 2250);
  assert.equal(goalBalanceFor(vacation, budget.transfers, '2026-09-28'), 750);
  assert.equal(netTransfersFor(clothes, budget.transfers, '2026-09-28'), -750);
  assert.equal(netSpentFor(clothes, [], '2026-09-28'), 0);
});

test('money can transfer back out of a goal', () => {
  const vacation = goal('vacation', 10000);
  const transfers = [
    {
      id: 't1',
      fromBucketId: bucketRef('category', 'clothes'),
      toBucketId: bucketRef('goal', 'vacation'),
      amountCents: 1200,
      day: '2026-09-28'
    },
    {
      id: 't2',
      fromBucketId: bucketRef('goal', 'vacation'),
      toBucketId: bucketRef('category', 'clothes'),
      amountCents: 300,
      day: '2026-09-29'
    }
  ];
  assert.equal(goalBalanceFor(vacation, transfers, '2026-09-29'), 900);
});

test('one month is 365/12 days', () => {
  assert.equal(INTERVALS['1-month'].days, 365 / 12);
});


test('transfer can use the full source balance but not exceed it', () => {
  const clothes = { ...category('clothes', 100), startingCents: 3000 };
  const vacation = goal('vacation', 10000);
  const budget = {
    groups: [],
    categories: [clothes],
    goals: [vacation],
    purchases: [],
    transfers: [],
    interval: '30-days',
    dayOffset: 0
  };
  const source = bucketRef('category', 'clothes');
  assert.equal(bucketBalanceFor(source, budget, '2026-09-28'), 3000);
  assert.equal(canTransferFrom(source, 3000, budget, '2026-09-28'), true);
  assert.equal(canTransferFrom(source, 3001, budget, '2026-09-28'), false);
});

test('goal source transfers also cannot make the goal negative', () => {
  const clothes = { ...category('clothes', 100), startingCents: 3000 };
  const vacation = goal('vacation', 10000);
  const transfer = {
    id: 'fund-goal',
    fromBucketId: bucketRef('category', 'clothes'),
    toBucketId: bucketRef('goal', 'vacation'),
    amountCents: 1200,
    day: '2026-09-28'
  };
  const budget = {
    groups: [],
    categories: [clothes],
    goals: [vacation],
    purchases: [],
    transfers: [transfer],
    interval: '30-days',
    dayOffset: 0
  };
  const source = bucketRef('goal', 'vacation');
  assert.equal(bucketBalanceFor(source, budget, '2026-09-28'), 1200);
  assert.equal(canTransferFrom(source, 1200, budget, '2026-09-28'), true);
  assert.equal(canTransferFrom(source, 1201, budget, '2026-09-28'), false);
});
