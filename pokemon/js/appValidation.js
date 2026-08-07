import { VIEWS } from './views/index.js';
import { PRACTICE_PRESETS } from './quiz/modes.js';
import { QUESTION_GENERATORS } from './quiz/generators.js';

const REQUIRED_ROUTES = ['quiz', 'study', 'teams', 'team', 'progress', 'settings', 'debug'];

function result(name, passed, detail = '') {
  return { name, passed, detail };
}

export function validateApplicationContracts() {
  const results = [];

  for (const route of REQUIRED_ROUTES) {
    results.push(result(
      `Route ${route} has a renderer`,
      typeof VIEWS[route] === 'function',
      typeof VIEWS[route]
    ));
  }

  for (const [presetId, preset] of Object.entries(PRACTICE_PRESETS)) {
    results.push(result(
      `Preset ${presetId} has a stable id`,
      preset?.id === presetId,
      preset?.id ?? 'Missing id'
    ));
    results.push(result(
      `Preset ${presetId} has a label`,
      typeof preset?.label === 'string' && preset.label.length > 0,
      preset?.label ?? 'Missing label'
    ));
    results.push(result(
      `Preset ${presetId} references generators`,
      Array.isArray(preset?.generatorIds) && preset.generatorIds.length > 0,
      Array.isArray(preset?.generatorIds) ? preset.generatorIds.join(', ') : 'Missing generatorIds'
    ));
  }

  for (const [generatorId, generator] of Object.entries(QUESTION_GENERATORS)) {
    results.push(result(
      `Generator ${generatorId} has a stable id`,
      generator?.id === generatorId,
      generator?.id ?? 'Missing id'
    ));
    results.push(result(
      `Generator ${generatorId} can create questions`,
      typeof generator?.createQuestion === 'function',
      typeof generator?.createQuestion
    ));
  }

  return results;
}
