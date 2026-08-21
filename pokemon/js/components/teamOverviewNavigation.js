const OPTIONS = Object.freeze([
  ['teams', 'Teams'],
  ['my-pokemon', 'My Pokémon']
]);

export function createTeamOverviewNavigation(activeRoute) {
  const navigation = document.createElement('div');
  navigation.className = 'button-selector button-selector-grid team-overview-navigation';
  navigation.setAttribute('role', 'tablist');
  navigation.setAttribute('aria-label', 'Teams section');

  for (const [route, label] of OPTIONS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary-button button-selector-option';
    button.textContent = label;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(route === activeRoute));
    button.addEventListener('click', () => { location.hash = route; });
    navigation.append(button);
  }

  return navigation;
}
