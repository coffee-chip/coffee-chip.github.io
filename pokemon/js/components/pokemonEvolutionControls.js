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

  const header = document.createElement('div');
  header.className = 'pokemon-evolution-chooser-header';
  const heading = document.createElement('h3');
  heading.textContent = direction === 'previous' ? 'Evolves from' : 'Evolves to';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'pokemon-evolution-close';
  close.setAttribute('aria-label', 'Close evolution choices');
  close.textContent = '×';
  close.addEventListener('click', () => chooser.remove());
  header.append(heading, close);

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

  chooser.append(header, actions);
  card.after(chooser);
}

function createDirectionButton(direction, names, root, card) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `pokemon-evolution-button pokemon-evolution-${direction}`;
  button.setAttribute('aria-label', direction === 'previous' ? 'Show previous evolutions' : 'Show next evolutions');
  button.textContent = direction === 'previous' ? '‹' : '›';
  button.addEventListener('click', () => createChooser(direction, names, root, card));
  return button;
}

function createSpacer() {
  const spacer = document.createElement('span');
  spacer.className = 'pokemon-evolution-spacer';
  spacer.setAttribute('aria-hidden', 'true');
  return spacer;
}

export function enhancePokemonEvolutionControls(root) {
  if (state.route !== 'study' || state.study.mode !== 'pokemon') return;

  root.querySelector('.pokemon-evolution-nav')?.remove();
  root.querySelectorAll('.pokemon-evolution-group').forEach(group => group.closest('.panel')?.remove());

  const pokemon = state.study.pokemonResult;
  const card = root.querySelector('.pokemon-result-card');
  if (!pokemon || !card || card.classList.contains('pokemon-result-card-arranged')) return;

  const visual = card.querySelector('.pokemon-result-visual');
  const details = card.querySelector('.pokemon-result-details');
  if (!visual || !details) return;

  const previous = pokemon.evolution?.previous ?? [];
  const next = pokemon.evolution?.next ?? [];
  const identityRow = document.createElement('div');
  identityRow.className = 'pokemon-result-identity-row';

  identityRow.append(
    previous.length ? createDirectionButton('previous', previous, root, card) : createSpacer(),
    details,
    next.length ? createDirectionButton('next', next, root, card) : createSpacer()
  );

  card.replaceChildren(visual, identityRow);
  card.classList.add('pokemon-result-card-arranged');
}
