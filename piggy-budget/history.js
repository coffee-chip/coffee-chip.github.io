import {
  balanceFor, netSpentFor, netTransfersFor, bucketRef
} from './budget.js';
import {
  budget, budgetDay, formatDay, element, save, dollars, DEFAULT_ICON,
  bucketByRef, iconButton, inputLabel, categoryOptions, cents, validDay, setupPage
} from './core.js';

function renderTransactions() {
  const list = document.querySelector('#transaction-list');
  if (!list) return;
  list.replaceChildren();

  const id = new URLSearchParams(location.search).get('category');
  const category = budget.categories.find(entry => entry.id === id);
  const heading = document.querySelector('#header-page-title');
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
      .filter(transfer => {
        const ref = bucketRef('category', id);
        return transfer.fromBucketId === ref || transfer.toBucketId === ref;
      })
      .map(item => ({ kind: 'transfer', item }))
  ].sort((a, b) => (b.item.createdAt || b.item.day).localeCompare(a.item.createdAt || a.item.day));

  if (!entries.length) list.append(element('p', 'muted', 'No history in this category yet.'));

  for (const entry of entries) {
    const wrapper = element('article', 'transaction-entry');
    const row = element('div', 'transaction-row');
    const details = element('div');

    if (entry.kind === 'transfer') {
      const transfer = entry.item;
      const categoryRef = bucketRef('category', id);
      const outgoing = transfer.fromBucketId === categoryRef;
      const other = bucketByRef(outgoing ? transfer.toBucketId : transfer.fromBucketId);
      const transferLine = `${outgoing ? 'To' : 'From'} ${other?.name || 'bucket'}${transfer.note ? `: ${transfer.note}` : ''}`;
      details.append(
        element('strong', 'transaction-date', formatDay(transfer.day)),
        element('small', 'transaction-description', transferLine)
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
      element('strong', 'transaction-date', formatDay(transaction.day)),
      element(
        'small',
        'transaction-description',
        transaction.note ? `${refund ? 'Refund' : 'Purchase'}: ${transaction.note}` : (refund ? 'Refund' : 'Purchase')
      )
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

setupPage(renderTransactions);
