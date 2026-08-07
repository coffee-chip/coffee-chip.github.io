import { state } from '../state.js';
import { getRival } from '../data/teamRepository.js';

export function enhanceTeamRivalLink(root) {
  root.querySelector('.team-rival-link')?.remove();
  if (state.route !== 'team') return;
  const rival = getRival(state.routeParams.teamId);
  if (!rival) return;
  const tabs = root.querySelector('.team-detail-tabs');
  if (!tabs) return;
  const link = document.createElement('a');
  link.className = 'team-rival-link';
  link.href = `#team/${encodeURIComponent(rival.id)}`;
  link.textContent = `Rival: ${rival.title} →`;
  link.setAttribute('aria-label', `Open rival team ${rival.title}`);
  tabs.after(link);
}
