export const THEME_PREFERENCES = ['system', 'light', 'dark'];

const systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
let systemThemeListener = null;

export function isThemePreference(value) {
  return THEME_PREFERENCES.includes(value);
}

export function getResolvedTheme(preference = 'system') {
  if (preference === 'dark') return 'dark';
  if (preference === 'light') return 'light';
  return systemThemeQuery.matches ? 'dark' : 'light';
}

export function applyTheme(preference = 'system') {
  const safePreference = isThemePreference(preference) ? preference : 'system';
  const resolvedTheme = getResolvedTheme(safePreference);
  document.documentElement.dataset.themePreference = safePreference;
  document.documentElement.dataset.theme = resolvedTheme;

  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) {
    themeColor.content = resolvedTheme === 'dark' ? '#111827' : '#f7f7f8';
  }

  return resolvedTheme;
}

export function watchSystemTheme(getPreference) {
  if (systemThemeListener) {
    systemThemeQuery.removeEventListener('change', systemThemeListener);
  }

  systemThemeListener = () => {
    if (getPreference() === 'system') applyTheme('system');
  };
  systemThemeQuery.addEventListener('change', systemThemeListener);

  return () => {
    if (!systemThemeListener) return;
    systemThemeQuery.removeEventListener('change', systemThemeListener);
    systemThemeListener = null;
  };
}
