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

function compactConditionLabel(target) {
  const conditions = target.conditions ?? [];
  if (conditions.length !== 1) return 'Details';
  const condition = conditions[0];
  if (condition.minLevel) return `Lv. ${condition.minLevel}`;
  if (condition.trigger === 'use-item') return 'Stone';
  if (condition.trigger === 'trade') return 'Trade';
  if (condition.minHappiness || condition.minAffection) return 'Friendship';
  return 'Details';
}

function conditionDescription(condition) {
  const parts = [];
  if (condition.trigger === 'level-up') parts.push(condition.minLevel ? `Level ${condition.minLevel}` : 'Level up');
  else if (condition.trigger === 'use-item') parts.push(condition.item ? `Use ${displayName(condition.item)}` : 'Use an evolution item');
  else if (condition.trigger === 'trade') parts.push(condition.tradeSpecies ? `Trade for ${displayName(condition.tradeSpecies)}` : 'Trade');
  else if (condition.trigger && condition.trigger !== 'unknown') parts.push(displayName(condition.trigger));

  if (condition.heldItem) parts.push(`holding ${displayName(condition.heldItem)}`);
  if (condition.knownMove) parts.push(`knowing ${displayName(condition.knownMove)}`);
  if (condition.knownMoveType) parts.push(`knowing a ${displayName(condition.knownMoveType)}-type move`);
  if (condition.location) parts.push(`at ${displayName(condition.location)}`);
  if (condition.minHappiness) parts.push('with high friendship');
  if (condition.minBeauty) parts.push(`with Beauty ${condition.minBeauty}+`);
  if (condition.minAffection) parts.push(`with affection ${condition.minAffection}+`);
  if (condition.timeOfDay) parts.push(`during the ${displayName(condition.timeOfDay)}`);
  if (condition.gender === 1) parts.push('if female');
  if (condition.gender === 2) parts.push('if male');
  if (condition.needsOverworldRain) parts.push('while it is raining');
  if (condition.partySpecies) parts.push(`with ${displayName(condition.partySpecies)} in the party`);
  if (condition.partyType) parts.push(`with a ${displayName(condition.partyType)}-type Pokémon in the party`);
  if (condition.relativePhysicalStats === 1) parts.push('when Attack is higher than Defense');
  if (condition.relativePhysicalStats === 0) parts.push('when Attack equals Defense');
  if (condition.relativePhysicalStats === -1) parts.push('when Defense is higher than Attack');
  if (condition.turnUpsideDown) parts.push('while the device is upside down');
  return parts.length ? parts.join(', ') : 'Special evolution condition';
}

function createPanelHeader(title, onClose) {
  const header = document.createElement('div');
  header.className = 'pokemon-evolution-chooser-header';
  const heading = document.createElement('h3');
  heading.textContent = title;
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'pokemon-evolution-close';
  close.setAttribute('aria-label', 'Close evolution details');
  close.textContent = '×';
  close.addEventListener('click', onClose);
  header.append(heading, close);
  return header;
}

function showEvolutionDetails(entries, direction, root, card) {
  root.querySelector('.pokemon-evolution-chooser')?.remove();
  const panel = document.createElement('section');
  panel.className = 'panel pokemon-evolution-chooser';
  panel.setAttribute('aria-label', 'Evolution requirements');
  panel.append(createPanelHeader('Evolution requirements', () => panel.remove()));

  const list = document.createElement('div');
  list.className = 'pokemon-evolution-requirements';
  for (const entry of entries) {
    const item = document.createElement('div');
    item.className = 'pokemon-evolution-requirement';
    const name = document.createElement('strong');
    name.textContent = direction === 'previous'
      ? `From ${displayName(entry.name)}`
      : `To ${displayName(entry.name)}`;
    item.append(name);
    for (const condition of entry.conditions ?? []) {
      const description = document.createElement('span');
      description.textContent = conditionDescription(condition);
      item.append(description);
    }
    list.append(item);
  }
  panel.append(list);
  card.after(panel);
}

function createChooser(direction, entries, root, card) {
  root.querySelector('.pokemon-evolution-chooser')?.remove();
  const chooser = document.createElement('section');
  chooser.className = 'panel pokemon-evolution-chooser';
  chooser.setAttribute('aria-label', direction === 'previous' ? 'Previous evolutions' : 'Next evolutions');
  chooser.append(createPanelHeader(direction === 'previous' ? 'Evolves from' : 'Evolves to', () => chooser.remove()));

  const actions = document.createElement('div');
  actions.className = 'pokemon-evolution-options';
  for (const entry of entries) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary-button';
    button.textContent = displayName(entry.name);
    button.addEventListener('click', () => submitLookup(entry.name, root));
    actions.append(button);
  }

  chooser.append(actions);
  card.after(chooser);
}

function createDirectionButton(direction, entries, root, card) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `pokemon-evolution-button pokemon-evolution-${direction}`;
  button.setAttribute('aria-label', direction === 'previous' ? 'Go to previous evolution' : 'Go to next evolution');
  button.textContent = direction === 'previous' ? '‹' : '›';
  button.addEventListener('click', () => {
    if (entries.length === 1) submitLookup(entries[0].name, root);
    else createChooser(direction, entries, root, card);
  });
  return button;
}

function createEvolutionControls(direction, entries, root, card) {
  const controls = document.createElement('div');
  controls.className = 'pokemon-evolution-controls';
  controls.append(createDirectionButton(direction, entries, root, card));

  const condition = document.createElement('button');
  condition.type = 'button';
  condition.className = 'pokemon-evolution-condition';
  condition.textContent = entries.length === 1 ? compactConditionLabel(entries[0]) : 'Options';
  condition.setAttribute('aria-label', direction === 'previous'
    ? 'Show how this Pokémon evolves from its previous form'
    : 'Show evolution requirements');
  condition.addEventListener('click', () => showEvolutionDetails(entries, direction, root, card));
  controls.append(condition);
  return controls;
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
    previous.length ? createEvolutionControls('previous', previous, root, card) : createSpacer(),
    details,
    next.length ? createEvolutionControls('next', next, root, card) : createSpacer()
  );

  card.replaceChildren(visual, identityRow);
  card.classList.add('pokemon-result-card-arranged');
}
