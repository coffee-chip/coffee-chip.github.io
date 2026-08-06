import { state } from '../state.js';
import { addPokemonToTeam, getTeams, TEAM_MAX_POKEMON } from '../data/teamRepository.js';

function closeMenu(root) {
  root.querySelector('.pokemon-team-menu')?.remove();
}

function statusMessage(result, teamTitle, pokemonName) {
  if (result.ok) return `${pokemonName} added to ${teamTitle}.`;
  if (result.reason === 'duplicate') return `${pokemonName} is already on ${teamTitle}.`;
  if (result.reason === 'full') return `${teamTitle} already has ${TEAM_MAX_POKEMON} Pokémon.`;
  return 'Could not add that Pokémon to the team.';
}

function openTeamPicker(root, card, pokemon) {
  closeMenu(root);
  const menu = document.createElement('div');
  menu.className = 'pokemon-team-menu';
  menu.setAttribute('role', 'dialog');
  menu.setAttribute('aria-label', `Add ${pokemon.displayName} to a team`);

  const heading = document.createElement('strong');
  heading.textContent = 'Add to team…';
  menu.append(heading);

  const options = document.createElement('div');
  options.className = 'pokemon-team-menu-options';
  const eligibleTeams = getTeams().filter(team => (
    team.pokemon.length < TEAM_MAX_POKEMON
    || team.pokemon.some(entry => entry.id === pokemon.id)
  ));

  for (const team of eligibleTeams) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary-button';
    button.textContent = team.title;
    button.addEventListener('click', () => {
      const result = addPokemonToTeam(team.id, pokemon);
      menu.replaceChildren();
      const message = document.createElement('span');
      message.className = result.ok ? 'pokemon-team-menu-success' : 'pokemon-team-menu-status';
      message.textContent = statusMessage(result, team.title, pokemon.displayName);
      menu.append(message);
      window.setTimeout(() => closeMenu(root), 1200);
    });
    options.append(button);
  }

  if (!eligibleTeams.length) {
    const status = document.createElement('span');
    status.className = 'pokemon-team-menu-status';
    status.textContent = 'All teams are full.';
    menu.append(status);
  } else {
    menu.append(options);
  }

  card.append(menu);

  window.setTimeout(() => {
    document.addEventListener('pointerdown', event => {
      if (!menu.contains(event.target)) closeMenu(root);
    }, { once: true });
  }, 0);
}

export function enhancePokemonTeamMenu(root) {
  if (state.route !== 'study' || state.study.mode !== 'pokemon') return;
  const pokemon = state.study.pokemonResult;
  const card = root.querySelector('.pokemon-result-card');
  const visual = card?.querySelector('.pokemon-result-visual');
  if (!pokemon || !card || !visual || visual.querySelector('.pokemon-team-menu-button')) return;

  card.classList.add('pokemon-result-card-with-team-menu');
  visual.classList.add('pokemon-result-visual-with-menu');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'icon-button pokemon-team-menu-button';
  button.textContent = '⋯';
  button.setAttribute('aria-label', `More actions for ${pokemon.displayName}`);
  button.setAttribute('aria-haspopup', 'dialog');
  button.addEventListener('click', event => {
    event.stopPropagation();
    if (card.querySelector('.pokemon-team-menu')) closeMenu(root);
    else openTeamPicker(root, card, pokemon);
  });
  visual.append(button);
}
