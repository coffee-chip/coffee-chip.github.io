export function setOverflowMenuExpanded(button, expanded) {
  if (!button) return;
  button.setAttribute('aria-expanded', String(expanded));
  button.textContent = expanded ? '×' : '⋯';
}

export function createOverflowMenuButton({ className = '', ariaLabel, isOpen, open, close }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = ['secondary-button', 'icon-button', className].filter(Boolean).join(' ');
  button.setAttribute('aria-label', ariaLabel);
  button.setAttribute('aria-haspopup', 'dialog');
  setOverflowMenuExpanded(button, false);
  button.addEventListener('click', event => {
    event.stopPropagation();
    if (isOpen()) {
      close();
      setOverflowMenuExpanded(button, false);
    } else {
      open();
      setOverflowMenuExpanded(button, true);
    }
  });
  return button;
}
