import { state, getAverageScore } from '../state.js';
import { TYPES } from '../data/types.js';
import { createTypeBadge } from '../components/typeBadge.js';
import {
  createRelationship,
  getRelationshipMastery,
  getRelationshipMultiplier,
  parseRelationshipKey
} from '../relationships.js';

const EXPANDED_LIMIT = 30;
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

function matchupRow(record, rank) {
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

function createToggleButton({ expanded, recordsLength, onToggle }) {
  const toggle = el('button', {
    className: 'progress-expand-button',
    text: expanded ? 'Collapse' : `Show rankings (${Math.min(recordsLength, EXPANDED_LIMIT)})`
  });
  toggle.type = 'button';
  toggle.setAttribute('aria-expanded', String(expanded));
  toggle.addEventListener('click', onToggle);
  return toggle;
}

function matchupPanel({ id, title, records, emptyText, rerender }) {
  const panel = el('section', { className: 'panel progress-panel' });
  const expanded = expandedSections.has(id);
  const toggleSection = () => {
    if (expanded) expandedSections.delete(id);
    else expandedSections.add(id);
    rerender();
  };

  const heading = el('div', { className: 'progress-panel-heading' });
  heading.append(el('h3', { text: title }));
  if (records.length) {
    heading.append(createToggleButton({
      expanded,
      recordsLength: records.length,
      onToggle: toggleSection
    }));
  }
  panel.append(heading);

  if (!records.length) {
    panel.append(el('p', { className: 'muted', text: emptyText }));
    return panel;
  }

  if (!expanded) return panel;

  const visibleRecords = records.slice(0, EXPANDED_LIMIT);
  const list = el('div', { className: 'relationship-list' });
  visibleRecords.forEach((record, index) => list.append(matchupRow(record, index + 1)));
  panel.append(list);

  panel.append(el('p', {
    className: 'muted progress-list-limit',
    text: `Showing the first ${visibleRecords.length} of ${records.length} ranked matchups.`
  }));

  const bottomControls = el('div', { className: 'progress-panel-bottom-controls' });
  bottomControls.append(createToggleButton({
    expanded: true,
    recordsLength: records.length,
    onToggle: toggleSection
  }));
  panel.append(bottomControls);

  return panel;
}

function getAllNonNeutralMatchupRecords() {
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

  const nonNeutralRecords = getAllNonNeutralMatchupRecords();
  const practicedNonNeutral = nonNeutralRecords.filter(record => record.attempts > 0);

  const overview = el('section', { className: 'panel progress-overview' });
  overview.append(el('h3', { text: 'Overall' }));
  const metrics = el('div', { className: 'progress-metrics' });
  for (const [label, value] of [
    ['Questions', state.progress.totalAnswered],
    ['Average score', formatPercent(getAverageScore())],
    ['Non-neutral matchups practiced', `${practicedNonNeutral.length} of ${nonNeutralRecords.length}`]
  ]) {
    const metric = el('div', { className: 'progress-metric' });
    metric.append(el('strong', { text: String(value) }), el('span', { text: label }));
    metrics.append(metric);
  }
  overview.append(metrics);
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
  page.append(matchupPanel({
    id: 'weakest',
    title: 'Weakest matchups',
    records: byWeakest,
    emptyText: 'Answer some quiz questions to begin tracking matchup mastery.',
    rerender
  }));
  page.append(matchupPanel({
    id: 'strongest',
    title: 'Strongest matchups',
    records: byStrongest,
    emptyText: 'No practiced non-neutral matchups yet.',
    rerender
  }));
  page.append(matchupPanel({
    id: 'least-practiced',
    title: 'Least practiced matchups',
    records: byLeastPracticed,
    emptyText: 'No non-neutral matchups are available to rank.',
    rerender
  }));

  container.replaceChildren(page);
}
