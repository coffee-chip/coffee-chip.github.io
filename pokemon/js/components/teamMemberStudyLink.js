import { state } from '../state.js';
import { getTeam } from '../data/teamRepository.js';
import { openPokemonInStudy } from './pokemonStudyNavigation.js';

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
    visual.addEventListener('click', () => openPokemonInStudy(member.id));
    visual.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      openPokemonInStudy(member.id);
    });
  }
}
