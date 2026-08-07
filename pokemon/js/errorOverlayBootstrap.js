(() => {
  const STORAGE_KEY = 'pokemon-type-trainer';
  let enabled = false;
  let overlay = null;
  let currentError = null;

  function readEnabled() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      return saved?.settings?.developer?.showErrorOverlay === true;
    } catch {
      return false;
    }
  }

  function formatLocation({ filename, lineno, colno }) {
    if (!filename) return '';
    const shortName = filename.split('/').slice(-3).join('/');
    return `${shortName}${lineno ? `:${lineno}` : ''}${colno ? `:${colno}` : ''}`;
  }

  function normalizeError(input) {
    if (input?.type === 'unhandledrejection') {
      const reason = input.reason;
      return {
        title: 'Unhandled promise rejection',
        message: reason?.message ?? String(reason ?? 'Unknown rejection'),
        stack: reason?.stack ?? '',
        location: ''
      };
    }
    const error = input?.error;
    return {
      title: 'Application error',
      message: error?.message ?? input?.message ?? 'Unknown error',
      stack: error?.stack ?? '',
      location: formatLocation(input ?? {})
    };
  }

  function removeOverlay() {
    overlay?.remove();
    overlay = null;
  }

  function render() {
    removeOverlay();
    if (!enabled || !currentError) return;

    overlay = document.createElement('aside');
    overlay.className = 'developer-error-overlay';
    overlay.setAttribute('role', 'alert');
    overlay.setAttribute('aria-live', 'assertive');

    const header = document.createElement('div');
    header.className = 'developer-error-overlay-header';
    const title = document.createElement('strong');
    title.textContent = currentError.title;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'transparent-button developer-error-overlay-close';
    close.setAttribute('aria-label', 'Dismiss error');
    close.textContent = '×';
    close.addEventListener('click', removeOverlay);
    header.append(title, close);

    const message = document.createElement('pre');
    message.className = 'developer-error-overlay-message';
    message.textContent = currentError.message;
    overlay.append(header, message);

    if (currentError.location) {
      const location = document.createElement('div');
      location.className = 'developer-error-overlay-location';
      location.textContent = currentError.location;
      overlay.append(location);
    }

    if (currentError.stack) {
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = 'Stack trace';
      const stack = document.createElement('pre');
      stack.textContent = currentError.stack;
      details.append(summary, stack);
      overlay.append(details);
    }

    document.body.append(overlay);
  }

  function capture(event) {
    currentError = normalizeError(event);
    render();
  }

  function setEnabled(value) {
    enabled = value === true;
    if (!enabled) removeOverlay();
    else if (currentError) render();
  }

  enabled = readEnabled();
  window.addEventListener('error', capture);
  window.addEventListener('unhandledrejection', capture);
  window.pokemonErrorOverlay = {
    setEnabled,
    clear() { currentError = null; removeOverlay(); },
    showTestError() {
      currentError = {
        title: 'Test error overlay',
        message: 'The developer error overlay is working.',
        stack: '',
        location: ''
      };
      render();
    }
  };
})();
