import {
  allocatedForGroup, goalBalanceFor, bucketRef, currentDaily, currentAllocation,
  groupAllocation, dailyCentsFromInterval
} from './budget.js';
import {
  budget, budgetDay, element, inputLabel, save, cents, dollars, intervalLabel,
  allocationDifference, allocationPreview, nonnegativeCents, groupOptions,
  startingOptions, singleEmoji, iconButton, setupPage, actionButton, formActions,
  disclosure, DEFAULT_ICON
} from './core.js';

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

    const changeTarget = actionButton('Change total allocation', {
      style: 'transparent',
      compact: true
    });
    const targetForm = element('form', 'edit-form');
    targetForm.hidden = true;
    targetForm.id = `total-${budgetGroup.id}`;
    changeTarget.setAttribute('aria-controls', targetForm.id);


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

    const targetDisclosure = disclosure(changeTarget, targetForm, {
      focus: () => targetLabel.querySelector('input')
    });
    const { container: targetActions, cancel: targetCancel } = formActions('Update total');
    targetCancel.addEventListener('click', () => renderSettings());
    const targetMessage = element('p', 'form-message');
    targetForm.append(targetLabel, targetActions, targetPreview, targetMessage);

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
    const goals = budget.goals.filter(goal => goal.groupId === budgetGroup.id);
    if (!categories.length && !goals.length) members.append(element('li', 'muted', 'No categories or goals in this group.'));

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
        if (!icon) return;
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
      const headerActions = element('div', 'compact-actions');
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

      const editDisclosure = disclosure(edit, form, {
        focus: () => allocationLabel.querySelector('input')
      });
      const { container: actions, cancel } = formActions('Update');
      cancel.addEventListener('click', () => renderSettings());
      const message = element('p', 'form-message');
      form.append(allocationLabel, groupLabel, preview, actions, message);

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
        const ref = bucketRef('category', category.id);
        const tr = budget.transfers.filter(transfer =>
          transfer.fromBucketId === ref || transfer.toBucketId === ref
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
            transfer.fromBucketId !== ref && transfer.toBucketId !== ref
          )
        }, status)) renderSettings();
      });

      item.append(form);
      members.append(item);
    }

    for (const goal of goals) {
      const item = element('li', 'setting-card goal-setting-card');
      const rowHeader = element('div', 'setting-header');
      const heading = element('h3', 'category-heading');
      const picker = element('input', 'icon-picker');
      picker.type = 'text';
      picker.maxLength = 64;
      picker.value = goal.icon || '🎯';
      picker.setAttribute('aria-label', `Emoji icon for ${goal.name}`);
      picker.addEventListener('input', () => {
        const status = document.querySelector('#category-status');
        const icon = singleEmoji(picker.value);
        if (!icon) return;
        save({
          ...budget,
          goals: budget.goals.map(entry => entry.id === goal.id ? { ...entry, icon } : entry)
        }, status);
      });
      heading.append(picker, document.createTextNode(goal.name));

      const edit = iconButton('edit', `Edit ${goal.name}`);
      const remove = iconButton('remove', `Delete ${goal.name}`);
      const headerActions = element('div', 'compact-actions');
      headerActions.append(edit, remove);
      rowHeader.append(heading, headerActions);
      item.append(rowHeader);

      const facts = element('dl', 'category-facts');
      for (const [term, value] of [
        ['Goal target', dollars(goal.targetCents)],
        ['Saved', dollars(goalBalanceFor(goal, budget.transfers, budgetDay()))]
      ]) {
        const fact = element('div');
        fact.append(element('dt', '', term), element('dd', '', value));
        facts.append(fact);
      }
      item.append(facts);

      const form = element('form', 'edit-form');
      form.hidden = true;
      const targetLabel = inputLabel('Target amount ($)', 'target', {
        type: 'number', min: '0.01', step: '0.01', required: true
      });
      targetLabel.querySelector('input').value = (goal.targetCents / 100).toFixed(2);

      const groupLabel = element('label', '', 'Group');
      const groupSelect = element('select');
      groupOptions(groupSelect, goal.groupId);
      groupLabel.append(groupSelect);

      const editDisclosure = disclosure(edit, form, {
        focus: () => targetLabel.querySelector('input')
      });
      const { container: actions, cancel } = formActions('Update');
      cancel.addEventListener('click', () => editDisclosure.close());
      const message = element('p', 'form-message');
      form.append(targetLabel, groupLabel, actions, message);

      form.addEventListener('submit', event => {
        event.preventDefault();
        const targetCents = cents(targetLabel.querySelector('input').value);
        if (targetCents === null) {
          message.textContent = 'Enter a valid target amount.';
          return;
        }
        const next = {
          ...budget,
          goals: budget.goals.map(entry =>
            entry.id === goal.id ? { ...entry, groupId: groupSelect.value, targetCents } : entry
          )
        };
        if (save(next, message)) renderSettings();
      });

      remove.addEventListener('click', () => {
        const ref = bucketRef('goal', goal.id);
        const tr = budget.transfers.filter(transfer =>
          transfer.fromBucketId === ref || transfer.toBucketId === ref
        ).length;
        if (!confirm(
          `Delete ${goal.name} and its ${tr} transfer${tr === 1 ? '' : 's'}? This cannot be undone.`
        )) return;
        const status = document.querySelector('#category-status');
        if (save({
          ...budget,
          goals: budget.goals.filter(entry => entry.id !== goal.id),
          transfers: budget.transfers.filter(transfer =>
            transfer.fromBucketId !== ref && transfer.toBucketId !== ref
          )
        }, status)) renderSettings();
      });

      item.append(form);
      members.append(item);
    }
  }
}

const groupForm = document.querySelector('#group-form');
const addGroupButton = document.querySelector('#add-group');
const addGroupPanel = document.querySelector('#add-group-panel');
const addGroupCancel = document.querySelector('#group-cancel');
const groupDisclosure = addGroupButton && addGroupPanel
  ? disclosure(addGroupButton, addGroupPanel, {
      focus: () => groupForm?.elements.namedItem('name')
    })
  : null;

if (groupForm) {
  addGroupCancel?.addEventListener('click', () => {
    groupForm.reset();
    groupDisclosure?.close();
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
      groupDisclosure?.close();
      renderSettings();
    }
  });
}

const categoryForm = document.querySelector('#category-form');
const addCategoryButton = document.querySelector('#add-category');
const addCategoryPanel = document.querySelector('#add-category-panel');
const addCategoryCancel = document.querySelector('#category-cancel');
const categoryDisclosure = addCategoryButton && addCategoryPanel
  ? disclosure(addCategoryButton, addCategoryPanel, {
      focus: () => categoryForm?.elements.namedItem('name')
    })
  : null;

function refreshCategoryForm() {
  if (!categoryForm) return;
  groupOptions(categoryForm.elements.namedItem('groupId'));
  startingOptions(categoryForm.elements.namedItem('startingMultiplier'));
}

if (categoryForm) {
  addCategoryButton.addEventListener('click', refreshCategoryForm);
  addCategoryCancel?.addEventListener('click', () => {
    categoryForm.reset();
    categoryDisclosure?.close();
  });

  if (location.hash === '#add-category') {
    refreshCategoryForm();
    categoryDisclosure?.open();
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
      categoryDisclosure?.close();
      renderSettings();
    }
  });
}

const goalForm = document.querySelector('#goal-form');
const addGoalButton = document.querySelector('#add-goal');
const addGoalPanel = document.querySelector('#add-goal-panel');
const addGoalCancel = document.querySelector('#goal-cancel');
const goalDisclosure = addGoalButton && addGoalPanel
  ? disclosure(addGoalButton, addGoalPanel, {
      focus: () => goalForm?.elements.namedItem('name')
    })
  : null;

function refreshGoalForm() {
  if (!goalForm) return;
  groupOptions(goalForm.elements.namedItem('groupId'));
}

if (goalForm) {
  addGoalButton.addEventListener('click', refreshGoalForm);
  addGoalCancel?.addEventListener('click', () => {
    goalForm.reset();
    goalDisclosure?.close();
  });

  goalForm.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(goalForm);
    const name = String(data.get('name')).trim();
    const icon = singleEmoji(data.get('icon'));
    const groupId = String(data.get('groupId'));
    const targetCents = cents(data.get('target'));
    const message = document.querySelector('#goal-message');

    if (
      !name ||
      !icon ||
      targetCents === null ||
      !budget.groups.some(group => group.id === groupId)
    ) {
      message.textContent = 'Enter valid goal details.';
      return;
    }

    const goal = {
      id: crypto.randomUUID(),
      name,
      icon,
      groupId,
      targetCents,
      startingCents: 0,
      createdDay: budgetDay()
    };

    if (save({ ...budget, goals: [...budget.goals, goal] }, message)) {
      goalForm.reset();
      goalForm.elements.namedItem('icon').value = '🎯';
      goalDisclosure?.close();
      renderSettings();
    }
  });
}



setupPage(renderSettings);
