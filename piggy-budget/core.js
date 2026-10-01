import {
  STORAGE_KEY, INTERVALS, emptyBudget, allocatedForGroup, localDay, addDays, cents,
  bucketRef, groupAllocation, dollars
} from './budget.js';

export { INTERVALS, cents, bucketRef, dollars };
export const DEFAULT_ICON = '🐷';

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
      Array.isArray(saved.goals) &&
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

export function budgetDay() {
  return addDays(localDay(), Number.isSafeInteger(budget.dayOffset) && budget.dayOffset >= 0 ? budget.dayOffset : 0);
}

export function formatDay(day, dateStyle = 'medium') {
  return new Intl.DateTimeFormat(undefined, { dateStyle }).format(new Date(`${day}T12:00:00`));
}

export function save(next, message = { textContent: '' }) {
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

export function element(tag, className = '', content = null) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content != null) node.textContent = content;
  return node;
}

export function actionButton(label, {
  style = 'primary',
  type = 'button',
  compact = false,
  icon = false,
  danger = false,
  className = ''
} = {}) {
  const classes = ['button', `button--${style}`];
  if (compact) classes.push('button--compact');
  if (icon) classes.push('button--icon');
  if (danger) classes.push('button--danger');
  if (className) classes.push(className);
  const button = element('button', classes.join(' '), label);
  button.type = type;
  return button;
}

export function formActions(submitLabel, {
  submitStyle = 'primary',
  cancelLabel = 'Cancel'
} = {}) {
  const container = element('div', 'form-actions');
  const submit = actionButton(submitLabel, { style: submitStyle, type: 'submit' });
  const cancel = actionButton(cancelLabel, { style: 'transparent' });
  cancel.dataset.formCancel = '';
  container.append(submit, cancel);
  return { container, submit, cancel };
}

export function disclosure(trigger, panel, {
  focus = null,
  initiallyOpen = false
} = {}) {
  const setOpen = open => {
    panel.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
    if (open) {
      const target = typeof focus === 'function' ? focus() : focus;
      target?.focus();
    }
  };

  trigger.setAttribute('aria-expanded', String(initiallyOpen));
  if (panel.id) trigger.setAttribute('aria-controls', panel.id);
  panel.hidden = !initiallyOpen;
  trigger.addEventListener('click', () => setOpen(true));

  return {
    open: () => setOpen(true),
    close: () => setOpen(false),
    setOpen
  };
}

export function inputLabel(text, name, attributes = {}) {
  const label = element('label', '', text);
  const input = element('input');
  input.name = name;
  for (const [key, value] of Object.entries(attributes)) input[key] = value;
  label.append(input);
  return label;
}

export function validDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export function singleEmoji(value) {
  const icon = String(value).trim();
  const graphemes = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(icon)];
  return graphemes.length === 1 &&
    /[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Presentation}\uFE0F\u20E3]/u.test(icon)
    ? icon
    : null;
}

export function nonnegativeCents(value) {
  if (String(value).trim() === '' || Number(value) < 0) return null;
  return Number(value) === 0 ? 0 : cents(value);
}

export function intervalLabel() {
  return INTERVALS[budget.interval].label;
}

export function allocationDifference(allocated, target) {
  const difference = Math.round(allocated - target);
  return difference > 0
    ? `${dollars(difference)} over`
    : difference < 0
      ? `${dollars(-difference)} under`
      : 'On target';
}

export function allocationPreview(node, groupId, replacement) {
  const group = budget.groups.find(entry => entry.id === groupId);
  if (!group) {
    node.textContent = '';
    return;
  }
  const allocated = allocatedForGroup(budget.categories, groupId, budget.interval, replacement);
  if (group.unlimited) {
    node.textContent = `${group.name}: ${dollars(allocated)} allocated · No limit`;
    return;
  }
  const target = groupAllocation(group, budget.interval);
  node.textContent = `${group.name}: ${allocationDifference(allocated, target)}`;
}

export function groupOptions(select, selected = '') {
  select.replaceChildren();
  for (const group of budget.groups) {
    const option = element('option', '', group.name);
    option.value = group.id;
    select.append(option);
  }
  select.value = selected || budget.groups[0]?.id || '';
}

export function categoryOptions(select, selected = '') {
  select.replaceChildren();
  for (const category of budget.categories) {
    const option = element('option', '', `${category.icon || DEFAULT_ICON} ${category.name}`);
    option.value = category.id;
    select.append(option);
  }
  if (selected && budget.categories.some(category => category.id === selected)) select.value = selected;
}

export function allBuckets() {
  return [
    ...budget.categories.map(category => ({
      ref: bucketRef('category', category.id),
      type: 'category',
      id: category.id,
      name: category.name,
      icon: category.icon || DEFAULT_ICON,
      createdDay: category.createdDay
    })),
    ...budget.goals.map(goal => ({
      ref: bucketRef('goal', goal.id),
      type: 'goal',
      id: goal.id,
      name: goal.name,
      icon: goal.icon || '🎯',
      createdDay: goal.createdDay
    }))
  ];
}

export function bucketOptions(select, selected = '') {
  select.replaceChildren();
  const categoryGroup = element('optgroup');
  categoryGroup.label = 'Categories';
  for (const category of budget.categories) {
    const option = element('option', '', `${category.icon || DEFAULT_ICON} ${category.name}`);
    option.value = bucketRef('category', category.id);
    categoryGroup.append(option);
  }
  const goalGroup = element('optgroup');
  goalGroup.label = 'Goals';
  for (const goal of budget.goals) {
    const option = element('option', '', `${goal.icon || '🎯'} ${goal.name}`);
    option.value = bucketRef('goal', goal.id);
    goalGroup.append(option);
  }
  if (categoryGroup.children.length) select.append(categoryGroup);
  if (goalGroup.children.length) select.append(goalGroup);
  if (selected && allBuckets().some(bucket => bucket.ref === selected)) select.value = selected;
}

export function bucketByRef(ref) {
  return allBuckets().find(bucket => bucket.ref === ref) || null;
}

export function startingOptions(select) {
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

export function iconButton(type, label) {
  const button = actionButton('', {
    style: 'transparent',
    compact: true,
    icon: true,
    danger: type === 'remove'
  });
  button.setAttribute('aria-label', label);
  button.title = label;
  if (type === 'edit') {
    const icon = element('span', 'edit-icon-glyph');
    icon.setAttribute('aria-hidden', 'true');
    button.append(icon);
  } else {
    button.textContent = '×';
  }
  return button;
}

export let budget = load();

export function setupPage(render) {
  render();
  showStorageWarning();

  window.addEventListener('storage', event => {
    if (event.key === STORAGE_KEY) {
      budget = load();
      render();
      showStorageWarning();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      render();
      showStorageWarning();
    }
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js')
        .catch(error => console.warn('Offline mode unavailable:', error));
    });
  }
}
