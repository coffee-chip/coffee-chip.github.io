import { fetchType } from '../api/pokeApi.js';
import { state } from '../state.js';
import { saveCache } from '../storage.js';
import { getGameVersionGroup, isGameVersionGroup } from './gameVersions.js';
import { TYPES } from './types.js';

const TYPE_FETCH_CONCURRENCY = 6;
const NON_NEUTRAL_MULTIPLIERS = new Set([0, 0.5, 2]);

function generationNumber(name) {
  const match = typeof name === 'string' && name.match(/^generation-(i|ii|iii|iv|v|vi|vii|viii|ix)$/);
  return match ? ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix'].indexOf(match[1]) + 1 : null;
}

function isTypeList(value) {
  return Array.isArray(value) && value.length > 0
    && new Set(value).size === value.length
    && value.every(type => TYPES.includes(type));
}

function isOffensiveChart(chart, types) {
  if (!chart || typeof chart !== 'object' || Array.isArray(chart)) return false;
  if (!types.every(type => chart[type] && typeof chart[type] === 'object' && !Array.isArray(chart[type]))) return false;
  return types.every(attackingType => Object.entries(chart[attackingType]).every(([defendingType, multiplier]) =>
    types.includes(defendingType) && NON_NEUTRAL_MULTIPLIERS.has(multiplier)
  ));
}

export function isValidTypeChart(chart, versionGroup = chart?.versionGroup) {
  return chart && isGameVersionGroup(versionGroup) && chart.versionGroup === versionGroup
    && Number.isInteger(chart.generationNumber)
    && chart.generationNumber === getGameVersionGroup(versionGroup).generationNumber
    && isTypeList(chart.types)
    && isOffensiveChart(chart.offensiveChart, chart.types)
    && Number.isFinite(Date.parse(chart.fetchedAt));
}

export function getCachedTypeChart(versionGroup = state.settings.gameVersionGroup) {
  return isValidTypeChart(state.cache.typeChart, versionGroup) ? state.cache.typeChart : null;
}

export function getSelectedTypeChart() {
  const chart = getCachedTypeChart();
  if (!chart) throw new Error('Type relationships for the selected game have not loaded.');
  return chart;
}

function relationsForGeneration(rawType, targetGeneration) {
  const historical = [...(rawType.past_damage_relations ?? [])]
    .map(entry => ({ throughGeneration: generationNumber(entry.generation?.name), relations: entry.damage_relations }))
    .filter(entry => Number.isInteger(entry.throughGeneration) && entry.relations)
    .sort((first, second) => first.throughGeneration - second.throughGeneration)
    .find(entry => entry.throughGeneration >= targetGeneration);
  return historical?.relations ?? rawType.damage_relations;
}

function normalizeOffensiveRelations(relations, activeTypes) {
  const chart = {};
  const apply = (entries, multiplier) => {
    for (const entry of entries ?? []) {
      const type = entry?.name;
      if (activeTypes.includes(type)) chart[type] = multiplier;
    }
  };
  apply(relations?.double_damage_to, 2);
  apply(relations?.half_damage_to, 0.5);
  apply(relations?.no_damage_to, 0);
  return chart;
}

function normalizeTypeChart(rawTypes, versionGroup) {
  const game = getGameVersionGroup(versionGroup);
  const activeRecords = rawTypes.filter(rawType => {
    const introducedIn = generationNumber(rawType.generation?.name);
    return TYPES.includes(rawType.name) && Number.isInteger(introducedIn) && introducedIn <= game.generationNumber;
  });
  const types = activeRecords.map(rawType => rawType.name).filter((type, index, all) => all.indexOf(type) === index);
  if (!types.length) throw new Error('PokéAPI returned no valid types for the selected game.');
  const offensiveChart = Object.fromEntries(activeRecords.map(rawType => [
    rawType.name,
    normalizeOffensiveRelations(relationsForGeneration(rawType, game.generationNumber), types)
  ]));
  const chart = {
    versionGroup,
    generationNumber: game.generationNumber,
    types,
    offensiveChart,
    fetchedAt: new Date().toISOString()
  };
  if (!isValidTypeChart(chart, versionGroup)) throw new Error('PokéAPI returned an invalid type relationship chart.');
  return chart;
}

async function fetchTypeRecords() {
  const records = new Array(TYPES.length);
  let nextIndex = 0;
  async function loadNext() {
    while (nextIndex < TYPES.length) {
      const index = nextIndex;
      nextIndex += 1;
      records[index] = await fetchType(TYPES[index]);
    }
  }
  await Promise.all(Array.from({ length: TYPE_FETCH_CONCURRENCY }, loadNext));
  return records;
}

export async function fetchTypeChartForVersionGroup(versionGroup) {
  if (!isGameVersionGroup(versionGroup)) throw new Error('Select a supported game.');
  return normalizeTypeChart(await fetchTypeRecords(), versionGroup);
}

export async function ensureSelectedTypeChart() {
  const cached = getCachedTypeChart();
  if (cached) return { chart: cached, source: 'cache' };
  const chart = await fetchTypeChartForVersionGroup(state.settings.gameVersionGroup);
  state.cache.typeChart = chart;
  saveCache(state.cache);
  return { chart, source: 'network' };
}
