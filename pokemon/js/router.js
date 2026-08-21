const VALID_ROUTES = new Set(['quiz', 'study', 'teams', 'my-pokemon', 'team', 'progress', 'settings', 'debug']);

export function getRoute() {
  const hash = location.hash.replace(/^#/, '') || 'quiz';
  const [name, ...segments] = hash.split('/');
  if (!VALID_ROUTES.has(name)) return { name: 'quiz', params: {} };
  if (name === 'team') {
    const teamId = decodeURIComponent(segments.join('/'));
    if (!teamId) return { name: 'teams', params: {} };
    return { name, params: { teamId } };
  }
  return { name, params: {} };
}

export function startRouter(onRouteChange) {
  const notify = () => onRouteChange(getRoute());
  window.addEventListener('hashchange', notify);
  notify();
}
