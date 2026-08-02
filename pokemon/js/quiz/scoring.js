function intersection(left, right) {
  return left.filter(value => right.includes(value));
}

function difference(left, right) {
  return left.filter(value => !right.includes(value));
}

function buildRelationshipOutcomes(question, correctlySelected, missedAnswers, incorrectAnswers) {
  const answersByOutcome = {
    correct: correctlySelected,
    missed: missedAnswers,
    'false-selection': incorrectAnswers
  };
  const outcomes = [];
  for (const relationship of question.relationships ?? []) {
    for (const [outcome, answers] of Object.entries(answersByOutcome)) {
      if (!answers.includes(relationship.answer)) continue;
      if (relationship.allowedOutcomes && !relationship.allowedOutcomes.includes(outcome)) continue;
      outcomes.push({
        ...relationship,
        outcome,
        earnedScore: outcome === 'correct' ? 1 : 0
      });
    }
  }
  return outcomes;
}

export function scoreMultiSelect(question, submittedAnswers) {
  const correctAnswers = [...question.correctAnswers];
  const selectedAnswers = [...submittedAnswers];
  const correctlySelected = intersection(selectedAnswers, correctAnswers);
  const missedAnswers = difference(correctAnswers, selectedAnswers);
  const incorrectAnswers = difference(selectedAnswers, correctAnswers);
  const unionSize = new Set([...correctAnswers, ...selectedAnswers]).size;
  const score = unionSize === 0 ? 1 : correctlySelected.length / unionSize;

  return {
    score,
    correctlySelected,
    missedAnswers,
    incorrectAnswers,
    correctAnswers,
    selectedAnswers,
    relationshipOutcomes: buildRelationshipOutcomes(question, correctlySelected, missedAnswers, incorrectAnswers)
  };
}

export const SCORING_STRATEGIES = {
  'type-multi-select': scoreMultiSelect
};

export function scoreQuestion(question, submittedAnswers) {
  const strategy = SCORING_STRATEGIES[question.answerType];
  if (!strategy) throw new Error(`No scoring strategy for answer type: ${question.answerType}`);
  return strategy(question, submittedAnswers);
}
