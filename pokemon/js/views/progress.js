import { state, getAverageScore } from '../state.js';
import { TYPES } from '../data/types.js';
import { createTypeBadge } from '../components/typeBadge.js';
import { getRelationshipMastery, parseRelationshipKey } from '../relationships.js';

const COLLAPSED_LIMIT = 5;
const EXPANDED_LIMIT = 100;
const expandedSections = new Set();

function el(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text) node.textContent = options.text;
  return node;
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function relationshipRow(record) {
  const relationship = parseRelationshipKey(record.key);
  const row = el('div', { className: 'relationship-row' });
  const pairing = el('div', { className: 'relationship-pair' });
  pairing.append(createTypeBadge(relationship.attackingType));
  pairing.append(el('span', { className: 'relationship-arrow', text: '→' }));
  pairing.append(createTypeBadge(relationship.defendingType));

  const summary = el('div', { className: 'relationship-summary' });
  summary.append(el('strong', { text: formatPercent(getRelationshipMastery(record)) }));
  summary.append(el('span', {
    className: 'muted',
    text: `${record.attempts} attempt${record.attempts === 1 ? '' : 's'} · ${record.misses} missed · ${record.falseSelections} false`
  }));

  row.append(pairing, summary);
  return row;
}

function relationshipPanel({ id, title, records, emptyText, rerender }) {
  const panel = el('section', { className: 'panel progress-panel' });
  const expanded = expandedSections.has(id);
  const visibleLimit = expanded ? EXPANDED_LIMIT : COLLAPSED_LIMIT;
  const visibleRecords = records.slice(0, visibleLimit);

  const heading = el('div', { className: 'progress-panel-heading' });
  heading.append(el('h3', { text: title }));
  if (records.length > COLLAPSED_LIMIT) {
    const toggle = el('button', {
      className: 'progress-expand-button',
      text: expanded
        ? 'Show fewer'
        : `Show more (${Math.min(records.length, EXPANDED_LIMIT)})`
    });
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.addEventListener('click', () => {
      if (expanded) expandedSections.delete(id);
      else expandedSections.add(id);
      rerender();
    });
    heading.append(toggle);
  }
  panel.append(heading);

  if (!records.length) {
    panel.append(el('p', { className: 'muted', text: emptyText }));
    return panel;
  }

  const list = el('div', { className: 'relationship-list' });
  for (const record of visibleRecords) list.append(relationshipRow(record));
  panel.append(list);

  if (expanded && records.length > EXPANDED_LIMIT) {
    panel.append(el('p', {
      className: 'muted progress-list-limit',
      text: `Showing the first ${EXPANDED_LIMIT} of ${records.length} ranked relationships.`
    }));
  }

  return panel;
}

export function renderProgress(container) {
  const page = el('section', { className: 'page' });
  page.append(el('h2', { text: 'Progress' }));

  const records = Object.entries(state.progress.relationshipStats ?? {})
    .map(([key, record]) => ({ ...record, key }))
    .filter(record => record.attempts > 0);

  const overview = el('section', { className: 'panel progress-overview' });
  overview.append(el('h3', { text: 'Overall' }));
  const metrics = el('div', { className: 'progress-metrics' });
  for (const [label, value] of [
    ['Questions', state.progress.totalAnswered],
    ['Average score', formatPercent(getAverageScore())],
    ['Relationships practiced', `${records.length} of ${TYPES.length * TYPES.length}`]
  ]) {
    const metric = el('div', { className: 'progress-metric' });
    metric.append(el('strong', { text: String(value) }), el('span', { text: label }));
    metrics.append(metric);
  }
  overview.append(metrics);
  page.append(overview);

  const byWeakest = [...records]
    .sort((a, b) => getRelationshipMastery(a) - getRelationshipMastery(b) || b.attempts - a.attempts);
  const byStrongest = [...records]
    .sort((a, b) => getRelationshipMastery(b) - getRelationshipMastery(a) || b.attempts - a.attempts);
  const byLeastPracticed = [...records]
    .sort((a, b) => a.attempts - b.attempts || getRelationshipMastery(a) - getRelationshipMastery(b));

  const rerender = () => renderProgress(container);
  page.append(relationshipPanel({
    id: 'weakest',
    title: 'Weakest relationships',
    records: byWeakest,
    emptyText: 'Answer some quiz questions to begin tracking relationship mastery.',
    rerender
  }));
  page.append(relationshipPanel({
    id: 'strongest',
    title: 'Strongest relationships',
    records: byStrongest,
    emptyText: 'No relationship statistics yet.',
    rerender
  }));
  page.append(relationshipPanel({
    id: 'least-practiced',
    title: 'Least practiced relationships',
    records: byLeastPracticed,
    emptyText: 'No practiced relationships yet. Unseen relationships are not ranked until they receive an attempt.',
    rerender
  }));

  container.replaceChildren(page);
}
