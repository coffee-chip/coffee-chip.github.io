import { state, getAverageScore } from '../state.js';
import { TYPES } from '../data/types.js';
import { createTypeBadge } from '../components/typeBadge.js';

function el(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text) node.textContent = options.text;
  return node;
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function mastery(record) {
  return record.attempts ? record.earnedScore / record.attempts : 0;
}

function relationshipRow(record) {
  const row = el('div', { className: 'relationship-row' });
  const pairing = el('div', { className: 'relationship-pair' });
  pairing.append(createTypeBadge(record.attackingType));
  pairing.append(el('span', { className: 'relationship-arrow', text: '→' }));
  pairing.append(createTypeBadge(record.defendingType));

  const summary = el('div', { className: 'relationship-summary' });
  summary.append(el('strong', { text: formatPercent(mastery(record)) }));
  summary.append(el('span', {
    className: 'muted',
    text: `${record.attempts} attempt${record.attempts === 1 ? '' : 's'} · ${record.misses} missed · ${record.falseSelections} false`
  }));

  row.append(pairing, summary);
  return row;
}

function relationshipPanel(title, records, emptyText) {
  const panel = el('section', { className: 'panel progress-panel' });
  panel.append(el('h3', { text: title }));
  if (!records.length) {
    panel.append(el('p', { className: 'muted', text: emptyText }));
    return panel;
  }
  const list = el('div', { className: 'relationship-list' });
  for (const record of records) list.append(relationshipRow(record));
  panel.append(list);
  return panel;
}

export function renderProgress(container) {
  const page = el('section', { className: 'page' });
  page.append(el('h2', { text: 'Progress' }));

  const records = Object.values(state.progress.relationshipStats ?? {})
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
    .sort((a, b) => mastery(a) - mastery(b) || b.attempts - a.attempts)
    .slice(0, 5);
  const byStrongest = [...records]
    .sort((a, b) => mastery(b) - mastery(a) || b.attempts - a.attempts)
    .slice(0, 5);
  const byLeastPracticed = [...records]
    .sort((a, b) => a.attempts - b.attempts || mastery(a) - mastery(b))
    .slice(0, 5);

  page.append(relationshipPanel(
    'Weakest relationships',
    byWeakest,
    'Answer some quiz questions to begin tracking relationship mastery.'
  ));
  page.append(relationshipPanel(
    'Strongest relationships',
    byStrongest,
    'No relationship statistics yet.'
  ));
  page.append(relationshipPanel(
    'Least practiced relationships',
    byLeastPracticed,
    'No practiced relationships yet. Unseen relationships are not ranked until they receive an attempt.'
  ));

  container.replaceChildren(page);
}
