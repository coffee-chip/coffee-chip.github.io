export const LEARNING_OBJECTIVES = {
  'choose-move': {
    id: 'choose-move',
    label: 'Choose a move',
    description: 'Given an opposing Pokémon type, recall which move types are effective against it.',
    priority: 1
  },
  'choose-switch': {
    id: 'choose-switch',
    label: 'Choose a switch-in',
    description: 'Given an opposing attack type, recall which Pokémon types are safe or unsafe to use.',
    priority: 2
  },
  'recognize-pokemon-type': {
    id: 'recognize-pokemon-type',
    label: 'Recognize Pokémon types',
    description: 'Recall a Pokémon species’ type or types without looking them up.',
    priority: 3
  },
  'battle-scenario': {
    id: 'battle-scenario',
    label: 'Battle scenario',
    description: 'Use combined offensive and defensive type advantage to choose favorable types or Pokémon against an opponent.',
    priority: 4
  }
};

export function getLearningObjective(objectiveId) {
  const objective = LEARNING_OBJECTIVES[objectiveId];
  if (!objective) throw new Error(`Unknown learning objective: ${objectiveId}`);
  return objective;
}
