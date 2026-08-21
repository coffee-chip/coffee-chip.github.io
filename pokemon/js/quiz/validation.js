import { LEARNING_OBJECTIVES } from './objectives.js';
import { INTERACTION_FORMATS } from './formats.js';
import { MOVE_CRITERIA, SWITCH_CRITERIA, QUESTION_GENERATORS } from './generators.js';
import { BATTLE_SCENARIO_GENERATORS } from './battleScenarioQuestions.js';
import { PRACTICE_PRESETS } from './modes.js';
import { parseDirectionalRelationshipKey } from '../relationships.js';

function result(name, passed, detail = '') { return { name, passed, detail }; }

function validateRelationships(question) {
  if (!Array.isArray(question.relationships)) return 'Missing relationships array';
  for (const relationship of question.relationships) {
    if (!relationship?.key || !relationship?.genericKey || !relationship.attackingType || !relationship.defendingType || !relationship.answer) return 'Relationship missing key, generic key, types, or answer';
    try {
      const parsed = parseDirectionalRelationshipKey(relationship.key);
      if (parsed.genericKey !== relationship.genericKey || parsed.attackingType !== relationship.attackingType || parsed.defendingType !== relationship.defendingType || parsed.direction !== relationship.direction) return `Relationship fields do not match key ${relationship.key}`;
    } catch (error) { return error.message; }
    if (!question.choices.includes(relationship.answer)) return `Relationship answer is not a choice: ${relationship.answer}`;
    if (relationship.allowedOutcomes && relationship.allowedOutcomes.some(value => !['correct', 'missed', 'false-selection'].includes(value))) return `Invalid allowed outcome for ${relationship.key}`;
  }
  return '';
}

function criterionRegistryFor(generator) {
  return generator.objectiveId === 'choose-switch' ? SWITCH_CRITERIA : MOVE_CRITERIA;
}

export function validateQuizArchitecture() {
  const results = [];
  const allGenerators = { ...QUESTION_GENERATORS, ...BATTLE_SCENARIO_GENERATORS };
  for (const generator of Object.values(allGenerators)) {
    results.push(result(`Generator ${generator.id} has a registered objective`, Boolean(LEARNING_OBJECTIVES[generator.objectiveId]), generator.objectiveId));
    results.push(result(`Generator ${generator.id} has a registered format`, Boolean(INTERACTION_FORMATS[generator.formatId]), generator.formatId));
    if (generator.config?.criterion) {
      const criteria = criterionRegistryFor(generator);
      results.push(result(`Generator ${generator.id} has a registered criterion`, Boolean(criteria[generator.config.criterion]), generator.config.criterion));
    }
    if (generator.async) {
      results.push(result(`Generator ${generator.id} declares asynchronous generation`, true, 'Runtime validation deferred to quiz loading'));
      continue;
    }
    try {
      const question = generator.createQuestion();
      const required = ['id', 'generatorId', 'objectiveId', 'formatId', 'prompt', 'answerType', 'choices', 'correctAnswers', 'relationships'];
      const missing = required.filter(key => question[key] === undefined);
      results.push(result(`Generator ${generator.id} produces a normalized question`, missing.length === 0, missing.length ? `Missing: ${missing.join(', ')}` : 'All required fields present'));
      results.push(result(`Question format matches generator ${generator.id}`, question.formatId === generator.formatId && question.answerType === generator.formatId, `${question.formatId} / ${question.answerType}`));
      results.push(result(`Question objective matches generator ${generator.id}`, question.objectiveId === generator.objectiveId, question.objectiveId));
      const relationshipError = validateRelationships(question);
      results.push(result(`Question relationships are valid for ${generator.id}`, !relationshipError, relationshipError || `${question.relationships.length} component relationships`));
      if (generator.config?.criterion) results.push(result(`Question criterion matches generator ${generator.id}`, question.metadata?.criterion === generator.config.criterion, question.metadata?.criterion ?? 'Missing criterion metadata'));
      const dualQuestion = generator.createQuestion({ defenderCount: 2, attackerCount: 2 });
      const dualError = validateRelationships(dualQuestion);
      results.push(result(`Generator ${generator.id} supports dual-type generation`, !dualError, dualError || `${dualQuestion.relationships.length} component relationships`));
    } catch (error) {
      results.push(result(`Generator ${generator.id} can create a question`, false, error.message));
    }
  }
  for (const preset of Object.values(PRACTICE_PRESETS)) {
    for (const objectiveId of preset.objectiveIds) results.push(result(`Preset ${preset.id} references objective ${objectiveId}`, Boolean(LEARNING_OBJECTIVES[objectiveId]), objectiveId));
    for (const formatId of preset.formatIds) results.push(result(`Preset ${preset.id} references format ${formatId}`, Boolean(INTERACTION_FORMATS[formatId]), formatId));
    for (const generatorId of preset.generatorIds) {
      const generator = allGenerators[generatorId];
      const compatible = Boolean(generator) && preset.objectiveIds.includes(generator.objectiveId) && preset.formatIds.includes(generator.formatId);
      results.push(result(`Preset ${preset.id} accepts generator ${generatorId}`, compatible, generator ? `${generator.objectiveId} / ${generator.formatId}` : 'Generator missing'));
    }
  }
  return results;
}
