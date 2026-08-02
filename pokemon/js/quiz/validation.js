import { TYPES } from '../data/types.js';
import { LEARNING_OBJECTIVES } from './objectives.js';
import { INTERACTION_FORMATS } from './formats.js';
import { MOVE_CRITERIA, QUESTION_GENERATORS } from './generators.js';
import { PRACTICE_PRESETS } from './modes.js';

function result(name, passed, detail = '') {
  return { name, passed, detail };
}

function validateRelationships(question) {
  if (!Array.isArray(question.relationships)) return 'Missing relationships array';
  if (question.relationships.length !== question.choices.length) {
    return `${question.relationships.length} relationships for ${question.choices.length} choices`;
  }
  const answers = new Set();
  for (const relationship of question.relationships) {
    if (!relationship?.key || !relationship.attackingType || !relationship.defendingType || !relationship.answer) {
      return 'Relationship missing key, types, or answer';
    }
    if (relationship.key !== `${relationship.attackingType}>${relationship.defendingType}`) {
      return `Invalid key ${relationship.key}`;
    }
    if (!TYPES.includes(relationship.attackingType) || !TYPES.includes(relationship.defendingType)) {
      return `Unknown type in ${relationship.key}`;
    }
    if (answers.has(relationship.answer)) return `Duplicate answer mapping ${relationship.answer}`;
    answers.add(relationship.answer);
  }
  const unmapped = question.choices.filter(choice => !answers.has(choice));
  return unmapped.length ? `Unmapped choices: ${unmapped.join(', ')}` : '';
}

export function validateQuizArchitecture() {
  const results = [];

  for (const generator of Object.values(QUESTION_GENERATORS)) {
    results.push(result(
      `Generator ${generator.id} has a registered objective`,
      Boolean(LEARNING_OBJECTIVES[generator.objectiveId]),
      generator.objectiveId
    ));
    results.push(result(
      `Generator ${generator.id} has a registered format`,
      Boolean(INTERACTION_FORMATS[generator.formatId]),
      generator.formatId
    ));

    if (generator.config?.criterion) {
      results.push(result(
        `Generator ${generator.id} has a registered criterion`,
        Boolean(MOVE_CRITERIA[generator.config.criterion]),
        generator.config.criterion
      ));
    }

    try {
      const question = generator.createQuestion();
      const required = ['id', 'generatorId', 'objectiveId', 'formatId', 'prompt', 'answerType', 'choices', 'correctAnswers', 'relationships'];
      const missing = required.filter(key => question[key] === undefined);
      results.push(result(
        `Generator ${generator.id} produces a normalized question`,
        missing.length === 0,
        missing.length ? `Missing: ${missing.join(', ')}` : 'All required fields present'
      ));
      results.push(result(
        `Question format matches generator ${generator.id}`,
        question.formatId === generator.formatId && question.answerType === generator.formatId,
        `${question.formatId} / ${question.answerType}`
      ));
      results.push(result(
        `Question objective matches generator ${generator.id}`,
        question.objectiveId === generator.objectiveId,
        question.objectiveId
      ));
      const relationshipError = validateRelationships(question);
      results.push(result(
        `Question relationships are valid for ${generator.id}`,
        !relationshipError,
        relationshipError || `${question.relationships.length} ordered single-defender relationships`
      ));
      if (generator.config?.criterion) {
        results.push(result(
          `Question criterion matches generator ${generator.id}`,
          question.metadata?.criterion === generator.config.criterion,
          question.metadata?.criterion ?? 'Missing criterion metadata'
        ));
      }
    } catch (error) {
      results.push(result(`Generator ${generator.id} can create a question`, false, error.message));
    }
  }

  for (const preset of Object.values(PRACTICE_PRESETS)) {
    for (const objectiveId of preset.objectiveIds) {
      results.push(result(
        `Preset ${preset.id} references objective ${objectiveId}`,
        Boolean(LEARNING_OBJECTIVES[objectiveId]),
        objectiveId
      ));
    }
    for (const formatId of preset.formatIds) {
      results.push(result(
        `Preset ${preset.id} references format ${formatId}`,
        Boolean(INTERACTION_FORMATS[formatId]),
        formatId
      ));
    }
    for (const generatorId of preset.generatorIds) {
      const generator = QUESTION_GENERATORS[generatorId];
      const compatible = Boolean(generator)
        && preset.objectiveIds.includes(generator.objectiveId)
        && preset.formatIds.includes(generator.formatId);
      results.push(result(
        `Preset ${preset.id} accepts generator ${generatorId}`,
        compatible,
        generator ? `${generator.objectiveId} / ${generator.formatId}` : 'Generator missing'
      ));
    }
  }

  return results;
}
