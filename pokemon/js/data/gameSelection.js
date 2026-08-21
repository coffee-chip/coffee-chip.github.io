import { state, resetStudyPokemonLookup } from '../state.js';
import { saveSettings } from '../storage.js';
import { isGameVersionGroup } from './gameVersions.js';
import { clearGameDataCache } from './pokemonRepository.js';

export function setGameVersionGroup(versionGroup) {
  if (!isGameVersionGroup(versionGroup) || versionGroup === state.settings.gameVersionGroup) return false;
  state.settings.gameVersionGroup = versionGroup;
  const cacheSaved = clearGameDataCache();
  resetStudyPokemonLookup();
  const settingsSaved = saveSettings(state.settings);
  document.dispatchEvent(new CustomEvent('pokemon-game-data-cleared'));
  return cacheSaved && settingsSaved;
}
