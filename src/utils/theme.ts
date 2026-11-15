export type ThemePreference = 'light' | 'dark';

export function normalizeThemePreference(value: unknown): ThemePreference {
  return value === 'light' ? 'light' : 'dark';
}

export function getNextThemePreference(current: ThemePreference): ThemePreference {
  return current === 'dark' ? 'light' : 'dark';
}
