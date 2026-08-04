import { state } from '../state.js';

function displayName(name) {
  return name.split('-').map(part => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ');
}

function submitLookup(name, root) {
  const form = root.querySelector('.pokemon-lookup-form');
  const input = form?.querySelector('input[type="search"]');
  if (!form || !input) return;
  input.value = name;
  state.study.pokemonQuery = name;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  form.requestSubmit();
}

function createChooser(direction, names, root, card) {
  root.querySelector('.pokemon-evolution-chooser')?.remove();
  const chooser = document.createElement('section');
  chooser.className = 'panel pokemon-evolution-chooser';
  chooser.setAttribute('aria-label', direction === 'previous' ? 'Previous evolutions' : 'Next evolutions');

  const heading = document.createElement('h3');
  heading.textContent = direction === 'previous' ? 'Evolves from' : 'Evolves to';
  chooser.append(heading);

  const actions = document.createElement('div');
  actions.className = 'pokemon-evolution-options';
  for (const name of names) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary-button';
    button.textContent = displayName(name);
    button.addEventListener('click', () => submitLookup(name, root));
    actions.append(button);
  }

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'secondary-button pokemon-evolution-close';
  close.textContent = 'Close';
  close.addEventListener('click', () => chooser.remove());
  chooser.append(actions, close);
  card.after(chooser);
}

function createDirectionButton(direction, names, root, card) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `pokemon-evolution-button pokemon-evolution-${direction}`;
  button.setAttribute('aria-label', direction === 'previous' ? 'Show previous evolutions' : 'Show next evolutions');
  button.textContent = direction === 'previous' ? '‹ Previous' : 'Next ›';
  button.addEventListener('click', () => createChooser(direction, names, root, card));
  return button;
}

export function enhancePokemonEvolutionControls(root) {
  if (state.route !== 'study' || state.study.mode !== 'pokemon') return;
  const pokemon = state.study.pokemonResult;
  const card = root.querySelector('.pokemon-result-card');
  const visual = card?.querySelector('.pokemon-result-visual');
  if (!pokemon || !card || !visual || visual.querySelector('.pokemon-evolution-controls')) return;

  const previous = pokemon.evolution?.previous ?? [];
  const next = pokemon.evolution?.next ?? [];
  if (!previous.length && !next.length) return;

  const controls = document.createElement('div');
  controls.className = 'pokemon-evolution-controls';
  if (previous.length) controls.append(createDirectionButton('previous', previous, root, card));
  if (next.length) controls.append(createDirectionButton('next', next, root, card));
  visual.append(controls);
}
