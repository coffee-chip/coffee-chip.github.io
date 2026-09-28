import { STORAGE_KEY, emptyBudget, localDay, cents, balanceFor, currentMonthly, dollars } from './budget.js';

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.categories) && Array.isArray(saved.purchases)) return saved;
  } catch (error) {
    console.warn('Could not load saved budget:', error);
  }
  return emptyBudget();
}

let budget = load();
const dateElement = document.querySelector('#current-date');
function updateDate() {
  if (!dateElement) return;
  const now = new Date();
  dateElement.dateTime = localDay(now);
  dateElement.textContent = new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(now);
}
updateDate();

function save(next, messageElement) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    budget = next;
    return true;
  } catch (error) {
    messageElement.textContent = 'Could not save. Check that this browser allows site storage.';
    console.error('Could not save budget:', error);
    return false;
  }
}

function element(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content != null) node.textContent = content;
  return node;
}

function renderHome() {
  const grid = document.querySelector('#category-list');
  if (!grid) return;
  grid.replaceChildren();
  const selector = document.querySelector('#purchase-category');
  const previous = selector.value;
  selector.replaceChildren();
  const categories = budget.categories;
  if (!categories.length) {
    const empty = element('div', 'panel empty-state');
    empty.append(element('p', '', 'No buckets yet. Add your first category to start setting money aside.'));
    const link = element('a', 'button-link', 'Create a category');
    link.href = './settings.html';
    empty.append(link);
    grid.append(empty);
  }
  for (const category of categories) {
    const balance = balanceFor(category, budget.purchases, localDay());
    const card = element('article', 'bucket-card');
    card.append(element('h3', '', category.name));
    card.append(element('p', `balance${balance < 0 ? ' negative' : ''}`, dollars(balance)));
    card.append(element('p', 'bucket-detail', `${dollars(currentMonthly(category))}/month · cap ${dollars(currentMonthly(category) * 3)}`));
    grid.append(card);
    const option = element('option', '', category.name);
    option.value = category.id;
    selector.append(option);
  }
  if (previous && categories.some((category) => category.id === previous)) selector.value = previous;
  document.querySelector('#purchase-form button').disabled = !categories.length;

  const list = document.querySelector('#purchase-list');
  list.replaceChildren();
  const recent = [...budget.purchases].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20);
  if (!recent.length) {
    list.append(element('p', 'muted', 'No purchases recorded yet.'));
  }
  for (const purchase of recent) {
    const row = element('div', 'purchase-row');
    const details = element('div');
    const category = categories.find((item) => item.id === purchase.categoryId);
    details.append(element('strong', '', purchase.note || category?.name || 'Purchase'));
    details.append(element('small', '', `${category?.name || 'Category'} · ${purchase.day}`));
    row.append(details, element('span', 'purchase-amount', `−${dollars(purchase.amountCents)}`));
    const remove = element('button', 'text-button', 'Remove');
    remove.type = 'button';
    remove.setAttribute('aria-label', `Remove purchase of ${dollars(purchase.amountCents)} from ${category?.name || 'category'}`);
    remove.addEventListener('click', () => {
      const next = { ...budget, purchases: budget.purchases.filter((item) => item.id !== purchase.id) };
      if (save(next, document.querySelector('#purchase-message'))) renderHome();
    });
    row.append(remove);
    list.append(row);
  }
}

function renderSettings() {
  const list = document.querySelector('#settings-categories');
  if (!list) return;
  list.replaceChildren();
  if (!budget.categories.length) list.append(element('p', 'muted', 'No categories yet.'));
  for (const category of budget.categories) {
    const card = element('div', 'panel setting-card');
    const heading = element('h3', '', category.name);
    const balance = element('p', 'muted', `Available now: ${dollars(balanceFor(category, budget.purchases, localDay()))}`);
    const form = element('form', 'edit-form');
    const label = element('label', '', 'Monthly allocation ($)');
    const input = element('input');
    input.type = 'number'; input.min = '0.01'; input.step = '0.01'; input.required = true;
    input.value = (currentMonthly(category) / 100).toFixed(2);
    label.append(input);
    const button = element('button', 'secondary-button', 'Update');
    button.type = 'submit';
    const message = element('p', 'form-message');
    message.setAttribute('role', 'status');
    form.append(label, button, message);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const monthlyCents = cents(input.value);
      if (monthlyCents === null) { message.textContent = 'Enter an amount above $0, with at most two decimal places.'; return; }
      if (monthlyCents === currentMonthly(category)) { message.textContent = 'Allocation is already set to that amount.'; return; }
      const changes = [...category.changes];
      if (changes.at(-1).day === localDay()) changes[changes.length - 1] = { day: localDay(), monthlyCents };
      else changes.push({ day: localDay(), monthlyCents });
      const next = { ...budget, categories: budget.categories.map((item) => item.id === category.id ? { ...item, changes } : item) };
      if (save(next, message)) { renderSettings(); }
    });
    card.append(heading, balance, form);
    list.append(card);
  }
}

const categoryForm = document.querySelector('#category-form');
if (categoryForm) {
  categoryForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(categoryForm);
    const name = String(data.get('name')).trim();
    const monthlyCents = cents(data.get('monthly'));
    const startingMonths = Number(data.get('startingMonths'));
    const message = document.querySelector('#category-message');
    if (!name || monthlyCents === null || ![0, 1, 2, 3].includes(startingMonths)) {
      message.textContent = 'Enter a name, an amount above $0 (up to two decimal places), and starting funds.';
      return;
    }
    if (budget.categories.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
      message.textContent = 'A category with that name already exists.';
      return;
    }
    const category = {
      id: crypto.randomUUID(), name, createdDay: localDay(),
      startingCents: startingMonths * monthlyCents,
      changes: [{ day: localDay(), monthlyCents }]
    };
    if (save({ ...budget, categories: [...budget.categories, category] }, message)) {
      categoryForm.reset();
      message.textContent = `${name} added.`;
      renderSettings();
    }
  });
  renderSettings();
}

const purchaseForm = document.querySelector('#purchase-form');
if (purchaseForm) {
  purchaseForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(purchaseForm);
    const categoryId = String(data.get('categoryId'));
    const amountCents = cents(data.get('amount'));
    const message = document.querySelector('#purchase-message');
    if (!budget.categories.some((item) => item.id === categoryId) || amountCents === null) {
      message.textContent = 'Select a category and enter an amount above $0 (up to two decimal places).';
      return;
    }
    const purchase = {
      id: crypto.randomUUID(), categoryId, amountCents,
      note: String(data.get('note')).trim(), day: localDay(), createdAt: new Date().toISOString()
    };
    if (save({ ...budget, purchases: [...budget.purchases, purchase] }, message)) {
      purchaseForm.reset();
      renderHome();
      document.querySelector('#purchase-category').value = categoryId;
      message.textContent = 'Purchase saved.';
    }
  });
  renderHome();
}

window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY) { budget = load(); renderHome(); renderSettings(); }
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) { updateDate(); renderHome(); renderSettings(); }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch((error) => console.warn('Offline mode is unavailable:', error));
  });
}
