import { state, getAverageScore } from '../state.js';
import { TYPES } from '../data/types.js';
import { createTypeBadge } from '../components/typeBadge.js';
import {
  createRelationship,
  getRelationshipMastery,
  getRelationshipMultiplier,
  parseRelationshipKey
} from '../relationships.js';

const EXPANDED_LIMIT = 50;
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

function relationshipRow(record, rank) {
  const relationship = parseRelationshipKey(record.key);
  const row = el('div', { className: 'relationship-row' });
  row.append(el('span', { className: 'relationship-rank', text: `${rank}.` }));

  const content = el('div', { className: 'relationship-row-content' });
  const pairing = el('div', { className: 'relationship-pair' });
  pairing.append(createTypeBadge(relationship.attackingType));
  pairing.append(el('span', { className: 'relationship-arrow', text: '→' }));
  pairing.append(createTypeBadge(relationship.defendingType));

  const summary = el('div', { className: 'relationship-summary' });
  if (record.attempts > 0) {
    summary.append(el('strong', { text: formatPercent(getRelationshipMastery(record)) }));
    summary.append(el('span', {
      className: 'muted',
      text: `${record.attempts} attempt${record.attempts === 1 ? '' : 's'} · ${record.misses} missed · ${record.falseSelections} false`
    }));
  } else {
    summary.append(el('strong', { text: 'Not practiced' }));
    summary.append(el('span', { className: 'muted', text: '0 attempts' }));
  }

  content.append(pairing, summary);
  row.append(content);
  return row;
}

function relationshipPanel({ id, title, records, emptyText, rerender }) {
  const panel = el('section', { className: 'panel progress-panel' });
  const expanded = expandedSections.has(id);

  const heading = el('div', { className: 'progress-panel-heading' });
  heading.append(el('h3', { text: title }));
  if (records.length) {
    const toggle = el('button', {
      className: 'progress-expand-button',
      text: expanded ? 'Collapse' : `Show rankings (${Math.min(records.length, EXPANDED_LIMIT)})`
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

  if (!expanded) return panel;

  const visibleRecords = records.slice(0, EXPANDED_LIMIT);
  const list = el('div', { className: 'relationship-list' });
  visibleRecords.forEach((record, index) => list.append(relationshipRow(record, index + 1)));
  panel.append(list);

  if (records.length > EXPANDED_LIMIT) {
    panel.append(el('p', {
      className: 'muted progress-list-limit',
      text: `Showing the first ${EXPANDED_LIMIT} of ${records.length} ranked relationships.`
    }));
  }

  return panel;
}

function getAllNonNeutralRelationshipRecords() {
  const records = [];
  for (const attackingType of TYPES) {
    for (const defendingType of TYPES) {
      const relationship = createRelationship(attackingType, defendingType);
      if (getRelationshipMultiplier(relationship) === 1) continue;
      const saved = state.progress.relationshipStats?.[relationship.key];
      records.push(saved
        ? { ...saved, key: relationship.key }
        : {
            key: relationship.key,
            attackingType,
            defendingType,
            attempts: 0,
            earnedScore: 0,
            correctSelections: 0,
            misses: 0,
            falseSelections: 0,
            lastSeen: null
          });
    }
  }
  return records;
}

export function renderProgress(container) {
  const page = el('section', { className: 'page' });
  page.append(el('h2', { text: 'Progress' }));

  const practicedRecords = Object.entries(state.progress.relationshipStats ?? {})
    .map(([key, record]) => ({ ...record, key }))
    .filter(record => record.attempts > 0);
  const nonNeutralRecords = getAllNonNeutralRelationshipRecords();
  const practicedNonNeutral = nonNeutralRecords.filter(record => record.attempts > 0);

  const overview = el('section', { className: 'panel progress-overview' });
  overview.append(el('h3', { text: 'Overall' }));
  const metrics = el('div', { className: 'progress-metrics' });
  for (const [label, value] of [
    ['Questions', state.progress.totalAnswered],
    ['Average score', formatPercent(getAverageScore())],
    ['Relationships practiced', `${practicedRecords.length} of ${TYPES.length * TYPES.length}`]
  ]) {
    const metric = el('div', { className: 'progress-metric' });
    metric.append(el('strong', { text: String(value) }), el('span', { text: label }));
    metrics.append(metric);
  }
  overview.append(metrics);
  overview.append(el('p', {
    className: 'muted progress-ranking-note',
    text: 'Rankings currently cover non-neutral relationships. Neutral relationships remain in the underlying data but are not ranked because current quizzes do not score them symmetrically.'
  }));
  page.append(overview);

  const byWeakest = [...practicedNonNeutral]
    .sort((a, b) =>
      getRelationshipMastery(a) - getRelationshipMastery(b)
      || b.attempts - a.attempts
      || a.key.localeCompare(b.key)
    );
  const byStrongest = [...practicedNonNeutral]
    .sort((a, b) =>
      getRelationshipMastery(b) - getRelationshipMastery(a)
      || b.attempts - a.attempts
      || a.key.localeCompare(b.key)
    );
  const byLeastPracticed = [...nonNeutralRecords]
    .sort((a, b) =>
      a.attempts - b.attempts
      || getRelationshipMastery(a) - getRelationshipMastery(b)
      || a.key.localeCompare(b.key)
    );

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
    emptyText: 'No practiced non-neutral relationships yet.',
    rerender
  }));
  page.append(relationshipPanel({
    id: 'least-practiced',
    title: 'Least practiced relationships',
    records: byLeastPracticed,
    emptyText: 'No non-neutral relationships are available to rank.',
    rerender
  }));

  container.replaceChildren(page);
}
