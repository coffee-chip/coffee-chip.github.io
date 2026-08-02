export const INTERACTION_FORMATS = {
  'type-multi-select': {
    id: 'type-multi-select',
    label: 'Select all',
    selection: 'multiple',
    answerDomain: 'pokemon-types',
    scoringStrategy: 'set-overlap'
  },
  'single-select': {
    id: 'single-select',
    label: 'Multiple choice',
    selection: 'single',
    answerDomain: 'generic',
    scoringStrategy: 'exact-match'
  },
  'flash-card': {
    id: 'flash-card',
    label: 'Flash card',
    selection: 'self-check',
    answerDomain: 'generic',
    scoringStrategy: 'self-assessed'
  }
};

export function getInteractionFormat(formatId) {
  const format = INTERACTION_FORMATS[formatId];
  if (!format) throw new Error(`Unknown interaction format: ${formatId}`);
  return format;
}
