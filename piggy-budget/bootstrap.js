(() => {
  const root = document.documentElement;
  root.classList.add('app-hydrating');

  try {
    localStorage.removeItem('piggy-budget-ui-preferences-v1');
  } catch {}

  window.setTimeout(() => root.classList.remove('app-hydrating'), 2000);
})();
