import test from 'node:test';
import assert from 'node:assert/strict';
import { getNextThemePreference, normalizeThemePreference } from './theme';

test('normalizeThemePreference accepts light and dark and falls back legacy values to dark', () => {
  assert.equal(normalizeThemePreference('light'), 'light');
  assert.equal(normalizeThemePreference('dark'), 'dark');
  assert.equal(normalizeThemePreference('system'), 'dark');
  assert.equal(normalizeThemePreference(undefined), 'dark');
});

test('getNextThemePreference toggles cleanly between dark and light', () => {
  assert.equal(getNextThemePreference('dark'), 'light');
  assert.equal(getNextThemePreference('light'), 'dark');
});
