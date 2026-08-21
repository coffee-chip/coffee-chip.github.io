import { state, resetStudyPokemonLookup } from '../state.js';
import { saveSettings } from '../storage.js';
import { isGameVersionGroup } from './gameVersions.js';
import { clearGameDataCache } from './pokemonRepository.js';
import { getTypesForVersionGroup } from './types.js';

export function setGameVersionGroup(versionGroup) {
  if (!isGameVersionGroup(versionGroup)) return false;
  if (versionGroup === state.settings.gameVersionGroup) return false;
  state.settings.gameVersionGroup = versionGroup;
  const activeTypes = getTypesForVersionGroup(versionGroup);
  if (!activeTypes.includes(state.study.primaryType)) state.study.primaryType = activeTypes[0];
  if (!activeTypes.includes(state.study.secondaryType)) state.study.secondaryType = null;
  const cacheSaved = clearGameDataCache();
  resetStudyPokemonLookup();
  state.quiz.status = 'idle';
  state.quiz.question = null;
  state.quiz.selectedAnswers = new Set();
  state.quiz.result = null;
  const settingsSaved = saveSettings(state.settings);
  document.dispatchEvent(new CustomEvent('pokemon-game-data-cleared'));
  return cacheSaved && settingsSaved;
}
