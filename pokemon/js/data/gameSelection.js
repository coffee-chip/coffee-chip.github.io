import { state, resetStudyPokemonLookup } from '../state.js';
import { saveSettings } from '../storage.js';
import { isGameVersionGroup } from './gameVersions.js';
import { switchGameDataContext } from './pokemonRepository.js';
import { getTypesForVersionGroup } from './types.js';

export async function setGameVersionGroup(versionGroup) {
  if (!isGameVersionGroup(versionGroup)) return false;
  if (versionGroup === state.settings.gameVersionGroup) return false;
  state.settings.gameVersionGroup = versionGroup;
  const activeTypes = getTypesForVersionGroup(versionGroup);
  if (!activeTypes.includes(state.study.primaryType)) state.study.primaryType = activeTypes[0];
  if (!activeTypes.includes(state.study.secondaryType)) state.study.secondaryType = null;
  resetStudyPokemonLookup();
  state.quiz.status = 'idle';
  state.quiz.question = null;
  state.quiz.selectedAnswers = new Set();
  state.quiz.result = null;
  void saveSettings(state.settings);
  // Canonical API records can contain data for several version groups. Keep them
  // across game changes and invalidate only active requests/materialized views.
  switchGameDataContext();
  return true;
}
