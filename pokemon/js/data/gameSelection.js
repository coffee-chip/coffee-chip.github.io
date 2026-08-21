import { state, resetStudyPokemonLookup } from '../state.js';
import { saveSettings } from '../storage.js';
import { isGameVersionGroup } from './gameVersions.js';
import { clearGameDataCache } from './pokemonRepository.js';
import { fetchTypeChartForVersionGroup } from './typeChartRepository.js';

export async function setGameVersionGroup(versionGroup) {
  if (!isGameVersionGroup(versionGroup)) return { changed: false, error: new Error('Select a supported game.') };
  if (versionGroup === state.settings.gameVersionGroup) return { changed: false, error: null };
  let typeChart;
  try {
    typeChart = await fetchTypeChartForVersionGroup(versionGroup);
  } catch (error) {
    return { changed: false, error };
  }
  state.settings.gameVersionGroup = versionGroup;
  const activeTypes = typeChart.types;
  if (!activeTypes.includes(state.study.primaryType)) state.study.primaryType = activeTypes[0];
  if (!activeTypes.includes(state.study.secondaryType)) state.study.secondaryType = null;
  const cacheSaved = clearGameDataCache({ typeChart });
  resetStudyPokemonLookup();
  state.quiz.status = 'idle';
  state.quiz.question = null;
  state.quiz.selectedAnswers = new Set();
  state.quiz.result = null;
  const settingsSaved = saveSettings(state.settings);
  document.dispatchEvent(new CustomEvent('pokemon-game-data-cleared'));
  return { changed: true, error: cacheSaved && settingsSaved ? null : new Error('The selected game changed, but the new data could not be saved.') };
}
