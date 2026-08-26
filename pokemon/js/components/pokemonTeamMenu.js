import { state } from '../state.js';
import { addPokemonInstanceToTeam, addPokemonToTeam, getTeams, TEAM_MAX_POKEMON } from '../data/teamRepository.js';
import { addPokemonToMyPokemon, getMyPokemonById } from '../data/pokemonInstanceRepository.js';
import { createOverflowMenuButton, setOverflowMenuExpanded } from './overflowMenuButton.js';

function closeMenu(root) {
  root.querySelector('.pokemon-team-menu')?.remove();
  setOverflowMenuExpanded(root.querySelector('.pokemon-team-menu-button'), false);
}

function statusMessage(result, teamTitle, pokemonName) {
  if (result.ok) return `${pokemonName} added to ${teamTitle}.`;
  if (result.reason === 'duplicate') return `${pokemonName} is already on ${teamTitle}.`;
  if (result.reason === 'full') return `${teamTitle} already has ${TEAM_MAX_POKEMON} Pokémon.`;
  return 'Could not add that Pokémon to the team.';
}

function openTeamPicker(root, card, pokemon, instance = null) {
  closeMenu(root);
  const menu = document.createElement('div');
  menu.className = 'pokemon-team-menu';
  menu.setAttribute('role', 'dialog');
  menu.setAttribute('aria-label', `Actions for ${pokemon.displayName}`);

  const heading = document.createElement('strong');
  heading.textContent = 'Add to…';
  menu.append(heading);

  if (!instance) {
    const ownedButton = document.createElement('button');
    ownedButton.type = 'button';
    ownedButton.className = 'secondary-button';
    ownedButton.textContent = 'My Pokémon';
    ownedButton.addEventListener('click', () => {
      const added = addPokemonToMyPokemon(pokemon);
      menu.replaceChildren();
      const message = document.createElement('span');
      message.className = added ? 'pokemon-team-menu-success' : 'pokemon-team-menu-status';
      message.textContent = added
        ? `${pokemon.displayName} added to My Pokémon.`
        : 'Could not add that Pokémon.';
      menu.append(message);
      window.setTimeout(() => closeMenu(root), 1200);
    });
    menu.append(ownedButton);
  }

  const teamHeading = document.createElement('strong');
  teamHeading.textContent = 'Team';
  menu.append(teamHeading);

  const options = document.createElement('div');
  options.className = 'pokemon-team-menu-options';
  const eligibleTeams = getTeams().filter(team => (
    team.memberIds.length < TEAM_MAX_POKEMON
    || (instance && team.memberIds.includes(instance.id))
  ));

  for (const team of eligibleTeams) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary-button';
    button.textContent = team.title;
    button.addEventListener('click', () => {
      const result = instance
        ? addPokemonInstanceToTeam(team.id, instance.id)
        : addPokemonToTeam(team.id, pokemon);
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
}

export function enhancePokemonTeamMenu(root) {
  const studyPokemon = state.route === 'study' && state.study.mode === 'pokemon'
    ? state.study.pokemonResult
    : null;
  const instance = state.route === 'owned-pokemon'
    ? getMyPokemonById(state.ownedPokemonDetail.instanceId)
    : null;
  const pokemon = studyPokemon ?? (instance ? state.ownedPokemonDetail.pokemon : null);
  const card = root.querySelector('.pokemon-result-card');
  const visual = card?.querySelector('.pokemon-result-visual');
  if (!pokemon || !card || !visual || visual.querySelector('.pokemon-team-menu-button')) return;

  card.classList.add('pokemon-result-card-with-team-menu');
  visual.classList.add('pokemon-result-visual-with-menu');
  const button = createOverflowMenuButton({
    className: 'pokemon-team-menu-button',
    ariaLabel: `More actions for ${pokemon.displayName}`,
    isOpen: () => Boolean(card.querySelector('.pokemon-team-menu')),
    open: () => openTeamPicker(root, card, pokemon, instance),
    close: () => closeMenu(root)
  });
  visual.append(button);
}
