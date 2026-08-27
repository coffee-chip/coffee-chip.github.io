import { state } from '../state.js';
import { getActiveTypes } from '../engine/effectiveness.js';
import { getNationalDexLimitForVersionGroup } from '../data/gameVersions.js';
import { getPokemonRecognitionRecordForVersionGroup } from '../data/pokemonRecognition.js';
import { PRACTICE_PRESETS } from '../quiz/modes.js';
import { createTypeBadge } from '../components/typeBadge.js';
import {
  createRelationship,
  getRelationshipMastery,
  parseDirectionalRelationshipKey
} from '../relationships.js';

const EXPANDED_LIMIT = 30;
const expandedSections = new Set();
const RECOGNITION_MODES = new Set(['pokemon-type-recognition']);

function el(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text) node.textContent = options.text;
  return node;
}

function formatPercent(value) { return `${Math.round(value * 100)}%`; }
function titleCase(value) { return value.split('-').map(part => part ? part[0].toUpperCase() + part.slice(1) : '').join(' '); }
function mastery(record) { return record.attempts ? record.earnedScore / record.attempts : 0; }
function average(stat) { return stat.questionCount ? stat.totalScore / stat.questionCount : 0; }

function sumQuizStats(modeIds) {
  return modeIds.reduce((total, modeId) => {
    const stat = state.progress.quizStats?.[modeId];
    if (!stat) return total;
    total.questionCount += stat.questionCount;
    total.totalScore += stat.totalScore;
    return total;
  }, { questionCount: 0, totalScore: 0 });
}

function quizStatRow(label, stat, className = '') {
  const row = el('div', { className: `quiz-stat-row ${className}`.trim() });
  row.append(el('span', { text: label }));
  row.append(el('strong', { text: String(stat.questionCount) }));
  row.append(el('strong', { text: stat.questionCount ? formatPercent(average(stat)) : '—' }));
  return row;
}

function quizStatsPanel() {
  const panel = el('section', { className: 'panel progress-overview' });
  panel.append(el('h3', { text: 'Quiz performance' }));
  const table = el('div', { className: 'quiz-stats-table' });
  const header = el('div', { className: 'quiz-stat-row quiz-stat-header' });
  header.append(el('span', { text: 'Category or preset' }), el('strong', { text: 'Questions' }), el('strong', { text: 'Average' }));
  table.append(header);

  const presetIds = Object.keys(PRACTICE_PRESETS);
  const recognitionIds = presetIds.filter(id => RECOGNITION_MODES.has(id));
  const matchupIds = presetIds.filter(id => !RECOGNITION_MODES.has(id));
  const recognitionTotal = sumQuizStats(recognitionIds);
  const matchupTotal = sumQuizStats(matchupIds);
  const overallTotal = sumQuizStats(presetIds);

  table.append(quizStatRow('Pokémon recognition', recognitionTotal, 'quiz-stat-category'));
  for (const modeId of recognitionIds) {
    const stat = state.progress.quizStats?.[modeId] ?? { questionCount: 0, totalScore: 0 };
    table.append(quizStatRow(PRACTICE_PRESETS[modeId].label, stat, 'quiz-stat-preset'));
  }
  table.append(quizStatRow('Type matchups', matchupTotal, 'quiz-stat-category'));
  for (const modeId of matchupIds) {
    const stat = state.progress.quizStats?.[modeId] ?? { questionCount: 0, totalScore: 0 };
    table.append(quizStatRow(PRACTICE_PRESETS[modeId].label, stat, 'quiz-stat-preset'));
  }
  table.append(quizStatRow('Overall', overallTotal, 'quiz-stat-overall'));
  panel.append(table);
  return panel;
}

function matchupRow(record, rank) {
  const relationship = parseDirectionalRelationshipKey(record.key);
  const row = el('div', { className: 'relationship-row' });
  row.append(el('span', { className: 'relationship-rank', text: `${rank}.` }));
  const content = el('div', { className: 'relationship-row-content' });
  const pairing = el('div', { className: 'relationship-pair' });
  pairing.append(createTypeBadge(relationship.attackingType), el('span', { className: 'relationship-arrow', text: '→' }), createTypeBadge(relationship.defendingType));
  const summary = el('div', { className: 'relationship-summary' });
  if (record.attempts > 0) {
    summary.append(el('strong', { text: formatPercent(getRelationshipMastery(record)) }));
    summary.append(el('span', { className: 'muted', text: `${record.attempts} attempt${record.attempts === 1 ? '' : 's'} · ${record.misses} missed · ${record.falseSelections} false` }));
  } else {
    summary.append(el('strong', { text: 'Not practiced' }), el('span', { className: 'muted', text: '0 attempts' }));
  }
  content.append(pairing, summary);
  row.append(content);
  return row;
}

function pokemonRow(record, rank) {
  const row = el('div', { className: 'relationship-row pokemon-recognition-row' });
  row.append(el('span', { className: 'relationship-rank', text: `${rank}.` }));
  const content = el('div', { className: 'relationship-row-content' });
  const name = record.pokemonName ? titleCase(record.pokemonName) : `Pokémon #${String(record.pokemonId).padStart(4, '0')}`;
  const heading = el('div', { className: 'pokemon-recognition-name' });
  heading.append(el('strong', { text: name }), el('span', { className: 'muted', text: `#${String(record.pokemonId).padStart(4, '0')}` }));
  const summary = el('div', { className: 'relationship-summary' });
  if (record.attempts > 0) {
    summary.append(el('strong', { text: formatPercent(mastery(record)) }));
    summary.append(el('span', { className: 'muted', text: `${record.attempts} attempt${record.attempts === 1 ? '' : 's'} · ${record.exactAnswers} exact · ${record.misses} missed · ${record.falseSelections} false` }));
  } else {
    summary.append(el('strong', { text: 'Not practiced' }), el('span', { className: 'muted', text: '0 attempts' }));
  }
  content.append(heading, summary);
  row.append(content);
  return row;
}

function createToggleButton({ expanded, recordsLength, onToggle }) {
  const toggle = el('button', { className: 'secondary-button progress-expand-button', text: expanded ? 'Collapse' : `Show rankings (${Math.min(recordsLength, EXPANDED_LIMIT)})` });
  toggle.type = 'button';
  toggle.setAttribute('aria-expanded', String(expanded));
  toggle.addEventListener('click', onToggle);
  return toggle;
}

function rankingPanel({ id, title, records, emptyText, itemLabel, rowRenderer, rerender }) {
  const panel = el('section', { className: 'panel progress-panel' });
  const expanded = expandedSections.has(id);
  const toggleSection = () => { expanded ? expandedSections.delete(id) : expandedSections.add(id); rerender(); };
  const heading = el('div', { className: 'progress-panel-heading' });
  heading.append(el('h3', { text: title }));
  if (records.length) heading.append(createToggleButton({ expanded, recordsLength: records.length, onToggle: toggleSection }));
  panel.append(heading);
  if (!records.length) { panel.append(el('p', { className: 'muted', text: emptyText })); return panel; }
  if (!expanded) return panel;
  const visibleRecords = records.slice(0, EXPANDED_LIMIT);
  const list = el('div', { className: 'relationship-list' });
  visibleRecords.forEach((record, index) => list.append(rowRenderer(record, index + 1)));
  panel.append(list, el('p', { className: 'muted progress-list-limit', text: `Showing the first ${visibleRecords.length} of ${records.length} ranked ${itemLabel}.` }));
  const bottomControls = el('div', { className: 'progress-panel-bottom-controls' });
  bottomControls.append(createToggleButton({ expanded: true, recordsLength: records.length, onToggle: toggleSection }));
  panel.append(bottomControls);
  return panel;
}

function getAllNonNeutralMatchupRecords() {
  const records = [];
  for (const attackingType of getActiveTypes()) for (const defendingType of getActiveTypes()) {
    const relationship = createRelationship(attackingType, defendingType);
    if (!relationship.key) continue;
    const saved = state.progress.relationshipStats?.[relationship.key];
    records.push(saved ? { ...saved, key: relationship.key } : {
      key: relationship.key, attackingType, defendingType, attempts: 0, earnedScore: 0,
      correctSelections: 0, misses: 0, falseSelections: 0, lastSeen: null
    });
  }
  return records;
}

function getRecognitionPoolSize() {
  return getNationalDexLimitForVersionGroup(state.settings.gameVersionGroup);
}

function getAllRecognitionRecords() {
  return Array.from({ length: getRecognitionPoolSize() }, (_, index) => {
    const pokemonId = index + 1;
    const saved = getPokemonRecognitionRecordForVersionGroup(
      state.progress.pokemonRecognitionStats,
      pokemonId,
      state.settings.gameVersionGroup
    );
    return saved ? { ...saved } : {
      pokemonId, pokemonName: null, attempts: 0, earnedScore: 0,
      exactAnswers: 0, correctSelections: 0, misses: 0, falseSelections: 0, lastSeen: null
    };
  });
}

export function renderProgress(container) {
  const page = el('section', { className: 'page' });
  const nonNeutralRecords = getAllNonNeutralMatchupRecords();
  const practicedNonNeutral = nonNeutralRecords.filter(record => record.attempts > 0);
  const recognitionRecords = getAllRecognitionRecords();
  const practicedPokemon = recognitionRecords.filter(record => record.attempts > 0);

  page.append(quizStatsPanel());

  const coverage = el('section', { className: 'panel progress-overview' });
  coverage.append(el('h3', { text: 'Practice coverage' }));
  const metrics = el('div', { className: 'progress-metrics' });
  for (const [label, value] of [
    ['Non-neutral matchups practiced', `${practicedNonNeutral.length} of ${nonNeutralRecords.length}`],
    ['Pokémon practiced', `${practicedPokemon.length} of ${getRecognitionPoolSize()}`]
  ]) {
    const metric = el('div', { className: 'progress-metric' });
    metric.append(el('strong', { text: String(value) }), el('span', { text: label }));
    metrics.append(metric);
  }
  coverage.append(metrics);
  page.append(coverage);

  const rerender = () => renderProgress(container);
  const matchupPanels = [
    ['weakest', 'Weakest matchups', [...practicedNonNeutral].sort((a,b) => getRelationshipMastery(a)-getRelationshipMastery(b) || b.attempts-a.attempts || a.key.localeCompare(b.key)), 'Answer some quiz questions to begin tracking matchup mastery.'],
    ['strongest', 'Strongest matchups', [...practicedNonNeutral].sort((a,b) => getRelationshipMastery(b)-getRelationshipMastery(a) || b.attempts-a.attempts || a.key.localeCompare(b.key)), 'No practiced non-neutral matchups yet.'],
    ['least-practiced', 'Least practiced matchups', [...nonNeutralRecords].sort((a,b) => a.attempts-b.attempts || getRelationshipMastery(a)-getRelationshipMastery(b) || a.key.localeCompare(b.key)), 'No non-neutral matchups are available to rank.']
  ];
  for (const [id,title,records,emptyText] of matchupPanels) page.append(rankingPanel({ id, title, records, emptyText, itemLabel: 'matchups', rowRenderer: matchupRow, rerender }));

  page.append(el('h2', { className: 'progress-section-title', text: 'Pokémon recognition' }));
  const pokemonPanels = [
    ['pokemon-weakest', 'Weakest Pokémon recognition', [...practicedPokemon].sort((a,b) => mastery(a)-mastery(b) || b.attempts-a.attempts || a.pokemonId-b.pokemonId), 'Answer Pokémon recognition questions to begin tracking recognition.'],
    ['pokemon-strongest', 'Strongest Pokémon recognition', [...practicedPokemon].sort((a,b) => mastery(b)-mastery(a) || b.attempts-a.attempts || a.pokemonId-b.pokemonId), 'No practiced Pokémon yet.'],
    ['pokemon-least-practiced', 'Least practiced Pokémon', [...recognitionRecords].sort((a,b) => a.attempts-b.attempts || mastery(a)-mastery(b) || a.pokemonId-b.pokemonId), 'No Pokémon are available to rank.']
  ];
  for (const [id,title,records,emptyText] of pokemonPanels) page.append(rankingPanel({ id, title, records, emptyText, itemLabel: 'Pokémon', rowRenderer: pokemonRow, rerender }));

  container.replaceChildren(page);
}
