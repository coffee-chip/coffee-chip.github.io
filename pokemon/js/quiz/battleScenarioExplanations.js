import { getMultiplier } from '../engine/effectiveness.js';

function titleCase(type) {
  return type[0].toUpperCase() + type.slice(1);
}

function formatList(values) {
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`;
}

function possessive(name) {
  return name.endsWith('s') ? `${name}'` : `${name}'s`;
}

function sentenceCase(text) {
  return text[0].toUpperCase() + text.slice(1);
}

function describeAttackGroup(attacker, defender, multiplier, types) {
  const attackTypes = formatList(types.map(titleCase));
  const subject = sentenceCase(`${possessive(attacker.displayName)} ${attackTypes} attacks`);
  if (multiplier === 0) return `${subject} have no effect on ${defender.displayName}.`;
  return `${subject} deal ${multiplier}× damage to ${defender.displayName}.`;
}

/**
 * Describes only meaningful attack relationships between two Pokémon. Neutral
 * attacks are intentionally omitted so the explanation stays focused on the
 * matchup facts that explain the scenario result.
 */
export function describeNonNeutralMatchup(attacker, defender) {
  const typesByMultiplier = new Map();
  for (const type of attacker.types) {
    const multiplier = getMultiplier(type, defender.types);
    if (multiplier === 1) continue;
    const group = typesByMultiplier.get(multiplier) ?? [];
    group.push(type);
    typesByMultiplier.set(multiplier, group);
  }
  return [...typesByMultiplier.entries()]
    .sort(([left], [right]) => right - left)
    .map(([multiplier, types]) => describeAttackGroup(attacker, defender, multiplier, types));
}

function describePokemonChoice(choice, promptPokemon) {
  const sentences = [
    ...describeNonNeutralMatchup(choice, promptPokemon),
    ...describeNonNeutralMatchup(promptPokemon, choice)
  ];
  return sentences.length
    ? sentences.join(' ')
    : `${choice.displayName} and ${promptPokemon.displayName} have no non-neutral type interactions.`;
}

function virtualTypePokemon(type) {
  return { displayName: `a ${titleCase(type)}-type Pokémon`, types: [type] };
}

function buildPokemonChoiceExplanation(question, result) {
  const promptPokemon = question.display?.pokemon;
  const correctId = result.correctAnswers[0];
  const selectedId = result.selectedAnswers[0];
  const correctPokemon = question.choicePokemon?.[correctId];
  if (!promptPokemon || !correctPokemon) return [];

  const lines = [{
    label: `${correctPokemon.displayName} is the best option`,
    text: describePokemonChoice(correctPokemon, promptPokemon)
  }];
  const selectedPokemon = question.choicePokemon?.[selectedId];
  if (selectedPokemon && selectedPokemon.id !== correctPokemon.id) {
    lines.push({
      label: `Your choice: ${selectedPokemon.displayName}`,
      text: describePokemonChoice(selectedPokemon, promptPokemon)
    });
  }
  return lines;
}

function buildTypeChoiceExplanation(question, result) {
  const promptPokemon = question.display?.pokemon;
  if (!promptPokemon) return [];
  const correctTypes = result.correctAnswers;
  const incorrectTypes = result.incorrectAnswers;
  const describeTypes = types => types.flatMap(type => {
    const candidate = virtualTypePokemon(type);
    const sentences = [
      ...describeNonNeutralMatchup(candidate, promptPokemon),
      ...describeNonNeutralMatchup(promptPokemon, candidate)
    ];
    return sentences.length
      ? sentences
      : [`A ${titleCase(type)}-type Pokémon and ${promptPokemon.displayName} have no non-neutral type interactions.`];
  });
  const lines = [];
  const correctSentences = describeTypes(correctTypes);
  if (correctSentences.length) lines.push({ label: 'The advantageous types', text: correctSentences.join(' ') });
  const incorrectSentences = describeTypes(incorrectTypes);
  if (incorrectSentences.length) lines.push({ label: 'Your other selections', text: incorrectSentences.join(' ') });
  return lines;
}

export function getBattleScenarioExplanation(question, result) {
  if (question.objectiveId !== 'battle-scenario') return [];
  if (question.metadata?.battleDecision === 'choose-pokemon-by-advantage') {
    return buildPokemonChoiceExplanation(question, result);
  }
  if (question.metadata?.battleDecision === 'choose-type-by-advantage') {
    return buildTypeChoiceExplanation(question, result);
  }
  return [];
}
