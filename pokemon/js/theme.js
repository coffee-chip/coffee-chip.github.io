export const PALETTE_THEMES = ['classic'];
export const APPEARANCE_PREFERENCES = ['system', 'light', 'dark'];

const systemAppearanceQuery = window.matchMedia('(prefers-color-scheme: dark)');
let systemAppearanceListener = null;

export function isPaletteTheme(value) {
  return PALETTE_THEMES.includes(value);
}

export function isAppearancePreference(value) {
  return APPEARANCE_PREFERENCES.includes(value);
}

export function getResolvedAppearance(preference = 'system') {
  if (preference === 'dark') return 'dark';
  if (preference === 'light') return 'light';
  return systemAppearanceQuery.matches ? 'dark' : 'light';
}

export function applyTheme(paletteTheme = 'classic', appearance = 'system') {
  const safePalette = isPaletteTheme(paletteTheme) ? paletteTheme : 'classic';
  const safeAppearance = isAppearancePreference(appearance) ? appearance : 'system';
  const resolvedAppearance = getResolvedAppearance(safeAppearance);

  document.documentElement.dataset.palette = safePalette;
  document.documentElement.dataset.appearancePreference = safeAppearance;
  document.documentElement.dataset.appearance = resolvedAppearance;

  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) {
    const computed = getComputedStyle(document.documentElement).getPropertyValue('--page-background').trim();
    themeColor.content = computed || (resolvedAppearance === 'dark' ? '#111827' : '#f7f7f8');
  }

  return { paletteTheme: safePalette, appearance: resolvedAppearance };
}

export function watchSystemTheme(getSettings) {
  if (systemAppearanceListener) systemAppearanceQuery.removeEventListener('change', systemAppearanceListener);

  systemAppearanceListener = () => {
    const settings = getSettings();
    if (settings?.appearance === 'system') applyTheme(settings.paletteTheme, 'system');
  };
  systemAppearanceQuery.addEventListener('change', systemAppearanceListener);

  return () => {
    if (!systemAppearanceListener) return;
    systemAppearanceQuery.removeEventListener('change', systemAppearanceListener);
    systemAppearanceListener = null;
  };
}
