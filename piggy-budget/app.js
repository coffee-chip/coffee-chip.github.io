import { STORAGE_KEY, emptyBudget, localDay, addDays, cents, balanceFor, currentMonthly, dollars } from './budget.js?v=11';

const DEFAULT_ICON = '🐷';

let storageWarning = '';
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return emptyBudget();
    const saved = JSON.parse(raw);
    if (saved && Array.isArray(saved.categories) && Array.isArray(saved.purchases)) return saved;
    storageWarning = 'Saved budget data could not be read. Your existing data has not been changed.';
  } catch (error) {
    storageWarning = 'Saved budget data could not be read. Your existing data has not been changed.';
    console.warn('Could not load saved budget:', error);
  }
  return emptyBudget();
}

let budget = load();
function budgetDay() {
  return addDays(localDay(), Number.isSafeInteger(budget.dayOffset) && budget.dayOffset >= 0 ? budget.dayOffset : 0);
}

function showStorageWarning() {
  const main = document.querySelector('main');
  if (!main || !storageWarning || document.querySelector('#storage-warning')) return;
  const warning = element('p', 'storage-warning', storageWarning);
  warning.id = 'storage-warning';
  warning.setAttribute('role', 'alert');
  main.prepend(warning);
}

function updateDate() {
  const date = document.querySelector('#current-date');
  if (!date) return;
  const day = budgetDay();
  date.dateTime = day;
  date.textContent = formatDay(day, 'full');
  document.querySelector('#advance-indicator').textContent = budget.dayOffset ? ` · ${budget.dayOffset} day${budget.dayOffset === 1 ? '' : 's'} advanced` : '';
}

function formatDay(day, dateStyle = 'medium') {
  return new Intl.DateTimeFormat(undefined, { dateStyle }).format(new Date(`${day}T12:00:00`));
}

function save(next, message) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    budget = next;
    storageWarning = '';
    document.querySelector('#storage-warning')?.remove();
    return true;
  } catch (error) {
    message.textContent = 'Could not save. Check that this browser allows site storage.';
    console.error('Could not save budget:', error);
    return false;
  }
}

function element(tag, className = '', content = null) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content != null) node.textContent = content;
  return node;
}

function inputLabel(text, name, attributes = {}) {
  const label = element('label', '', text);
  const input = element('input');
  input.name = name;
  for (const [key, value] of Object.entries(attributes)) input[key] = value;
  label.append(input);
  return label;
}

function singleEmoji(value) {
  const icon = String(value).trim();
  const graphemes = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(icon)];
  return graphemes.length === 1 && /[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Presentation}\uFE0F\u20E3]/u.test(icon) ? icon : null;
}

function renderHome() {
  const list = document.querySelector('#category-list');
  if (!list) return;
  list.replaceChildren();
  if (!budget.categories.length) {
    const empty = element('div', 'panel empty-state');
    empty.append(element('p', '', 'No categories yet.'));
    list.append(empty);
    return;
  }
  for (const category of budget.categories) {
    const balance = balanceFor(category, budget.purchases, budgetDay());
    const card = element('article', 'bucket-card');
    card.dataset.categoryId = category.id;
    const top = element('div', 'bucket-top');
    const heading = element('h3', 'category-heading');
    const icon = element('span', 'category-emoji', category.icon || DEFAULT_ICON);
    icon.setAttribute('aria-hidden', 'true');
    heading.append(icon, document.createTextNode(category.name));
    top.append(heading, element('p', `balance${balance < 0 ? ' negative' : ''}`, dollars(balance)));
    card.append(top);

    const actions = element('div', 'bucket-actions');
    const shake = element('button', 'secondary-button', 'Shake this piggy');
    shake.type = 'button';
    shake.setAttribute('aria-expanded', 'false');
    const form = element('form', 'spend-form');
    form.hidden = true;
    const formId = `record-${category.id}`;
    form.id = formId;
    shake.setAttribute('aria-controls', formId);
    shake.addEventListener('click', () => {
      form.hidden = !form.hidden;
      shake.setAttribute('aria-expanded', String(!form.hidden));
      if (!form.hidden) form.elements.namedItem('amount').focus();
    });
    const history = element('a', 'history-link', 'View transactions');
    history.href = `./transactions.html?category=${encodeURIComponent(category.id)}&v=11`;
    actions.append(shake, history);
    card.append(actions);

    form.append(inputLabel('Amount ($)', 'amount', { type: 'number', min: '0.01', step: '0.01', inputMode: 'decimal', placeholder: '0.00', required: true }));
    form.append(inputLabel('Description (optional)', 'note', { maxLength: 100, placeholder: 'What was it for?' }));
    const refundLabel = element('label', 'checkbox-label');
    const refund = element('input');
    refund.type = 'checkbox'; refund.name = 'refund';
    refundLabel.append(refund, document.createTextNode('Refund (add this amount back)'));
    form.append(refundLabel);
    const submit = element('button', '', 'Record transaction');
    submit.type = 'submit';
    const message = element('p', 'form-message');
    message.setAttribute('role', 'status');
    form.append(submit, message);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const amountCents = cents(data.get('amount'));
      if (amountCents === null) {
        message.textContent = 'Enter an amount above $0 with at most two decimal places.';
        return;
      }
      const transaction = {
        id: crypto.randomUUID(), categoryId: category.id,
        amountCents: refund.checked ? -amountCents : amountCents,
        note: String(data.get('note')).trim(), day: budgetDay(), createdAt: new Date().toISOString()
      };
      if (save({ ...budget, purchases: [...budget.purchases, transaction] }, message)) {
        renderHome();
        const updatedCard = [...list.children].find((item) => item.dataset.categoryId === category.id);
        const updatedForm = updatedCard?.querySelector('form');
        if (updatedForm) {
          updatedForm.hidden = false;
          updatedCard.querySelector('.bucket-actions button').setAttribute('aria-expanded', 'true');
          updatedForm.querySelector('.form-message').textContent = refund.checked ? 'Refund recorded.' : 'Purchase recorded.';
        }
      }
    });
    card.append(form);
    list.append(card);
  }
}

function renderSettings() {
  const list = document.querySelector('#settings-categories');
  if (!list) return;
  list.replaceChildren();
  if (!budget.categories.length) list.append(element('li', 'muted', 'No categories yet.'));
  for (const category of budget.categories) {
    const item = element('li', 'panel setting-card');
    const header = element('div', 'setting-header');
    const heading = element('h3', 'category-heading');
    const icon = element('span', 'category-emoji', category.icon || DEFAULT_ICON);
    icon.setAttribute('aria-hidden', 'true');
    heading.append(icon, document.createTextNode(category.name));
    const picker = element('input', 'icon-picker');
    picker.type = 'text';
    picker.maxLength = 64;
    picker.value = category.icon || DEFAULT_ICON;
    picker.setAttribute('aria-label', `Emoji icon for ${category.name}`);
    picker.setAttribute('title', 'Type or paste one emoji');
    picker.addEventListener('input', () => {
      const status = document.querySelector('#category-status');
      const selectedIcon = singleEmoji(picker.value);
      if (!selectedIcon) {
        status.textContent = 'Enter one emoji for the icon.';
        return;
      }
      const next = { ...budget, categories: budget.categories.map((entry) => entry.id === category.id ? { ...entry, icon: selectedIcon } : entry) };
      if (save(next, status)) {
        picker.value = selectedIcon;
        icon.textContent = selectedIcon;
        status.textContent = `${category.name} icon updated.`;
      }
    });
    header.append(heading, picker);
    item.append(header);
    const facts = element('dl', 'category-facts');
    for (const [term, value] of [
      ['Monthly allocation', dollars(currentMonthly(category))],
      ['Accrual per day', dollars(currentMonthly(category) / 30)],
      ['Budgeting since', formatDay(category.createdDay)]
    ]) {
      const fact = element('div');
      fact.append(element('dt', '', term), element('dd', '', value));
      facts.append(fact);
    }
    item.append(facts);
    const changeButton = element('button', 'text-button', 'Change allocation');
    changeButton.type = 'button';
    changeButton.setAttribute('aria-expanded', 'false');
    const form = element('form', 'edit-form');
    form.hidden = true;
    const formId = `allocation-${category.id}`;
    form.id = formId;
    changeButton.setAttribute('aria-controls', formId);
    changeButton.addEventListener('click', () => {
      form.hidden = !form.hidden;
      changeButton.setAttribute('aria-expanded', String(!form.hidden));
    });
    const label = inputLabel('New monthly allocation ($)', 'monthly', { type: 'number', min: '0.01', step: '0.01', required: true });
    label.querySelector('input').value = (currentMonthly(category) / 100).toFixed(2);
    const submit = element('button', 'secondary-button', 'Update');
    submit.type = 'submit';
    const message = element('p', 'form-message');
    message.setAttribute('role', 'status');
    form.append(label, submit, message);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const monthlyCents = cents(label.querySelector('input').value);
      if (monthlyCents === null) { message.textContent = 'Enter an amount above $0 with at most two decimal places.'; return; }
      if (monthlyCents === currentMonthly(category)) { message.textContent = 'Allocation is already set to that amount.'; return; }
      const changes = [...category.changes];
      if (changes.at(-1).day === budgetDay()) changes[changes.length - 1] = { day: budgetDay(), monthlyCents };
      else changes.push({ day: budgetDay(), monthlyCents });
      const next = { ...budget, categories: budget.categories.map((entry) => entry.id === category.id ? { ...entry, changes } : entry) };
      if (save(next, message)) renderSettings();
    });
    item.append(changeButton, form);
    list.append(item);
  }
}

function renderTransactions() {
  const list = document.querySelector('#transaction-list');
  if (!list) return;
  list.replaceChildren();
  const id = new URLSearchParams(location.search).get('category');
  const category = budget.categories.find((entry) => entry.id === id);
  const heading = document.querySelector('#transaction-heading');
  const summary = document.querySelector('#transaction-summary');
  if (!category) {
    heading.textContent = 'Category not found';
    summary.textContent = 'Choose a category from the home page.';
    document.title = 'Transactions · Piggy Budget';
    return;
  }
  heading.textContent = `${category.icon || DEFAULT_ICON} ${category.name}`;
  document.title = `${category.name} transactions · Piggy Budget`;
  summary.textContent = `${dollars(balanceFor(category, budget.purchases, budgetDay()))} accumulated · ${dollars(currentMonthly(category) / 30)} per day`;
  const transactions = budget.purchases.filter((entry) => entry.categoryId === id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (!transactions.length) list.append(element('p', 'muted', 'No transactions in this category yet.'));
  for (const transaction of transactions) {
    const row = element('div', 'purchase-row');
    const details = element('div');
    const refund = transaction.amountCents < 0;
    details.append(element('strong', '', transaction.note || (refund ? 'Refund' : 'Purchase')));
    details.append(element('small', '', `${formatDay(transaction.day)} · ${refund ? 'Refund' : 'Purchase'}`));
    row.append(details, element('span', `purchase-amount${refund ? ' refund-amount' : ''}`, `${refund ? '+' : '−'}${dollars(Math.abs(transaction.amountCents))}`));
    const remove = element('button', 'text-button', 'Remove');
    remove.type = 'button';
    remove.setAttribute('aria-label', `Remove ${refund ? 'refund' : 'purchase'} of ${dollars(Math.abs(transaction.amountCents))}`);
    remove.addEventListener('click', () => {
      if (save({ ...budget, purchases: budget.purchases.filter((entry) => entry.id !== transaction.id) }, document.querySelector('#transaction-message'))) renderTransactions();
    });
    row.append(remove);
    list.append(row);
  }
}

const categoryForm = document.querySelector('#category-form');
const addCategoryButton = document.querySelector('#add-category');
const addCategoryPanel = document.querySelector('#add-category-panel');
function setCategoryFormOpen(open) {
  if (!addCategoryButton || !addCategoryPanel) return;
  addCategoryPanel.hidden = !open;
  addCategoryButton.setAttribute('aria-expanded', String(open));
  if (open) {
    document.querySelector('#category-status').textContent = '';
    document.querySelector('#category-message').textContent = '';
    categoryForm.elements.namedItem('name').focus();
  }
}
if (categoryForm) {
  addCategoryButton.addEventListener('click', () => setCategoryFormOpen(addCategoryPanel.hidden));
  if (location.hash === '#add-category') setCategoryFormOpen(true);
  window.addEventListener('hashchange', () => {
    if (location.hash === '#add-category') setCategoryFormOpen(true);
  });
  categoryForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(categoryForm);
    const name = String(data.get('name')).trim();
    const icon = singleEmoji(data.get('icon'));
    const monthlyCents = cents(data.get('monthly'));
    const startingMonths = Number(data.get('startingMonths'));
    const message = document.querySelector('#category-message');
    if (!name || !icon || monthlyCents === null || ![0, 1, 2, 3].includes(startingMonths)) {
      message.textContent = 'Enter a name, one emoji, an amount above $0 (up to two decimal places), and starting funds.';
      return;
    }
    if (budget.categories.some((entry) => entry.name.toLowerCase() === name.toLowerCase())) {
      message.textContent = 'A category with that name already exists.';
      return;
    }
    const category = {
      id: crypto.randomUUID(), name, icon, createdDay: budgetDay(),
      startingCents: startingMonths * monthlyCents,
      changes: [{ day: budgetDay(), monthlyCents }]
    };
    if (save({ ...budget, categories: [...budget.categories, category] }, message)) {
      categoryForm.reset();
      renderSettings();
      setCategoryFormOpen(false);
      document.querySelector('#category-status').textContent = `${name} added.`;
      addCategoryButton.focus();
    }
  });
}

const advanceButton = document.querySelector('#advance-day');
function renderSimulation() {
  const status = document.querySelector('#simulation-status');
  if (!status) return;
  const advanced = budget.dayOffset || 0;
  status.textContent = `Budget date: ${budgetDay()} · ${advanced} day${advanced === 1 ? '' : 's'} advanced`;
}
if (advanceButton) {
  advanceButton.addEventListener('click', () => {
    const message = document.querySelector('#advance-message');
    if (save({ ...budget, dayOffset: (budget.dayOffset || 0) + 1 }, message)) {
      renderSettings();
      renderSimulation();
      message.textContent = 'All buckets advanced by one day.';
    }
  });
}

function renderAll() {
  updateDate();
  renderHome();
  renderSettings();
  renderTransactions();
  renderSimulation();
  showStorageWarning();
}
renderAll();
window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY) { budget = load(); renderAll(); }
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) renderAll();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch((error) => console.warn('Offline mode is unavailable:', error));
  });
}
