export const STORAGE_KEY = 'piggy-budget-v3';

export const INTERVALS = {
  '2-weeks': { label: '2 weeks', days: 14 },
  '4-weeks': { label: '4 weeks', days: 28 },
  '30-days': { label: '30 days', days: 30 },
  '1-month': { label: '1 month', days: 365 / 12 }
};

export const emptyBudget = () => ({
  groups: [],
  categories: [],
  goals: [],
  purchases: [],
  transfers: [],
  interval: '30-days',
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

export function bucketRef(type, id) {
  return `${type}:${id}`;
}

export function currentDaily(category) {
  return category.changes[category.changes.length - 1].dailyCents;
}

function intervalCentsFromDaily(dailyCents, interval) {
  return dailyCents * INTERVALS[interval].days;
}

export function dailyCentsFromInterval(intervalCents, interval) {
  return intervalCents / INTERVALS[interval].days;
}

export function currentAllocation(category, interval) {
  return intervalCentsFromDaily(currentDaily(category), interval);
}

export function groupAllocation(group, interval) {
  return intervalCentsFromDaily(group.dailyCents, interval);
}

export function allocatedForGroup(categories, groupId, interval, replacement = null) {
  return categories.reduce((sum, category) => {
    const entry = replacement?.id === category.id ? replacement : category;
    return sum + (entry.groupId === groupId ? currentAllocation(entry, interval) : 0);
  }, 0) + (
    replacement &&
    !categories.some(category => category.id === replacement.id) &&
    replacement.groupId === groupId
      ? currentAllocation(replacement, interval)
      : 0
  );
}

function transferDeltaFor(ref, transfers, today = localDay()) {
  return transfers.reduce((total, transfer) => {
    if (transfer.day > today) return total;
    if (transfer.fromBucketId === ref) return total - transfer.amountCents;
    if (transfer.toBucketId === ref) return total + transfer.amountCents;
    return total;
  }, 0);
}

export function balanceFor(category, purchases, budget, today = localDay()) {
  let balance = category.startingCents;
  let dailyCents = category.changes[0].dailyCents;
  let changeIndex = 0;
  let purchaseIndex = 0;
  const purchasesByDay = purchases
    .filter(purchase => purchase.categoryId === category.id && purchase.day <= today)
    .sort((a, b) => a.day.localeCompare(b.day));
  const start = dayNumber(category.createdDay);
  const end = dayNumber(today);
  if (end < start) return balance;

  for (let day = start; day <= end; day++) {
    const date = new Date(day * 86400000).toISOString().slice(0, 10);
    if (day > start) balance += dailyCents;
    while (changeIndex + 1 < category.changes.length && category.changes[changeIndex + 1].day <= date) {
      dailyCents = category.changes[++changeIndex].dailyCents;
    }
    while (purchaseIndex < purchasesByDay.length && purchasesByDay[purchaseIndex].day === date) {
      balance -= purchasesByDay[purchaseIndex++].amountCents;
    }
  }

  return balance + transferDeltaFor(bucketRef('category', category.id), budget.transfers, today);
}

export function goalBalanceFor(goal, transfers, today = localDay()) {
  return (goal.startingCents || 0) + transferDeltaFor(bucketRef('goal', goal.id), transfers, today);
}

export function bucketBalanceFor(ref, budget, today = localDay()) {
  const [type, id] = String(ref).split(':');
  if (type === 'category') {
    const category = budget.categories.find(entry => entry.id === id);
    return category ? balanceFor(category, budget.purchases, budget, today) : null;
  }
  if (type === 'goal') {
    const goal = budget.goals.find(entry => entry.id === id);
    return goal ? goalBalanceFor(goal, budget.transfers, today) : null;
  }
  return null;
}

export function canTransferFrom(ref, amountCents, budget, today = localDay()) {
  const balance = bucketBalanceFor(ref, budget, today);
  return balance !== null && Number.isFinite(amountCents) && amountCents > 0 &&
    balance - amountCents >= -0.000001;
}

export function netSpentFor(category, purchases, today = localDay()) {
  return purchases.reduce((total, purchase) =>
    total + (purchase.categoryId === category.id && purchase.day <= today ? purchase.amountCents : 0), 0);
}

export function netTransfersFor(category, transfers, today = localDay()) {
  return transferDeltaFor(bucketRef('category', category.id), transfers, today);
}

export const dollars = amountCents =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amountCents / 100);
