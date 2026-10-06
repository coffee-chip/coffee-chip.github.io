(() => {
  const root = document.documentElement;
  root.classList.add('app-hydrating');
  window.setTimeout(() => root.classList.remove('app-hydrating'), 2000);
})();
