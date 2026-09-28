import {
  STORAGE_KEY, INTERVALS, emptyBudget, allocatedForGroup, localDay, addDays, cents,
  balanceFor, netSpentFor, netTransfersFor, currentDaily, currentAllocation,
  groupAllocation, dailyCentsFromInterval, dollars
} from './budget.js?v=23';

const DEFAULT_ICON = '🐷';
const EDIT_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l11-11-4-4L4 16v4Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="m13.8 6.2 4 4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';

let storageWarning = '';

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return emptyBudget();
    const saved = JSON.parse(raw);
    if (
      saved &&
      Array.isArray(saved.groups) &&
      Array.isArray(saved.categories) &&
      Array.isArray(saved.purchases) &&
      Array.isArray(saved.transfers) &&
      INTERVALS[saved.interval]
    ) return saved;
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

function formatDay(day, dateStyle = 'medium') {
  return new Intl.DateTimeFormat(undefined, { dateStyle }).format(new Date(`${day}T12:00:00`));
}

function save(next, message = { textContent: '' }) {
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

function showStorageWarning() {
  const main = document.querySelector('main');
  if (!main || !storageWarning || document.querySelector('#storage-warning')) return;
  const warning = element('p', 'storage-warning', storageWarning);
  warning.id = 'storage-warning';
  warning.role = 'alert';
  main.prepend(warning);
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

function validDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function singleEmoji(value) {
  const icon = String(value).trim();
  const graphemes = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(icon)];
  return graphemes.length === 1 &&
    /[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Presentation}\uFE0F\u20E3]/u.test(icon)
    ? icon
    : null;
}

function nonnegativeCents(value) {
  if (String(value).trim() === '' || Number(value) < 0) return null;
  return Number(value) === 0 ? 0 : cents(value);
}

function intervalLabel() {
  return INTERVALS[budget.interval].label;
}

function allocationDifference(allocated, target) {
  const difference = Math.round(allocated - target);
  return difference > 0
    ? `${dollars(difference)} over`
    : difference < 0
      ? `${dollars(-difference)} under`
      : 'On target';
}

function allocationPreview(node, groupId, replacement) {
  const group = budget.groups.find(entry => entry.id === groupId);
  if (!group) {
    node.textContent = '';
    return;
  }
  const allocated = allocatedForGroup(budget.categories, groupId, budget.interval, replacement);
  const target = groupAllocation(group, budget.interval);
  node.textContent = `${group.name}: ${allocationDifference(allocated, target)}`;
}

function groupOptions(select, selected = '') {
  select.replaceChildren();
  for (const group of budget.groups) {
    const option = element('option', '', group.name);
    option.value = group.id;
    select.append(option);
  }
  select.value = selected || budget.groups[0]?.id || '';
}

function categoryOptions(select, selected = '') {
  select.replaceChildren();
  for (const category of budget.categories) {
    const option = element('option', '', `${category.icon || DEFAULT_ICON} ${category.name}`);
    option.value = category.id;
    select.append(option);
  }
  if (selected && budget.categories.some(category => category.id === selected)) select.value = selected;
}

function startingOptions(select) {
  const configs = {
    '2-weeks': [[1, '2 weeks'], [2, '4 weeks'], [4, '8 weeks'], [6, '12 weeks']],
    '4-weeks': [[1, '4 weeks'], [2, '8 weeks'], [3, '12 weeks']],
    '30-days': [[1, '30 days'], [2, '60 days'], [3, '90 days']],
    '1-month': [[1, '1 month'], [2, '2 months'], [3, '3 months']]
  };
  select.replaceChildren();
  const empty = element('option', '', 'Empty ($0)');
  empty.value = '0';
  select.append(empty);
  for (const [multiplier, label] of configs[budget.interval]) {
    const option = element('option', '', label);
    option.value = String(multiplier);
    select.append(option);
  }
}

function iconButton(type, label) {
  const button = element('button', type === 'edit' ? 'icon-action edit-icon' : 'delete-icon');
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.title = label;
  if (type === 'edit') button.innerHTML = EDIT_ICON;
  else button.textContent = '×';
  return button;
}

function validatedBackup(value) {
  if (value?.format !== 'piggy-budget' || value?.version !== 3 || !value.data) {
    throw new Error('This is not a current Piggy Budget backup.');
  }
  const data = value.data;
  if (
    !Array.isArray(data.groups) ||
    !Array.isArray(data.categories) ||
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
      group.dailyCents < 0
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
      !categoryIds.has(transfer.fromCategoryId) ||
      !categoryIds.has(transfer.toCategoryId) ||
      transfer.fromCategoryId === transfer.toCategoryId ||
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
    version: 3,
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

function renderHome() {
  const list = document.querySelector('#category-list');
  if (!list) return;
  list.replaceChildren();

  if (!budget.categories.length) return;

  for (const category of budget.categories) {
    const categoryBalance = balanceFor(category, budget.purchases, budget, budgetDay());
    const card = element('article', 'category-card');
    card.dataset.categoryId = category.id;

    const top = element('div', 'category-top');
    const heading = element('h3', 'category-heading');
    const icon = element('span', 'category-emoji', category.icon || DEFAULT_ICON);
    icon.ariaHidden = 'true';
    heading.append(icon, document.createTextNode(category.name));
    top.append(heading, element('p', `balance${categoryBalance < 0 ? ' negative' : ''}`, dollars(categoryBalance)));
    card.append(top);

    const actions = element('div', 'category-actions');
    const shake = element('button', '', 'Shake this piggy');
    shake.type = 'button';
    shake.ariaExpanded = 'false';
    const history = element('a', 'history-link', 'View history');
    history.href = `./transactions.html?category=${encodeURIComponent(category.id)}&v=23`;
    actions.append(shake, history);
    card.append(actions);

    const form = element('form', 'spend-form');
    form.hidden = true;
    form.id = `record-${category.id}`;
    shake.setAttribute('aria-controls', form.id);
    shake.addEventListener('click', () => {
      form.hidden = !form.hidden;
      shake.ariaExpanded = String(!form.hidden);
      if (!form.hidden) form.elements.namedItem('amount').focus();
    });

    form.append(inputLabel('Amount ($)', 'amount', {
      type: 'number', min: '0.01', step: '0.01', inputMode: 'decimal', placeholder: '0.00', required: true
    }));
    form.append(inputLabel('Description (optional)', 'note', {
      maxLength: 100, placeholder: 'What was it for?'
    }));

    const refundLabel = element('label', 'checkbox-label');
    const refund = element('input');
    refund.type = 'checkbox';
    refund.name = 'refund';
    refundLabel.append(refund, document.createTextNode('Refund (add this amount back)'));
    form.append(refundLabel);

    const submit = element('button', '', 'Record transaction');
    submit.type = 'submit';
    const message = element('p', 'form-message');
    message.role = 'status';
    form.append(submit, message);

    form.addEventListener('submit', event => {
      event.preventDefault();
      const data = new FormData(form);
      const amountCents = cents(data.get('amount'));
      if (amountCents === null) {
        message.textContent = 'Enter an amount above $0 with at most two decimal places.';
        return;
      }
      const transaction = {
        id: crypto.randomUUID(),
        categoryId: category.id,
        amountCents: refund.checked ? -amountCents : amountCents,
        note: String(data.get('note')).trim(),
        day: budgetDay(),
        createdAt: new Date().toISOString()
      };
      if (save({ ...budget, purchases: [...budget.purchases, transaction] }, message)) renderAll();
    });

    card.append(form);
    list.append(card);
  }
}

function renderIntervalSetting() {
  const select = document.querySelector('#budget-interval');
  if (!select) return;
  select.value = budget.interval;
  document.querySelector('#interval-description').textContent =
    'Changing the interval recalculates displayed allocation amounts while keeping each category’s daily accrual unchanged.';
}

function renderSettings() {
  const list = document.querySelector('#settings-categories');
  if (!list) return;
  list.replaceChildren();

  for (const budgetGroup of budget.groups) {
    const groupCard = element('li', 'panel group-card');
    const summary = element('div', 'group-summary');
    const header = element('div', 'setting-header');
    const target = groupAllocation(budgetGroup, budget.interval);
    header.append(
      element('h3', '', budgetGroup.name),
      element('strong', '', `${dollars(target)} / ${intervalLabel()}`)
    );
    summary.append(header);

    const allocated = allocatedForGroup(budget.categories, budgetGroup.id, budget.interval);
    summary.append(element(
      'p',
      'allocation-summary',
      `${dollars(allocated)} allocated · ${allocationDifference(allocated, target)}`
    ));

    const changeTarget = element('button', 'text-button', 'Change total allocation');
    changeTarget.type = 'button';
    const targetForm = element('form', 'edit-form');
    targetForm.hidden = true;
    targetForm.id = `total-${budgetGroup.id}`;
    changeTarget.setAttribute('aria-controls', targetForm.id);
    changeTarget.addEventListener('click', () => {
      targetForm.hidden = !targetForm.hidden;
    });

    const targetLabel = inputLabel(
      `Total allocation per ${intervalLabel()} ($)`,
      'total',
      { type: 'number', min: '0', step: '0.01', required: true }
    );
    targetLabel.querySelector('input').value = (target / 100).toFixed(2);

    const targetPreview = element('p', 'allocation-preview');
    const updateTargetPreview = () => {
      const nextTarget = nonnegativeCents(targetLabel.querySelector('input').value);
      targetPreview.textContent = nextTarget === null
        ? 'Enter a valid amount.'
        : `${allocationDifference(allocated, nextTarget)} after change`;
    };
    targetLabel.querySelector('input').addEventListener('input', updateTargetPreview);
    updateTargetPreview();

    const targetSubmit = element('button', 'secondary-button', 'Update total');
    targetSubmit.type = 'submit';
    const targetMessage = element('p', 'form-message');
    targetForm.append(targetLabel, targetSubmit, targetPreview, targetMessage);

    targetForm.addEventListener('submit', event => {
      event.preventDefault();
      const intervalCents = nonnegativeCents(targetLabel.querySelector('input').value);
      if (intervalCents === null) {
        targetMessage.textContent = 'Enter a valid total.';
        return;
      }
      const dailyCents = dailyCentsFromInterval(intervalCents, budget.interval);
      const next = {
        ...budget,
        groups: budget.groups.map(group =>
          group.id === budgetGroup.id ? { ...group, dailyCents } : group
        )
      };
      if (save(next, targetMessage)) renderSettings();
    });

    summary.append(changeTarget, targetForm);
    groupCard.append(summary);

    const members = element('ul', 'settings-list group-members');
    groupCard.append(members);
    list.append(groupCard);

    const categories = budget.categories.filter(category => category.groupId === budgetGroup.id);
    if (!categories.length) members.append(element('li', 'muted', 'No categories in this group.'));

    for (const category of categories) {
      const item = element('li', 'setting-card');
      const rowHeader = element('div', 'setting-header');

      const heading = element('h3', 'category-heading');
      const picker = element('input', 'icon-picker');
      picker.type = 'text';
      picker.maxLength = 64;
      picker.value = category.icon || DEFAULT_ICON;
      picker.setAttribute('aria-label', `Emoji icon for ${category.name}`);
      picker.addEventListener('input', () => {
        const status = document.querySelector('#category-status');
        const icon = singleEmoji(picker.value);
        if (!icon) {
          status.textContent = 'Enter one emoji for the icon.';
          return;
        }
        save({
          ...budget,
          categories: budget.categories.map(entry =>
            entry.id === category.id ? { ...entry, icon } : entry
          )
        }, status);
      });
      heading.append(picker, document.createTextNode(category.name));

      const edit = iconButton('edit', `Edit ${category.name}`);
      const remove = iconButton('remove', `Delete ${category.name}`);
      const headerActions = element('div', 'setting-header-actions');
      headerActions.append(edit, remove);
      rowHeader.append(heading, headerActions);
      item.append(rowHeader);

      const facts = element('dl', 'category-facts');
      for (const [term, value] of [
        ['Allocation', `${dollars(currentAllocation(category, budget.interval))} / ${intervalLabel()}`],
        ['Accrual per day', dollars(currentDaily(category))]
      ]) {
        const fact = element('div');
        fact.append(element('dt', '', term), element('dd', '', value));
        facts.append(fact);
      }
      item.append(facts);

      const form = element('form', 'edit-form');
      form.hidden = true;
      const allocationLabel = inputLabel(
        `Allocation per ${intervalLabel()} ($)`,
        'allocation',
        { type: 'number', min: '0.01', step: '0.01', required: true }
      );
      allocationLabel.querySelector('input').value =
        (currentAllocation(category, budget.interval) / 100).toFixed(2);

      const groupLabel = element('label', '', 'Group');
      const groupSelect = element('select');
      groupOptions(groupSelect, category.groupId);
      groupLabel.append(groupSelect);

      const preview = element('p', 'allocation-preview');
      const recalc = () => {
        const intervalCents = cents(allocationLabel.querySelector('input').value);
        if (intervalCents === null) {
          preview.textContent = 'Enter a valid allocation.';
          return;
        }
        const dailyCents = dailyCentsFromInterval(intervalCents, budget.interval);
        allocationPreview(preview, groupSelect.value, {
          ...category,
          groupId: groupSelect.value,
          changes: [{ day: budgetDay(), dailyCents }]
        });
      };
      allocationLabel.querySelector('input').addEventListener('input', recalc);
      groupSelect.addEventListener('change', recalc);
      recalc();

      const submit = element('button', 'secondary-button', 'Update');
      submit.type = 'submit';
      const message = element('p', 'form-message');
      form.append(allocationLabel, groupLabel, preview, submit, message);

      edit.addEventListener('click', () => {
        form.hidden = !form.hidden;
        edit.setAttribute('aria-expanded', String(!form.hidden));
        if (!form.hidden) allocationLabel.querySelector('input').focus();
      });

      form.addEventListener('submit', event => {
        event.preventDefault();
        const intervalCents = cents(allocationLabel.querySelector('input').value);
        if (intervalCents === null) {
          message.textContent = 'Enter a valid allocation.';
          return;
        }
        const dailyCents = dailyCentsFromInterval(intervalCents, budget.interval);
        const changes = [...category.changes];
        if (changes.at(-1).day === budgetDay()) {
          changes[changes.length - 1] = { day: budgetDay(), dailyCents };
        } else {
          changes.push({ day: budgetDay(), dailyCents });
        }
        const next = {
          ...budget,
          categories: budget.categories.map(entry =>
            entry.id === category.id
              ? { ...entry, groupId: groupSelect.value, changes }
              : entry
          )
        };
        if (save(next, message)) renderSettings();
      });

      remove.addEventListener('click', () => {
        const tx = budget.purchases.filter(purchase => purchase.categoryId === category.id).length;
        const tr = budget.transfers.filter(transfer =>
          transfer.fromCategoryId === category.id || transfer.toCategoryId === category.id
        ).length;
        if (!confirm(
          `Delete ${category.name}, its ${tx} transaction${tx === 1 ? '' : 's'} and ${tr} transfer${tr === 1 ? '' : 's'}? This cannot be undone.`
        )) return;

        const status = document.querySelector('#category-status');
        if (save({
          ...budget,
          categories: budget.categories.filter(entry => entry.id !== category.id),
          purchases: budget.purchases.filter(purchase => purchase.categoryId !== category.id),
          transfers: budget.transfers.filter(transfer =>
            transfer.fromCategoryId !== category.id && transfer.toCategoryId !== category.id
          )
        }, status)) renderSettings();
      });

      item.append(form);
      members.append(item);
    }
  }
}

function renderTransactions() {
  const list = document.querySelector('#transaction-list');
  if (!list) return;
  list.replaceChildren();

  const id = new URLSearchParams(location.search).get('category');
  const category = budget.categories.find(entry => entry.id === id);
  const heading = document.querySelector('#transaction-heading');
  const summary = document.querySelector('#transaction-summary');

  if (!category) {
    heading.textContent = 'Category not found';
    summary.replaceChildren();
    return;
  }

  heading.textContent = `${category.icon || DEFAULT_ICON} ${category.name}`;
  document.title = `${category.name} history · Piggy Budget`;

  const remaining = balanceFor(category, budget.purchases, budget, budgetDay());
  const spent = netSpentFor(category, budget.purchases, budgetDay());
  const transferEffect = netTransfersFor(category, budget.transfers, budgetDay());
  const accumulated = remaining + spent - transferEffect;

  summary.replaceChildren();
  for (const [term, value] of [
    ['Budgeting since', formatDay(category.createdDay)],
    ['Total accumulated', dollars(accumulated)],
    ['Total spent', dollars(spent)],
    ['Remaining', dollars(remaining)]
  ]) {
    const row = element('div');
    row.append(element('dt', '', term), element('dd', '', value));
    summary.append(row);
  }

  const entries = [
    ...budget.purchases
      .filter(purchase => purchase.categoryId === id)
      .map(item => ({ kind: 'purchase', item })),
    ...budget.transfers
      .filter(transfer => transfer.fromCategoryId === id || transfer.toCategoryId === id)
      .map(item => ({ kind: 'transfer', item }))
  ].sort((a, b) => (b.item.createdAt || b.item.day).localeCompare(a.item.createdAt || a.item.day));

  if (!entries.length) list.append(element('p', 'muted', 'No history in this category yet.'));

  for (const entry of entries) {
    const wrapper = element('article', 'transaction-entry');
    const row = element('div', 'transaction-row');
    const details = element('div');

    if (entry.kind === 'transfer') {
      const transfer = entry.item;
      const outgoing = transfer.fromCategoryId === id;
      const other = budget.categories.find(candidate =>
        candidate.id === (outgoing ? transfer.toCategoryId : transfer.fromCategoryId)
      );
      details.append(
        element('strong', '', transfer.note || `Transfer ${outgoing ? 'to' : 'from'} ${other?.name || 'category'}`),
        element('small', '', `${formatDay(transfer.day)} · Transfer ${outgoing ? 'to' : 'from'} ${other?.name || 'category'}`)
      );
      row.append(
        details,
        element(
          'span',
          `purchase-amount${outgoing ? '' : ' refund-amount'}`,
          `${outgoing ? '−' : '+'}${dollars(transfer.amountCents)}`
        )
      );

      const actions = element('div', 'transaction-actions');
      const remove = iconButton('remove', 'Remove transfer');
      remove.addEventListener('click', () => {
        if (save({
          ...budget,
          transfers: budget.transfers.filter(candidate => candidate.id !== transfer.id)
        }, document.querySelector('#transaction-message'))) renderTransactions();
      });
      actions.append(remove);
      row.append(actions);
      wrapper.append(row);
      list.append(wrapper);
      continue;
    }

    const transaction = entry.item;
    const refund = transaction.amountCents < 0;
    details.append(
      element('strong', '', transaction.note || (refund ? 'Refund' : 'Purchase')),
      element('small', '', `${formatDay(transaction.day)} · ${refund ? 'Refund' : 'Purchase'}`)
    );
    row.append(
      details,
      element(
        'span',
        `purchase-amount${refund ? ' refund-amount' : ''}`,
        `${refund ? '+' : '−'}${dollars(Math.abs(transaction.amountCents))}`
      )
    );

    const actions = element('div', 'transaction-actions');
    const edit = iconButton('edit', 'Edit transaction');
    const remove = iconButton('remove', 'Remove transaction');
    actions.append(edit, remove);
    row.append(actions);
    wrapper.append(row);

    const form = element('form', 'transaction-edit-form');
    form.hidden = true;

    const amount = inputLabel('Amount ($)', 'amount', {
      type: 'number', min: '0.01', step: '0.01', required: true
    });
    amount.querySelector('input').value = (Math.abs(transaction.amountCents) / 100).toFixed(2);

    const note = inputLabel('Description (optional)', 'note', { maxLength: 100 });
    note.querySelector('input').value = transaction.note || '';

    const day = inputLabel('Date', 'day', { type: 'date', required: true });
    day.querySelector('input').value = transaction.day;
    day.querySelector('input').max = budgetDay();

    const categoryLabel = element('label', '', 'Category');
    const categorySelect = element('select');
    categoryOptions(categorySelect, transaction.categoryId);
    categoryLabel.append(categorySelect);

    const refundLabel = element('label', 'checkbox-label');
    const refundInput = element('input');
    refundInput.type = 'checkbox';
    refundInput.checked = refund;
    refundLabel.append(refundInput, document.createTextNode('Refund'));

    const buttons = element('div', 'edit-buttons');
    const saveButton = element('button', '', 'Save changes');
    saveButton.type = 'submit';
    const cancel = element('button', 'secondary-button', 'Cancel');
    cancel.type = 'button';
    buttons.append(saveButton, cancel);

    const message = element('p', 'form-message');
    form.append(amount, note, day, categoryLabel, refundLabel, buttons, message);
    wrapper.append(form);

    const setMin = () => {
      day.querySelector('input').min =
        budget.categories.find(candidate => candidate.id === categorySelect.value)?.createdDay || '';
    };
    categorySelect.addEventListener('change', setMin);
    setMin();

    edit.addEventListener('click', () => {
      form.hidden = !form.hidden;
      if (!form.hidden) amount.querySelector('input').focus();
    });

    cancel.addEventListener('click', () => {
      form.hidden = true;
      edit.focus();
    });

    remove.addEventListener('click', () => {
      if (save({
        ...budget,
        purchases: budget.purchases.filter(candidate => candidate.id !== transaction.id)
      }, document.querySelector('#transaction-message'))) renderTransactions();
    });

    form.addEventListener('submit', event => {
      event.preventDefault();
      const amountCents = cents(amount.querySelector('input').value);
      const target = budget.categories.find(candidate => candidate.id === categorySelect.value);
      const transactionDay = day.querySelector('input').value;
      if (
        amountCents === null ||
        !target ||
        !validDay(transactionDay) ||
        transactionDay < target.createdDay ||
        transactionDay > budgetDay()
      ) {
        message.textContent = 'Enter a valid amount, category, and date.';
        return;
      }

      const updated = {
        ...transaction,
        categoryId: target.id,
        amountCents: refundInput.checked ? -amountCents : amountCents,
        note: note.querySelector('input').value.trim(),
        day: transactionDay
      };

      if (save({
        ...budget,
        purchases: budget.purchases.map(candidate =>
          candidate.id === transaction.id ? updated : candidate
        )
      }, message)) renderTransactions();
    });

    list.append(wrapper);
  }
}

const intervalSelect = document.querySelector('#budget-interval');
if (intervalSelect) {
  intervalSelect.addEventListener('change', () => {
    const interval = intervalSelect.value;
    if (!INTERVALS[interval]) return;
    if (save({ ...budget, interval })) renderAll();
  });
}

const groupForm = document.querySelector('#group-form');
const addGroupButton = document.querySelector('#add-group');
const addGroupPanel = document.querySelector('#add-group-panel');

if (groupForm) {
  addGroupButton.addEventListener('click', () => {
    addGroupPanel.hidden = !addGroupPanel.hidden;
    if (!addGroupPanel.hidden) groupForm.elements.namedItem('name').focus();
  });

  groupForm.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(groupForm);
    const name = String(data.get('name')).trim();
    const intervalCents = nonnegativeCents(data.get('total'));
    const message = document.querySelector('#group-message');

    if (!name || intervalCents === null) {
      message.textContent = 'Enter a name and valid allocation.';
      return;
    }

    const group = {
      id: crypto.randomUUID(),
      name,
      dailyCents: dailyCentsFromInterval(intervalCents, budget.interval)
    };

    if (save({ ...budget, groups: [...budget.groups, group] }, message)) {
      groupForm.reset();
      addGroupPanel.hidden = true;
      renderAll();
    }
  });
}

const categoryForm = document.querySelector('#category-form');
const addCategoryButton = document.querySelector('#add-category');
const addCategoryPanel = document.querySelector('#add-category-panel');

function refreshCategoryForm() {
  if (!categoryForm) return;
  groupOptions(categoryForm.elements.namedItem('groupId'));
  startingOptions(categoryForm.elements.namedItem('startingMultiplier'));
}

if (categoryForm) {
  addCategoryButton.addEventListener('click', () => {
    addCategoryPanel.hidden = !addCategoryPanel.hidden;
    if (!addCategoryPanel.hidden) {
      refreshCategoryForm();
      categoryForm.elements.namedItem('name').focus();
    }
  });

  if (location.hash === '#add-category') {
    addCategoryPanel.hidden = false;
    refreshCategoryForm();
  }

  const preview = () => {
    const intervalCents = cents(categoryForm.elements.namedItem('allocation').value);
    const groupId = categoryForm.elements.namedItem('groupId').value;
    const node = document.querySelector('#new-category-preview');
    if (intervalCents === null) {
      node.textContent = 'Enter an allocation to see the group total.';
      return;
    }
    allocationPreview(node, groupId, {
      id: 'preview',
      groupId,
      changes: [{
        day: budgetDay(),
        dailyCents: dailyCentsFromInterval(intervalCents, budget.interval)
      }]
    });
  };

  categoryForm.elements.namedItem('allocation').addEventListener('input', preview);
  categoryForm.elements.namedItem('groupId').addEventListener('change', preview);

  categoryForm.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(categoryForm);
    const name = String(data.get('name')).trim();
    const icon = singleEmoji(data.get('icon'));
    const intervalCents = cents(data.get('allocation'));
    const groupId = String(data.get('groupId'));
    const multiplier = Number(data.get('startingMultiplier'));
    const message = document.querySelector('#category-message');

    if (
      !name ||
      !icon ||
      intervalCents === null ||
      !budget.groups.some(group => group.id === groupId) ||
      ![0, 1, 2, 3, 4, 6].includes(multiplier)
    ) {
      message.textContent = 'Enter valid category details.';
      return;
    }

    const category = {
      id: crypto.randomUUID(),
      name,
      icon,
      groupId,
      createdDay: budgetDay(),
      startingCents: multiplier * intervalCents,
      changes: [{
        day: budgetDay(),
        dailyCents: dailyCentsFromInterval(intervalCents, budget.interval)
      }]
    };

    if (save({ ...budget, categories: [...budget.categories, category] }, message)) {
      categoryForm.reset();
      addCategoryPanel.hidden = true;
      renderAll();
    }
  });
}

const transferToggle = document.querySelector('#transfer-toggle');
const transferPanel = document.querySelector('#transfer-panel');
const transferForm = document.querySelector('#transfer-form');

function refreshTransferForm() {
  if (!transferForm) return;
  const from = transferForm.elements.namedItem('fromCategoryId');
  const to = transferForm.elements.namedItem('toCategoryId');
  categoryOptions(from, from.value);
  categoryOptions(to, to.value);
  transferToggle.disabled = budget.categories.length < 2;
  if (budget.categories.length < 2) {
    transferPanel.hidden = true;
    return;
  }
  if (to.value === from.value) {
    to.value = budget.categories.find(category => category.id !== from.value)?.id || '';
  }
}

if (transferForm) {
  transferToggle.addEventListener('click', () => {
    transferPanel.hidden = !transferPanel.hidden;
    if (!transferPanel.hidden) transferForm.elements.namedItem('fromCategoryId').focus();
  });

  transferForm.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(transferForm);
    const fromCategoryId = String(data.get('fromCategoryId'));
    const toCategoryId = String(data.get('toCategoryId'));
    const amountCents = cents(data.get('amount'));
    const message = document.querySelector('#transfer-message');

    if (
      fromCategoryId === toCategoryId ||
      amountCents === null ||
      !budget.categories.some(category => category.id === fromCategoryId) ||
      !budget.categories.some(category => category.id === toCategoryId)
    ) {
      message.textContent = 'Choose two different categories and a valid amount.';
      return;
    }

    const transfer = {
      id: crypto.randomUUID(),
      fromCategoryId,
      toCategoryId,
      amountCents,
      note: String(data.get('note')).trim(),
      day: budgetDay(),
      createdAt: new Date().toISOString()
    };

    if (save({ ...budget, transfers: [...budget.transfers, transfer] }, message)) renderAll();
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
        renderAll();
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

function renderSimulation() {
  const status = document.querySelector('#simulation-status');
  if (!status) return;
  const advanced = budget.dayOffset || 0;
  status.textContent = `Budget date: ${budgetDay()} · ${advanced} day${advanced === 1 ? '' : 's'} advanced`;
}

if (advanceButton) {
  advanceButton.addEventListener('click', () => {
    const message = document.querySelector('#advance-message');
    if (save({ ...budget, dayOffset: (budget.dayOffset || 0) + 1 }, message)) renderAll();
  });
}

function renderAll() {
  renderHome();
  renderSettings();
  renderTransactions();
  renderIntervalSetting();
  refreshTransferForm();
  renderSimulation();
  showStorageWarning();
}

renderAll();

window.addEventListener('storage', event => {
  if (event.key === STORAGE_KEY) {
    budget = load();
    renderAll();
  }
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) renderAll();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .catch(error => console.warn('Offline mode unavailable:', error));
  });
}
