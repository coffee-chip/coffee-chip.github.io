import { INTERVALS, localDay, bucketRef } from './budget.js';
import {
  budget, budgetDay, save, validDay, setupPage
} from './core.js';

function validatedBackup(value) {
  if (value?.format !== 'piggy-budget' || value?.version !== 4 || !value.data) {
    throw new Error('This is not a current Piggy Budget backup.');
  }
  const data = value.data;
  if (
    !Array.isArray(data.groups) ||
    !Array.isArray(data.categories) ||
    !Array.isArray(data.goals) ||
    !Array.isArray(data.purchases) ||
    !Array.isArray(data.transfers) ||
    !INTERVALS[data.interval] ||
    !Number.isSafeInteger(data.dayOffset) ||
    data.dayOffset < 0
  ) throw new Error('Backup data is incomplete.');

  const groupIds = new Set();
  for (const group of data.groups) {
    if (
      !group?.id ||
      groupIds.has(group.id) ||
      !group.name?.trim() ||
      !Number.isFinite(group.dailyCents) ||
      group.dailyCents < 0 ||
      (group.unlimited !== undefined && typeof group.unlimited !== 'boolean')
    ) throw new Error('Backup has an invalid group.');
    groupIds.add(group.id);
  }

  const categoryIds = new Set();
  for (const category of data.categories) {
    if (
      !category?.id ||
      categoryIds.has(category.id) ||
      !category.name?.trim() ||
      !validDay(category.createdDay) ||
      !Number.isSafeInteger(category.startingCents) ||
      category.startingCents < 0 ||
      !groupIds.has(category.groupId) ||
      !Array.isArray(category.changes) ||
      !category.changes.length
    ) throw new Error('Backup has an invalid category.');
    if (category.changes.some(change =>
      !validDay(change.day) || !Number.isFinite(change.dailyCents) || change.dailyCents <= 0
    )) throw new Error('Backup has invalid allocation history.');
    categoryIds.add(category.id);
  }

  const goalIds = new Set();
  for (const goal of data.goals) {
    if (
      !goal?.id ||
      goalIds.has(goal.id) ||
      !goal.name?.trim() ||
      !groupIds.has(goal.groupId) ||
      !Number.isSafeInteger(goal.targetCents) ||
      goal.targetCents <= 0 ||
      !Number.isSafeInteger(goal.startingCents) ||
      goal.startingCents < 0
    ) throw new Error('Backup has an invalid goal.');
    goalIds.add(goal.id);
  }

  const bucketIds = new Set([
    ...[...categoryIds].map(id => bucketRef('category', id)),
    ...[...goalIds].map(id => bucketRef('goal', id))
  ]);

  for (const purchase of data.purchases) {
    if (
      !purchase?.id ||
      !categoryIds.has(purchase.categoryId) ||
      !validDay(purchase.day) ||
      !Number.isSafeInteger(purchase.amountCents) ||
      purchase.amountCents === 0
    ) throw new Error('Backup has an invalid transaction.');
  }

  for (const transfer of data.transfers) {
    if (
      !transfer?.id ||
      !bucketIds.has(transfer.fromBucketId) ||
      !bucketIds.has(transfer.toBucketId) ||
      transfer.fromBucketId === transfer.toBucketId ||
      !validDay(transfer.day) ||
      !Number.isSafeInteger(transfer.amountCents) ||
      transfer.amountCents <= 0
    ) throw new Error('Backup has an invalid transfer.');
  }

  return data;
}

function downloadBackup() {
  const payload = {
    format: 'piggy-budget',
    version: 4,
    exportedAt: new Date().toISOString(),
    data: budget
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `piggy-budget-backup-${localDay()}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function renderIntervalSetting() {
  const select = document.querySelector('#budget-interval');
  if (!select) return;
  select.value = budget.interval;
  const description = document.querySelector('#interval-description');
  if (description) description.textContent =
    'Changing the interval recalculates displayed allocation amounts while keeping each category’s daily accrual unchanged.';
}

const intervalSelect = document.querySelector('#budget-interval');
if (intervalSelect) {
  intervalSelect.addEventListener('change', () => {
    const interval = intervalSelect.value;
    if (!INTERVALS[interval]) return;
    if (save({ ...budget, interval })) renderPage();
  });
}



const backupButton = document.querySelector('#download-backup');
const restoreInput = document.querySelector('#restore-backup');

if (backupButton) {
  backupButton.addEventListener('click', () => {
    downloadBackup();
    document.querySelector('#backup-message').textContent = 'Backup downloaded.';
  });
}

if (restoreInput) {
  restoreInput.addEventListener('change', async () => {
    const message = document.querySelector('#backup-message');
    const file = restoreInput.files?.[0];
    if (!file) return;

    try {
      const restored = validatedBackup(JSON.parse(await file.text()));
      if (confirm('Restore this backup? This will replace the current budget data.')) {
        save(restored, message);
        renderPage();
        message.textContent = 'Backup restored.';
      }
    } catch (error) {
      message.textContent = error instanceof Error ? error.message : 'Could not restore backup.';
    } finally {
      restoreInput.value = '';
    }
  });
}

const advanceButton = document.querySelector('#advance-day');



if (advanceButton) {
  advanceButton.addEventListener('click', () => {
    const message = document.querySelector('#advance-message');
    if (save({ ...budget, dayOffset: (budget.dayOffset || 0) + 1 }, message)) renderPage();
  });
}



function renderSimulation() {
  const status = document.querySelector('#simulation-status');
  if (!status) return;
  const advanced = budget.dayOffset || 0;
  status.textContent = `Budget date: ${budgetDay()} · ${advanced} day${advanced === 1 ? '' : 's'} advanced`;
}

function renderPage() {
  renderIntervalSetting();
  renderSimulation();
}

setupPage(renderPage);
