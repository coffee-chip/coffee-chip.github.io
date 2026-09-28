export const STORAGE_KEY = 'piggy-budget-v1';

export const INTERVALS = {
  '2-weeks': { label: '2 weeks', days: 14 },
  '4-weeks': { label: '4 weeks', days: 28 },
  '30-days': { label: '30 days', days: 30 },
  '1-month': { label: '1 month', days: 365 / 12 }
};

export const emptyBudget = () => ({
  groups: [],
  categories: [],
  purchases: [],
  transfers: [],
  intervalChanges: [{ day: localDay(), interval: '30-days' }],
  dayOffset: 0
});

export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dayNumber(day) {
  const [year, month, date] = day.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, date) / 86400000);
}

export function addDays(day, count) {
  return new Date((dayNumber(day) + count) * 86400000).toISOString().slice(0, 10);
}

export function cents(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) return null;
  const rounded = Math.round(amount * 100);
  return Math.abs(amount * 100 - rounded) < 0.000001 ? rounded : null;
}

export function currentAllocation(category) {
  return category.changes[category.changes.length - 1].intervalCents;
}

export function currentInterval(budget) {
  return budget.intervalChanges[budget.intervalChanges.length - 1].interval;
}

export function intervalForDay(budget, day) {
  let interval = budget.intervalChanges[0]?.interval || '30-days';
  for (const change of budget.intervalChanges) {
    if (change.day > day) break;
    interval = change.interval;
  }
  return interval;
}

export function dailyAccrual(category, interval) {
  return currentAllocation(category) / INTERVALS[interval].days;
}

function migrateCategory(category, fallbackGroupId) {
  return {
    id: category.id,
    name: category.name,
    icon: category.icon,
    groupId: category.groupId || category.supercategoryId || fallbackGroupId,
    createdDay: category.createdDay,
    startingCents: category.startingCents,
    changes: Array.isArray(category.changes) ? category.changes.map(change => ({
      day: change.day,
      intervalCents: change.intervalCents ?? change.monthlyCents
    })) : []
  };
}

export function normalizeBudget(saved) {
  const sourceCategories = Array.isArray(saved?.categories) ? saved.categories : [];
  const legacyGroups = Array.isArray(saved?.groups) ? saved.groups : Array.isArray(saved?.supercategories) ? saved.supercategories : [];
  let groups = legacyGroups.map(group => ({
    id: group.id,
    name: group.name,
    intervalCents: group.intervalCents ?? group.monthlyCents ?? 0
  }));

  let fallbackGroupId = groups[0]?.id || 'general';
  let categories = sourceCategories.map(category => migrateCategory(category, fallbackGroupId));
  if (!groups.length && categories.length) {
    groups = [{
      id: 'general',
      name: 'General',
      intervalCents: categories.reduce((sum, category) => sum + currentAllocation(category), 0)
    }];
    categories = categories.map(category => ({ ...category, groupId: 'general' }));
  }

  const earliestDay = categories.map(category => category.createdDay).filter(Boolean).sort()[0] || localDay();
  const intervalChanges = Array.isArray(saved?.intervalChanges) && saved.intervalChanges.length
    ? saved.intervalChanges.map(change => ({ day: change.day, interval: INTERVALS[change.interval] ? change.interval : '30-days' }))
    : [{ day: earliestDay, interval: '30-days' }];

  return {
    groups,
    categories,
    purchases: Array.isArray(saved?.purchases) ? saved.purchases : [],
    transfers: Array.isArray(saved?.transfers) ? saved.transfers : [],
    intervalChanges,
    dayOffset: Number.isSafeInteger(saved?.dayOffset) && saved.dayOffset >= 0 ? saved.dayOffset : 0
  };
}

export function allocatedForGroup(categories, groupId, replacement = null) {
  return categories.reduce((sum, category) => {
    const entry = replacement?.id === category.id ? replacement : category;
    return sum + (entry.groupId === groupId ? currentAllocation(entry) : 0);
  }, 0) + (replacement && !categories.some(category => category.id === replacement.id) && replacement.groupId === groupId ? currentAllocation(replacement) : 0);
}

export function balanceFor(category, purchases, budget, today = localDay()) {
  let balance = category.startingCents;
  let allocation = category.changes[0].intervalCents;
  let changeIndex = 0;
  const purchasesByDay = purchases.filter(purchase => purchase.categoryId === category.id && purchase.day <= today)
    .sort((a, b) => a.day.localeCompare(b.day));
  let purchaseIndex = 0;
  const start = dayNumber(category.createdDay);
  const end = dayNumber(today);
  if (end < start) return balance;

  for (let day = start; day <= end; day++) {
    const date = new Date(day * 86400000).toISOString().slice(0, 10);
    if (day > start) {
      const interval = intervalForDay(budget, addDays(date, -1));
      balance += allocation / INTERVALS[interval].days;
    }
    while (changeIndex + 1 < category.changes.length && category.changes[changeIndex + 1].day <= date) {
      allocation = category.changes[++changeIndex].intervalCents;
    }
    while (purchaseIndex < purchasesByDay.length && purchasesByDay[purchaseIndex].day === date) {
      balance -= purchasesByDay[purchaseIndex++].amountCents;
    }
    for (const transfer of budget.transfers) {
      if (transfer.day !== date) continue;
      if (transfer.fromCategoryId === category.id) balance -= transfer.amountCents;
      if (transfer.toCategoryId === category.id) balance += transfer.amountCents;
    }
  }
  return balance;
}

export function netSpentFor(category, purchases, today = localDay()) {
  return purchases.reduce((total, purchase) =>
    total + (purchase.categoryId === category.id && purchase.day <= today ? purchase.amountCents : 0), 0);
}

export function netTransfersFor(category, transfers, today = localDay()) {
  return transfers.reduce((total, transfer) => {
    if (transfer.day > today) return total;
    if (transfer.fromCategoryId === category.id) return total - transfer.amountCents;
    if (transfer.toCategoryId === category.id) return total + transfer.amountCents;
    return total;
  }, 0);
}

export const dollars = amountCents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amountCents / 100);
