import { STORAGE_KEY, emptyBudget, withSupercategories, allocatedFor, localDay, addDays, cents, balanceFor, netSpentFor, netTransfersFor, currentMonthly, dollars } from './budget.js?v=15';

const DEFAULT_ICON = '🐷';

let storageWarning = '';
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return emptyBudget();
    const saved = JSON.parse(raw);
    if (saved && Array.isArray(saved.categories) && Array.isArray(saved.purchases)) return withSupercategories(saved);
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

function validDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function validatedBackup(value) {
  const raw = value?.format === 'piggy-budget' && value.data ? value.data : value;
  if (!raw || !Array.isArray(raw.categories) || !Array.isArray(raw.purchases)) throw new Error('This is not a Piggy Budget backup.');
  const data = withSupercategories(raw);
  if (!Array.isArray(data.supercategories) || !Array.isArray(data.transfers)) throw new Error('Backup data is incomplete.');
  if (!Number.isSafeInteger(data.dayOffset) || data.dayOffset < 0) throw new Error('Backup has an invalid day offset.');

  const supercategoryIds = new Set();
  for (const group of data.supercategories) {
    if (!group || typeof group.id !== 'string' || !group.id || supercategoryIds.has(group.id) || typeof group.name !== 'string' || !group.name.trim() || !Number.isSafeInteger(group.monthlyCents) || group.monthlyCents < 0) throw new Error('Backup has an invalid supercategory.');
    supercategoryIds.add(group.id);
  }

  const categoryIds = new Set();
  for (const category of data.categories) {
    if (!category || typeof category.id !== 'string' || !category.id || categoryIds.has(category.id) || typeof category.name !== 'string' || !category.name.trim() || !validDay(category.createdDay) || !Number.isSafeInteger(category.startingCents) || category.startingCents < 0 || !Array.isArray(category.changes) || !category.changes.length || !supercategoryIds.has(category.supercategoryId)) throw new Error('Backup has an invalid category.');
    for (const change of category.changes) {
      if (!validDay(change.day) || !Number.isSafeInteger(change.monthlyCents) || change.monthlyCents <= 0) throw new Error('Backup has an invalid allocation history.');
    }
    categoryIds.add(category.id);
  }

  for (const purchase of data.purchases) {
    if (!purchase || typeof purchase.id !== 'string' || !purchase.id || !categoryIds.has(purchase.categoryId) || !validDay(purchase.day) || !Number.isSafeInteger(purchase.amountCents) || purchase.amountCents === 0) throw new Error('Backup has an invalid transaction.');
  }
  for (const transfer of data.transfers) {
    if (!transfer || typeof transfer.id !== 'string' || !transfer.id || !categoryIds.has(transfer.fromCategoryId) || !categoryIds.has(transfer.toCategoryId) || transfer.fromCategoryId === transfer.toCategoryId || !validDay(transfer.day) || !Number.isSafeInteger(transfer.amountCents) || transfer.amountCents <= 0) throw new Error('Backup has an invalid transfer.');
  }
  return data;
}

function downloadBackup() {
  const payload = {
    format: 'piggy-budget',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: budget
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `piggy-budget-backup-${localDay()}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
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

function allocationDifference(allocated, target) {
  const difference = allocated - target;
  return difference > 0 ? `${dollars(difference)} over` : difference < 0 ? `${dollars(-difference)} under` : 'On target';
}

function nonnegativeCents(value) {
  if (String(value).trim() === '' || Number(value) < 0) return null;
  return Number(value) === 0 ? 0 : cents(value);
}

function allocationPreview(node, supercategoryId, replacement) {
  const supercategory = budget.supercategories.find((entry) => entry.id === supercategoryId);
  node.textContent = supercategory ? `${supercategory.name}: ${allocationDifference(allocatedFor(budget.categories, supercategoryId, replacement), supercategory.monthlyCents)}` : '';
}

function supercategoryOptions(select, selected = '') {
  select.replaceChildren();
  for (const supercategory of budget.supercategories) {
    const option = element('option', '', supercategory.name);
    option.value = supercategory.id;
    select.append(option);
  }
  select.value = selected || budget.supercategories[0]?.id || '';
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
    const balance = balanceFor(category, budget.purchases, budgetDay(), budget.transfers);
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
    history.href = `./transactions.html?category=${encodeURIComponent(category.id)}&v=15`;
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
  if (!budget.supercategories.length) list.append(element('li', 'muted', 'Add a supercategory to start.'));
  for (const supercategory of budget.supercategories) {
    const group = element('li', 'panel supercategory-group');
    const summary = element('div', 'supercategory-summary');
    const header = element('div', 'setting-header');
    header.append(element('h3', '', supercategory.name), element('strong', '', `${dollars(supercategory.monthlyCents)} / month`));
    summary.append(header);
    const allocated = allocatedFor(budget.categories, supercategory.id);
    summary.append(element('p', 'allocation-summary', `${dollars(allocated)} allocated · ${allocationDifference(allocated, supercategory.monthlyCents)}`));
    const changeTarget = element('button', 'text-button', 'Change total allocation');
    changeTarget.type = 'button';
    const targetForm = element('form', 'edit-form');
    targetForm.hidden = true;
    targetForm.id = `total-${supercategory.id}`;
    changeTarget.setAttribute('aria-controls', targetForm.id);
    changeTarget.setAttribute('aria-expanded', 'false');
    changeTarget.addEventListener('click', () => {
      targetForm.hidden = !targetForm.hidden;
      changeTarget.setAttribute('aria-expanded', String(!targetForm.hidden));
    });
    const targetLabel = inputLabel('Total monthly allocation ($)', 'total', { type: 'number', min: '0', step: '0.01', required: true });
    targetLabel.querySelector('input').value = (supercategory.monthlyCents / 100).toFixed(2);
    const targetPreview = element('p', 'allocation-preview');
    targetPreview.setAttribute('role', 'status');
    const updateTargetPreview = () => {
      const target = nonnegativeCents(targetLabel.querySelector('input').value);
      targetPreview.textContent = target === null ? 'Enter a valid amount.' : `${allocationDifference(allocated, target)} after change`;
    };
    targetLabel.querySelector('input').addEventListener('input', updateTargetPreview);
    updateTargetPreview();
    const targetSubmit = element('button', 'secondary-button', 'Update total');
    targetSubmit.type = 'submit';
    const targetMessage = element('p', 'form-message');
    targetMessage.setAttribute('role', 'status');
    targetForm.append(targetLabel, targetSubmit, targetPreview, targetMessage);
    targetForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const monthlyCents = nonnegativeCents(targetLabel.querySelector('input').value);
      if (monthlyCents === null) { targetMessage.textContent = 'Enter a valid total with at most two decimal places.'; return; }
      const next = { ...budget, supercategories: budget.supercategories.map((entry) => entry.id === supercategory.id ? { ...entry, monthlyCents } : entry) };
      if (save(next, targetMessage)) renderSettings();
    });
    summary.append(changeTarget, targetForm);
    group.append(summary);
    const members = element('ul', 'settings-list group-members');
    group.append(members);
    list.append(group);
    const categories = budget.categories.filter((category) => category.supercategoryId === supercategory.id);
    if (!categories.length) members.append(element('li', 'muted', 'No categories in this group.'));
    for (const category of categories) {
    const item = element('li', 'setting-card');
    const header = element('div', 'setting-header');
    const heading = element('h3', 'category-heading');
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
        status.textContent = `${category.name} icon updated.`;
      }
    });
    heading.append(picker, document.createTextNode(category.name));
    const remove = element('button', 'delete-icon', '×');
    remove.type = 'button';
    remove.setAttribute('aria-label', `Delete ${category.name}`);
    remove.setAttribute('title', `Delete ${category.name}`);
    remove.addEventListener('click', () => {
      const transactionCount = budget.purchases.filter((purchase) => purchase.categoryId === category.id).length;
      const transferCount = budget.transfers.filter((transfer) => transfer.fromCategoryId === category.id || transfer.toCategoryId === category.id).length;
      const related = [
        `${transactionCount} transaction${transactionCount === 1 ? '' : 's'}`,
        `${transferCount} transfer${transferCount === 1 ? '' : 's'}`
      ].join(' and ');
      if (!window.confirm(`Delete ${category.name}, its ${related}? This cannot be undone.`)) return;
      const status = document.querySelector('#category-status');
      const next = {
        ...budget,
        categories: budget.categories.filter((entry) => entry.id !== category.id),
        purchases: budget.purchases.filter((purchase) => purchase.categoryId !== category.id),
        transfers: budget.transfers.filter((transfer) => transfer.fromCategoryId !== category.id && transfer.toCategoryId !== category.id)
      };
      if (save(next, status)) {
        renderSettings();
        status.textContent = `${category.name} and its transactions deleted.`;
      }
    });
    header.append(heading, remove);
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
    const groupLabel = element('label', '', 'Supercategory');
    const groupSelect = element('select');
    groupSelect.name = 'supercategoryId';
    supercategoryOptions(groupSelect, category.supercategoryId);
    groupLabel.append(groupSelect);
    const preview = element('p', 'allocation-preview');
    preview.setAttribute('role', 'status');
    const updatePreview = () => {
      const monthlyCents = cents(label.querySelector('input').value);
      if (monthlyCents === null) { preview.textContent = 'Enter a valid monthly allocation.'; return; }
      allocationPreview(preview, groupSelect.value, { ...category, supercategoryId: groupSelect.value, changes: [{ day: budgetDay(), monthlyCents }] });
    };
    label.querySelector('input').addEventListener('input', updatePreview);
    groupSelect.addEventListener('change', updatePreview);
    updatePreview();
    const submit = element('button', 'secondary-button', 'Update');
    submit.type = 'submit';
    const message = element('p', 'form-message');
    message.setAttribute('role', 'status');
    form.append(label, groupLabel, preview, submit, message);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const monthlyCents = cents(label.querySelector('input').value);
      if (monthlyCents === null) { message.textContent = 'Enter an amount above $0 with at most two decimal places.'; return; }
      if (monthlyCents === currentMonthly(category) && groupSelect.value === category.supercategoryId) { message.textContent = 'No changes to save.'; return; }
      const changes = [...category.changes];
      if (changes.at(-1).day === budgetDay()) changes[changes.length - 1] = { day: budgetDay(), monthlyCents };
      else changes.push({ day: budgetDay(), monthlyCents });
      const next = { ...budget, categories: budget.categories.map((entry) => entry.id === category.id ? { ...entry, changes, supercategoryId: groupSelect.value } : entry) };
      if (save(next, message)) renderSettings();
    });
    const actions = element('div', 'setting-actions');
    actions.append(changeButton);
    item.append(actions, form);
    members.append(item);
    }
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
    summary.replaceChildren(element('p', 'muted', 'Choose a category from the home page.'));
    document.title = 'Transactions · Piggy Budget';
    return;
  }
  heading.textContent = `${category.icon || DEFAULT_ICON} ${category.name}`;
  document.title = `${category.name} transactions · Piggy Budget`;
  const remaining = balanceFor(category, budget.purchases, budgetDay(), budget.transfers);
  const spent = netSpentFor(category, budget.purchases, budgetDay());
  summary.replaceChildren();
  for (const [term, value] of [
    ['Budgeting since', formatDay(category.createdDay)],
    ['Total accumulated', dollars(remaining + spent)],
    ['Total spent', dollars(spent)],
    ['Remaining', dollars(remaining)]
  ]) {
    const row = element('div');
    row.append(element('dt', '', term), element('dd', '', value));
    summary.append(row);
  }
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
const supercategoryForm = document.querySelector('#supercategory-form');
if (supercategoryForm) {
  const panel = document.querySelector('#add-supercategory-panel');
  const button = document.querySelector('#add-supercategory');
  button.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    button.setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden) supercategoryForm.elements.namedItem('name').focus();
  });
  supercategoryForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(supercategoryForm);
    const name = String(data.get('name')).trim();
    const monthlyCents = nonnegativeCents(data.get('total'));
    const message = document.querySelector('#supercategory-message');
    if (!name || monthlyCents === null) { message.textContent = 'Enter a name and a nonnegative total with at most two decimal places.'; return; }
    if (budget.supercategories.some((entry) => entry.name.toLowerCase() === name.toLowerCase())) { message.textContent = 'That supercategory already exists.'; return; }
    const next = { ...budget, supercategories: [...budget.supercategories, { id: crypto.randomUUID(), name, monthlyCents }] };
    if (save(next, message)) {
      supercategoryForm.reset();
      panel.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      renderSettings();
      if (categoryForm && !addCategoryPanel.hidden) {
        supercategoryOptions(categoryForm.elements.namedItem('supercategoryId'), next.supercategories.at(-1).id);
        updateNewCategoryPreview();
      }
      document.querySelector('#supercategory-status').textContent = `${name} added.`;
      button.focus();
    }
  });
}
function setCategoryFormOpen(open) {
  if (!addCategoryButton || !addCategoryPanel) return;
  addCategoryPanel.hidden = !open;
  addCategoryButton.setAttribute('aria-expanded', String(open));
  if (open) {
    document.querySelector('#category-status').textContent = '';
    document.querySelector('#category-message').textContent = '';
    supercategoryOptions(categoryForm.elements.namedItem('supercategoryId'));
    updateNewCategoryPreview();
    categoryForm.elements.namedItem('name').focus();
  }
}
function updateNewCategoryPreview() {
  if (!categoryForm) return;
  const preview = document.querySelector('#new-category-preview');
  const groupId = categoryForm.elements.namedItem('supercategoryId').value;
  const monthlyCents = cents(categoryForm.elements.namedItem('monthly').value);
  if (monthlyCents === null) { preview.textContent = 'Enter a monthly allocation to see the group total.'; return; }
  allocationPreview(preview, groupId, { id: 'preview-category', supercategoryId: groupId, changes: [{ day: budgetDay(), monthlyCents }] });
}
if (categoryForm) {
  addCategoryButton.addEventListener('click', () => setCategoryFormOpen(addCategoryPanel.hidden));
  categoryForm.elements.namedItem('monthly').addEventListener('input', updateNewCategoryPreview);
  categoryForm.elements.namedItem('supercategoryId').addEventListener('change', updateNewCategoryPreview);
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
    const supercategoryId = String(data.get('supercategoryId'));
    const startingMonths = Number(data.get('startingMonths'));
    const message = document.querySelector('#category-message');
    if (!name || !icon || monthlyCents === null || !budget.supercategories.some((entry) => entry.id === supercategoryId) || ![0, 1, 2, 3].includes(startingMonths)) {
      message.textContent = 'Enter a name, one emoji, an amount above $0 (up to two decimal places), and starting funds.';
      return;
    }
    if (budget.categories.some((entry) => entry.name.toLowerCase() === name.toLowerCase())) {
      message.textContent = 'A category with that name already exists.';
      return;
    }
    const category = {
      id: crypto.randomUUID(), name, icon, supercategoryId, createdDay: budgetDay(),
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
