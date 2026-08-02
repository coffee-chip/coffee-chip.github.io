import { startRouter } from './router.js';
import { state, hydratePersistentState } from './state.js';
import { loadPersistentData } from './storage.js';
import { VIEWS } from './views/index.js';
import { runEngineSelfTests } from './engine/effectiveness.js';
import { validateQuizArchitecture } from './quiz/validation.js';
import { validateTypeIcons } from './components/typeBadge.js';
import { applyTheme, watchSystemTheme } from './theme.js';

hydratePersistentState(loadPersistentData());
applyTheme(state.settings.theme);
watchSystemTheme(() => state.settings.theme);

const viewRoot = document.querySelector('#app-view');
const navLinks = [...document.querySelectorAll('[data-route]')];

function render() {
  const view = VIEWS[state.route] ?? VIEWS.quiz;
  view(viewRoot, render);
  for (const link of navLinks) {
    const isCurrent = link.dataset.route === state.route;
    link.toggleAttribute('aria-current', isCurrent);
  }
}

startRouter(route => {
  state.route = route;
  render();
});

const engineResults = runEngineSelfTests();
console.group('Type engine checks');
console.table(engineResults);
console.groupEnd();
if (engineResults.some(test => !test.passed)) console.error('Type engine self-test failed.');

const architectureResults = validateQuizArchitecture();
console.group('Quiz architecture checks');
console.table(architectureResults);
console.groupEnd();
if (architectureResults.some(test => !test.passed)) console.error('Quiz architecture validation failed.');

const iconResults = validateTypeIcons();
console.group('Type icon checks');
console.table(iconResults);
console.groupEnd();
if (iconResults.some(test => !test.passed)) console.error('One or more type icons are missing.');
