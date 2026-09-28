export const STORAGE_KEY = 'piggy-budget-v1';
export const emptyBudget = () => ({ categories: [], supercategories: [], purchases: [], dayOffset: 0 });

export function withSupercategories(saved) {
  if (Array.isArray(saved.supercategories)) return saved;
  if (!saved.categories.length) return { ...saved, supercategories: [] };
  const id = 'general';
  return {
    ...saved,
    supercategories: [{ id, name: 'General', monthlyCents: saved.categories.reduce((sum, category) => sum + currentMonthly(category), 0) }],
    categories: saved.categories.map((category) => ({ ...category, supercategoryId: id }))
  };
}

export function allocatedFor(categories, supercategoryId, replacement = null) {
  return categories.reduce((sum, category) => {
    const entry = replacement?.id === category.id ? replacement : category;
    return sum + (entry.supercategoryId === supercategoryId ? currentMonthly(entry) : 0);
  }, 0) + (replacement && !categories.some((category) => category.id === replacement.id) && replacement.supercategoryId === supercategoryId ? currentMonthly(replacement) : 0);
}

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

export function currentMonthly(category) {
  return category.changes[category.changes.length - 1].monthlyCents;
}

export function balanceFor(category, purchases, today = localDay()) {
  let balance = category.startingCents;
  let changeIndex = 0;
  let purchaseIndex = 0;
  let monthly = category.changes[0].monthlyCents;
  const purchasesByDay = purchases.filter((purchase) => purchase.categoryId === category.id && purchase.day <= today)
    .sort((a, b) => a.day.localeCompare(b.day));
  const start = dayNumber(category.createdDay);
  const end = dayNumber(today);
  if (end < start) return balance;

  for (let day = start; day <= end; day++) {
    // Yesterday's allocation funds today; a change today affects tomorrow's addition.
    if (day > start) balance += monthly / 30;
    while (changeIndex + 1 < category.changes.length && dayNumber(category.changes[changeIndex + 1].day) <= day) {
      monthly = category.changes[++changeIndex].monthlyCents;
    }
    const date = new Date(day * 86400000).toISOString().slice(0, 10);
    while (purchaseIndex < purchasesByDay.length && purchasesByDay[purchaseIndex].day === date) {
      balance -= purchasesByDay[purchaseIndex++].amountCents;
    }
  }
  return balance;
}

export function netSpentFor(category, purchases, today = localDay()) {
  return purchases.reduce((total, purchase) =>
    total + (purchase.categoryId === category.id && purchase.day <= today ? purchase.amountCents : 0), 0);
}

export const dollars = (amountCents) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amountCents / 100);
