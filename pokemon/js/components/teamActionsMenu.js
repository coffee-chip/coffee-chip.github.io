import { deleteTeam, renameTeam, setTeamOpponent } from '../data/teamRepository.js';

function el(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text) node.textContent = options.text;
  return node;
}

function closeMenu(host) {
  host.querySelector('.team-actions-menu')?.remove();
}

function createRenamePanel(team, host, render) {
  const panel = el('form', { className: 'team-actions-panel' });
  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 60;
  input.value = team.title;
  input.setAttribute('aria-label', `Rename ${team.title}`);
  const actions = el('div', { className: 'team-actions-inline-buttons' });
  const cancel = el('button', { className: 'secondary-button', text: 'Cancel' });
  const save = el('button', { className: 'primary-button', text: 'Save' });
  cancel.type = 'button';
  save.type = 'submit';
  cancel.addEventListener('click', () => closeMenu(host));
  panel.addEventListener('submit', event => {
    event.preventDefault();
    if (!renameTeam(team.id, input.value)) {
      input.focus();
      return;
    }
    render();
  });
  actions.append(cancel, save);
  panel.append(input, actions);
  return panel;
}

function createDeletePanel(team, host, render, onDelete) {
  const panel = el('div', { className: 'team-actions-panel' });
  panel.append(el('span', { text: `Delete “${team.title}”?` }));
  const actions = el('div', { className: 'team-actions-inline-buttons' });
  const cancel = el('button', { className: 'secondary-button', text: 'Cancel' });
  const confirm = el('button', { className: 'danger-button', text: 'Delete' });
  cancel.type = confirm.type = 'button';
  cancel.addEventListener('click', () => closeMenu(host));
  confirm.addEventListener('click', () => {
    if (!deleteTeam(team.id)) return;
    if (onDelete) onDelete();
    else render();
  });
  actions.append(cancel, confirm);
  panel.append(actions);
  return panel;
}

function openMenu(team, host, render, onDelete) {
  closeMenu(host);
  const menu = el('div', { className: 'team-actions-menu' });
  menu.setAttribute('role', 'dialog');
  menu.setAttribute('aria-label', `Actions for ${team.title}`);

  const rename = el('button', { className: 'secondary-button team-actions-item', text: 'Rename team' });
  rename.type = 'button';
  rename.addEventListener('click', () => menu.replaceChildren(createRenamePanel(team, host, render)));

  const opponent = el('label', { className: 'team-actions-opponent' });
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = team.isOpponent === true;
  checkbox.addEventListener('change', () => {
    if (setTeamOpponent(team.id, checkbox.checked)) render();
  });
  opponent.append(checkbox, el('span', { text: 'Opponent team' }));

  const remove = el('button', { className: 'danger-button team-actions-item', text: 'Delete team' });
  remove.type = 'button';
  remove.addEventListener('click', () => menu.replaceChildren(createDeletePanel(team, host, render, onDelete)));

  menu.append(rename, opponent, remove);
  host.append(menu);

  window.setTimeout(() => {
    document.addEventListener('pointerdown', event => {
      if (!menu.contains(event.target) && !host.querySelector('.team-actions-button')?.contains(event.target)) closeMenu(host);
    }, { once: true });
  }, 0);
}

export function createTeamActionsButton(team, host, render, options = {}) {
  const button = el('button', { className: 'secondary-button icon-button team-actions-button', text: '⋯' });
  button.type = 'button';
  button.setAttribute('aria-label', `More actions for ${team.title}`);
  button.setAttribute('aria-haspopup', 'dialog');
  button.addEventListener('click', event => {
    event.stopPropagation();
    if (host.querySelector('.team-actions-menu')) closeMenu(host);
    else openMenu(team, host, render, options.onDelete);
  });
  return button;
}
