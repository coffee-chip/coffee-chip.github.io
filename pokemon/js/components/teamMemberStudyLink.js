import { state } from '../state.js';
import { getTeam } from '../data/teamRepository.js';
import { getPokemon, rememberPokemonLookup } from '../data/pokemonRepository.js';

async function openInStudy(id) {
  try {
    const result = await getPokemon(id);
    state.study.mode = 'pokemon';
    state.study.pokemonResult = result.pokemon;
    state.study.pokemonSource = result.source;
    state.study.pokemonError = result.stale ? 'The live lookup failed, so this result may be out of date.' : null;
    state.study.pokemonStatus = 'success';
    state.study.pokemonQuery = result.pokemon.displayName;
    rememberPokemonLookup(result.pokemon);
  } catch (error) {
    state.study.mode = 'pokemon';
    state.study.pokemonResult = null;
    state.study.pokemonSource = null;
    state.study.pokemonError = error?.message ?? 'Could not look up that Pokémon.';
    state.study.pokemonStatus = 'error';
    state.study.pokemonQuery = String(id);
  }
  location.hash = 'study';
}

export function enhanceTeamMemberStudyLinks(root) {
  if (state.route !== 'team') return;
  const team = getTeam(state.routeParams.teamId);
  if (!team) return;
  for (const card of root.querySelectorAll('.team-detail-member')) {
    const member = team.pokemon[Number(card.dataset.memberIndex)];
    const visual = card.querySelector('.team-detail-member-visual');
    if (!member || !visual?.querySelector('img') || visual.dataset.studyLink) continue;
    visual.dataset.studyLink = 'true';
    visual.classList.add('team-member-study-link');
    visual.tabIndex = 0;
    visual.setAttribute('role', 'button');
    visual.setAttribute('aria-label', `Open ${member.displayName} in Study`);
    visual.addEventListener('click', () => openInStudy(member.id));
    visual.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      openInStudy(member.id);
    });
  }
}
