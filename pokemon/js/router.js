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
  if (name === 'my-pokemon' && segments.length) {
    const instanceId = decodeURIComponent(segments.join('/'));
    if (!instanceId) return { name: 'my-pokemon', params: {} };
    return { name: 'owned-pokemon', params: { instanceId } };
  }
  return { name, params: {} };
}

export function startRouter(onRouteChange) {
  const notify = () => onRouteChange(getRoute());
  window.addEventListener('hashchange', notify);
  notify();
}
