(() => {
  const root = document.documentElement;
  root.classList.add('app-hydrating');

  const STORAGE_KEY = 'piggy-budget-ui-preferences-v1';
  const COLOR_THEMES = new Set(['garnet', 'amber', 'lapis']);
  const APPEARANCES = new Set(['light', 'dark', 'system']);
  const media = window.matchMedia('(prefers-color-scheme: dark)');

  const defaults = { colorTheme: 'garnet', appearance: 'system' };

  function read() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      return {
        colorTheme: COLOR_THEMES.has(saved?.colorTheme) ? saved.colorTheme : defaults.colorTheme,
        appearance: APPEARANCES.has(saved?.appearance) ? saved.appearance : defaults.appearance
      };
    } catch {
      return { ...defaults };
    }
  }

  function resolvedAppearance(preferences) {
    return preferences.appearance === 'system'
      ? (media.matches ? 'dark' : 'light')
      : preferences.appearance;
  }

  function themeColor(colorTheme, appearance) {
    const colors = {
      garnet: { light: '#a54e68', dark: '#c47791' },
      amber: { light: '#a56f32', dark: '#d0a15b' },
      lapis: { light: '#3f5c91', dark: '#7693c7' }
    };
    return colors[colorTheme][appearance];
  }

  function apply(preferences = read()) {
    const appearance = resolvedAppearance(preferences);
    root.dataset.colorTheme = preferences.colorTheme;
    root.dataset.appearance = appearance;
    root.style.colorScheme = appearance;

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = themeColor(preferences.colorTheme, appearance);
    return { ...preferences, resolvedAppearance: appearance };
  }

  function write(next) {
    const current = read();
    const preferences = {
      colorTheme: COLOR_THEMES.has(next?.colorTheme) ? next.colorTheme : current.colorTheme,
      appearance: APPEARANCES.has(next?.appearance) ? next.appearance : current.appearance
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.warn('Could not save theme preference:', error);
    }
    apply(preferences);
    window.dispatchEvent(new CustomEvent('piggy-theme-change', { detail: preferences }));
    return preferences;
  }

  media.addEventListener?.('change', () => {
    const preferences = read();
    if (preferences.appearance === 'system') apply(preferences);
  });

  window.PiggyTheme = { read, write, apply };
  apply();

  window.setTimeout(() => root.classList.remove('app-hydrating'), 2000);
})();
