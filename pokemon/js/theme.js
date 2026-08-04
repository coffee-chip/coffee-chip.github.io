export const PALETTE_THEMES = ['classic'];
export const APPEARANCE_PREFERENCES = ['system', 'light', 'dark'];
export const THEME_PREFERENCES = APPEARANCE_PREFERENCES;

const systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
let systemThemeListener = null;

export function isPaletteTheme(value) {
  return PALETTE_THEMES.includes(value);
}

export function isAppearancePreference(value) {
  return APPEARANCE_PREFERENCES.includes(value);
}

export function getResolvedAppearance(preference = 'system') {
  if (preference === 'dark') return 'dark';
  if (preference === 'light') return 'light';
  return systemThemeQuery.matches ? 'dark' : 'light';
}

export function applyTheme(paletteTheme = 'classic', appearance) {
  // Backward compatibility: applyTheme('dark') means Classic + dark appearance.
  if (appearance === undefined && isAppearancePreference(paletteTheme)) {
    appearance = paletteTheme;
    paletteTheme = 'classic';
  }
  appearance ??= 'system';

  const safePalette = isPaletteTheme(paletteTheme) ? paletteTheme : 'classic';
  const safeAppearance = isAppearancePreference(appearance) ? appearance : 'system';
  const resolvedAppearance = getResolvedAppearance(safeAppearance);

  document.documentElement.dataset.palette = safePalette;
  document.documentElement.dataset.appearancePreference = safeAppearance;
  document.documentElement.dataset.appearance = resolvedAppearance;

  // Temporary compatibility for CSS that still checks data-theme.
  document.documentElement.dataset.theme = resolvedAppearance;
  document.documentElement.dataset.themePreference = safeAppearance;

  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) {
    const computed = getComputedStyle(document.documentElement)
      .getPropertyValue('--page-background')
      .trim();
    themeColor.content = computed || (resolvedAppearance === 'dark' ? '#111827' : '#f7f7f8');
  }

  return { paletteTheme: safePalette, appearance: resolvedAppearance };
}

export function watchSystemTheme(getSettings) {
  if (systemThemeListener) systemThemeQuery.removeEventListener('change', systemThemeListener);

  systemThemeListener = () => {
    const settings = getSettings();
    const appearance = typeof settings === 'string' ? settings : settings?.appearance;
    if (appearance === 'system') {
      const paletteTheme = typeof settings === 'object' ? settings.paletteTheme : 'classic';
      applyTheme(paletteTheme, 'system');
    }
  };
  systemThemeQuery.addEventListener('change', systemThemeListener);

  return () => {
    if (!systemThemeListener) return;
    systemThemeQuery.removeEventListener('change', systemThemeListener);
    systemThemeListener = null;
  };
}
