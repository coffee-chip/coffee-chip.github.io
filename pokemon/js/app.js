import { startRouter } from './router.js';
import { state, hydratePersistentState } from './state.js';
import { loadPersistentData } from './storage.js';
import { VIEWS } from './views/index.js';
import { validateApplicationContracts } from './appValidation.js';
import { runEngineSelfTests } from './engine/effectiveness.js';
import { validateQuizArchitecture } from './quiz/validation.js';
import { validateTypeIcons } from './components/typeBadge.js';
import { initializePokemonAutocomplete } from './components/pokemonAutocomplete.js';
import { enhancePokemonLookupResult } from './components/pokemonMatchupEnhancer.js';
import { enhancePokemonEvolutionControls } from './components/pokemonEvolutionControls.js';
import { enhanceStudyTabs } from './components/studyTabs.js';
import { initializeQuizAutoScroll } from './components/quizAutoScroll.js';
import { getPokemonNameIndex } from './data/pokemonRepository.js';
import { applyTheme, watchSystemTheme } from './theme.js';
import { renderDeveloperOverlay } from './developerOverlay.js';
import { registerServiceWorker, subscribeServiceWorker, serviceWorkerState, applyWaitingUpdate } from './serviceWorker.js';

hydratePersistentState(loadPersistentData());
applyTheme(state.settings.paletteTheme, state.settings.appearance);
watchSystemTheme(() => ({ paletteTheme: state.settings.paletteTheme, appearance: state.settings.appearance }));
initializePokemonAutocomplete();
initializeQuizAutoScroll();

const viewRoot = document.querySelector('#app-view');
const navLinks = [...document.querySelectorAll('[data-route]')];

function renderUpdateBanner() {
  let banner = document.querySelector('.update-banner');
  if (serviceWorkerState.status !== 'update-ready') { banner?.remove(); return; }
  if (!banner) {
    banner = document.createElement('div');
    banner.className = 'update-banner';
    banner.setAttribute('role', 'status');
    const text = document.createElement('span');
    text.textContent = 'A new version is available.';
    const update = document.createElement('button');
    update.type = 'button';
    update.textContent = 'Update now';
    update.addEventListener('click', () => applyWaitingUpdate());
    const later = document.createElement('button');
    later.type = 'button';
    later.className = 'secondary-button';
    later.textContent = 'Later';
    later.addEventListener('click', () => banner.remove());
    banner.append(text, update, later);
    document.body.append(banner);
  }
}

function render() {
  const view = VIEWS[state.route] ?? VIEWS.quiz;
  view(viewRoot, render);
  enhanceStudyTabs(viewRoot);
  enhancePokemonEvolutionControls(viewRoot);
  enhancePokemonLookupResult(viewRoot);
  for (const link of navLinks) {
    if (link.dataset.route === state.route) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  renderUpdateBanner();
  renderDeveloperOverlay();
}

function warmPokemonNameIndex() {
  getPokemonNameIndex().then(result => {
    document.dispatchEvent(new CustomEvent('pokemon-name-index-ready', { detail: { names: result.names, source: result.source } }));
  }).catch(error => console.warn('Could not preload Pokémon autocomplete names.', error));
}

subscribeServiceWorker(() => { renderUpdateBanner(); renderDeveloperOverlay(); });
startRouter(route => { state.route = route; render(); });
registerServiceWorker({ autoUpdate: state.settings.developer.autoUpdateOnLaunch });
if ('requestIdleCallback' in window) window.requestIdleCallback(warmPokemonNameIndex, { timeout: 2000 });
else window.setTimeout(warmPokemonNameIndex, 0);

const contractResults = validateApplicationContracts();
console.group('Application contract checks'); console.table(contractResults); console.groupEnd();
const failedContracts = contractResults.filter(test => !test.passed);
if (failedContracts.length) {
  throw new Error(`Application contract validation failed: ${failedContracts.map(test => test.name).join('; ')}`);
}
const engineResults = runEngineSelfTests();
console.group('Type engine checks'); console.table(engineResults); console.groupEnd();
if (engineResults.some(test => !test.passed)) console.error('Type engine self-test failed.');
const architectureResults = validateQuizArchitecture();
console.group('Quiz architecture checks'); console.table(architectureResults); console.groupEnd();
if (architectureResults.some(test => !test.passed)) console.error('Quiz architecture validation failed.');
const iconResults = validateTypeIcons();
console.group('Type icon checks'); console.table(iconResults); console.groupEnd();
if (iconResults.some(test => !test.passed)) console.error('One or more type icons are missing.');
