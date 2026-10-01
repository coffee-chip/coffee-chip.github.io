import {
  balanceFor, goalBalanceFor, bucketBalanceFor, canTransferFrom
} from './budget.js';
import {
  budget, budgetDay, element, inputLabel, save, DEFAULT_ICON, cents, dollars,
  bucketOptions, allBuckets, setupPage
} from './core.js';

function renderHome() {
  const list = document.querySelector('#category-list');
  if (!list) return;
  list.replaceChildren();

  const entries = [];
  const count = Math.max(budget.categories.length, budget.goals.length);
  for (let index = 0; index < count; index++) {
    if (budget.categories[index]) entries.push({ type: 'category', item: budget.categories[index] });
    if (budget.goals[index]) entries.push({ type: 'goal', item: budget.goals[index] });
  }

  entries.forEach((entry, cardIndex) => {
    if (entry.type === 'category') {
      const category = entry.item;
      const categoryBalance = balanceFor(category, budget.purchases, budget, budgetDay());
      const card = element('article', 'category-card');
      card.dataset.categoryId = category.id;

      const top = element('div', 'category-top');
      const heading = element('h3', 'category-heading');
      const icon = element('span', 'category-emoji', category.icon || DEFAULT_ICON);
      icon.ariaHidden = 'true';
      heading.append(icon, document.createTextNode(category.name));
      top.append(
        heading,
        element('p', `balance${categoryBalance < 0 ? ' negative' : ''}`, dollars(categoryBalance))
      );
      card.append(top);

      const actions = element('div', 'category-actions');
      const shake = element('button', '', 'Shake this piggy');
      shake.type = 'button';
      shake.ariaExpanded = 'false';

      const history = element('a', 'history-link', 'View history');
      history.href = `./transactions.html?category=${encodeURIComponent(category.id)}`;
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
        type: 'number',
        min: '0.01',
        step: '0.01',
        inputMode: 'decimal',
        placeholder: '0.00',
        required: true
      }));
      form.append(inputLabel('Description (optional)', 'note', {
        maxLength: 100,
        placeholder: 'What was it for?'
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
        if (save({ ...budget, purchases: [...budget.purchases, transaction] }, message)) renderPage();
      });

      card.append(form);
      list.append(card);
      return;
    }

    const goal = entry.item;
    const balance = goalBalanceFor(goal, budget.transfers, budgetDay());
    const progress = Math.max(0, Math.min(1, balance / goal.targetCents));
    const remaining = goal.targetCents - balance;
    const card = element('article', 'category-card goal-card');
    card.dataset.goalId = goal.id;

    const x1 = 8 + (cardIndex * 29) % 72;
    const y1 = 7 + (cardIndex * 37) % 70;
    const x2 = 12 + (cardIndex * 43 + 31) % 76;
    const y2 = 10 + (cardIndex * 23 + 41) % 72;
    const x3 = 9 + (cardIndex * 53 + 17) % 78;
    const y3 = 12 + (cardIndex * 31 + 55) % 74;
    card.style.setProperty('--pearl-x1', `${x1}%`);
    card.style.setProperty('--pearl-y1', `${y1}%`);
    card.style.setProperty('--pearl-x2', `${x2}%`);
    card.style.setProperty('--pearl-y2', `${y2}%`);
    card.style.setProperty('--pearl-x3', `${x3}%`);
    card.style.setProperty('--pearl-y3', `${y3}%`);
    card.style.setProperty('--pearl-angle', `${115 + (cardIndex * 17) % 70}deg`);
    card.style.setProperty('--shine-angle', `${96 + (cardIndex * 19) % 62}deg`);
    card.style.setProperty('--shine-rotation', `${-12 + (cardIndex * 7) % 24}deg`);

    const top = element('div', 'category-top');
    const heading = element('h3', 'category-heading');
    const icon = element('span', 'category-emoji', goal.icon || '🎯');
    icon.ariaHidden = 'true';
    heading.append(icon, document.createTextNode(goal.name));
    top.append(heading, element('p', 'balance', dollars(balance)));
    card.append(top);

    const progressTrack = element('div', 'goal-progress');
    progressTrack.setAttribute('role', 'progressbar');
    progressTrack.setAttribute('aria-label', `${goal.name} progress`);
    progressTrack.setAttribute('aria-valuemin', '0');
    progressTrack.setAttribute('aria-valuemax', String(goal.targetCents));
    progressTrack.setAttribute('aria-valuenow', String(Math.max(0, balance)));
    const progressFill = element('span', 'goal-progress-fill');
    progressFill.style.width = `${progress * 100}%`;
    progressTrack.append(progressFill);
    card.append(progressTrack);

    card.append(element(
      'p',
      'goal-meta',
      balance >= goal.targetCents
        ? `Goal reached · ${dollars(goal.targetCents)} target`
        : `${dollars(Math.max(0, remaining))} to go · ${dollars(goal.targetCents)} target`
    ));

    list.append(card);
  });
}

const transferToggle = document.querySelector('#transfer-toggle');
const transferPanel = document.querySelector('#transfer-panel');
const transferForm = document.querySelector('#transfer-form');

function refreshTransferForm() {
  if (!transferForm) return;
  const from = transferForm.elements.namedItem('fromBucketId');
  const to = transferForm.elements.namedItem('toBucketId');
  bucketOptions(from, from.value);
  bucketOptions(to, to.value);
  const buckets = allBuckets();
  transferToggle.disabled = buckets.length < 2;
  if (buckets.length < 2) {
    transferPanel.hidden = true;
    return;
  }
  if (to.value === from.value) {
    to.value = buckets.find(bucket => bucket.ref !== from.value)?.ref || '';
  }
}

if (transferForm) {
  transferToggle.addEventListener('click', () => {
    transferPanel.hidden = !transferPanel.hidden;
    if (!transferPanel.hidden) transferForm.elements.namedItem('fromBucketId').focus();
  });

  transferForm.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(transferForm);
    const fromBucketId = String(data.get('fromBucketId'));
    const toBucketId = String(data.get('toBucketId'));
    const amountCents = cents(data.get('amount'));
    const message = document.querySelector('#transfer-message');
    const bucketIds = new Set(allBuckets().map(bucket => bucket.ref));

    if (
      fromBucketId === toBucketId ||
      amountCents === null ||
      !bucketIds.has(fromBucketId) ||
      !bucketIds.has(toBucketId)
    ) {
      message.textContent = 'Choose two different categories or goals and a valid amount.';
      return;
    }

    const sourceBalance = bucketBalanceFor(fromBucketId, budget, budgetDay());
    if (!canTransferFrom(fromBucketId, amountCents, budget, budgetDay())) {
      message.textContent = `Transfer exceeds the source balance${sourceBalance === null ? '.' : ` of ${dollars(sourceBalance)}.`}`;
      return;
    }

    const transfer = {
      id: crypto.randomUUID(),
      fromBucketId,
      toBucketId,
      amountCents,
      note: String(data.get('note')).trim(),
      day: budgetDay(),
      createdAt: new Date().toISOString()
    };

    if (save({ ...budget, transfers: [...budget.transfers, transfer] }, message)) renderPage();
  });
}



function renderPage() {
  renderHome();
  refreshTransferForm();
}

setupPage(renderPage);
