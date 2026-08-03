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

function createChooser(direction, names, root, anchor) {
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
  anchor.after(chooser);
}

function createDirectionButton(direction, names, root, anchor) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `pokemon-evolution-side pokemon-evolution-${direction}`;
  button.setAttribute('aria-label', direction === 'previous' ? 'Show previous evolutions' : 'Show next evolutions');
  button.textContent = direction === 'previous' ? '‹' : '›';
  button.addEventListener('click', () => createChooser(direction, names, root, anchor));
  return button;
}

export function enhancePokemonEvolutionControls(root) {
  if (state.route !== 'study' || state.study.mode !== 'pokemon') return;
  const pokemon = state.study.pokemonResult;
  const card = root.querySelector('.pokemon-result-card');
  if (!pokemon || !card || card.closest('.pokemon-result-navigation')) return;

  const previous = pokemon.evolution?.previous ?? [];
  const next = pokemon.evolution?.next ?? [];
  if (!previous.length && !next.length) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'pokemon-result-navigation';
  card.replaceWith(wrapper);

  const left = previous.length
    ? createDirectionButton('previous', previous, root, wrapper)
    : document.createElement('span');
  const right = next.length
    ? createDirectionButton('next', next, root, wrapper)
    : document.createElement('span');
  left.classList.add('pokemon-evolution-spacer');
  right.classList.add('pokemon-evolution-spacer');
  wrapper.append(left, card, right);
}
