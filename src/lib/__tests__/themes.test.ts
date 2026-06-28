import { describe, it, expect } from 'vitest';
import { THEMES, isValidThemeId } from '../themes';

describe('THEMES', () => {
  it('contains all expected themes', () => {
    const ids = THEMES.map((t) => t.id);
    expect(ids).toContain('dark');
    expect(ids).toContain('light');
    expect(ids).toContain('monokai');
    expect(ids).toContain('nord');
    expect(ids).toContain('dracula');
    expect(ids).toContain('gruvbox');
    expect(ids).toContain('ayu-dark');
    expect(ids).toContain('solarized-light');
    expect(ids).toContain('one-light');
    expect(ids).toContain('catppuccin-latte');
    expect(ids).toContain('papercolor');
  });

  it('every theme has required CSS variables', () => {
    const required = [
      '--bg',
      '--bg-secondary',
      '--text',
      '--text-accent',
      '--border',
      '--cursor-bg',
    ];
    for (const theme of THEMES) {
      for (const v of required) {
        expect(theme.vars[v], `${theme.id} missing ${v}`).toBeDefined();
      }
    }
  });
});

describe('isValidThemeId', () => {
  it('returns true for valid ids', () => {
    expect(isValidThemeId('dark')).toBe(true);
    expect(isValidThemeId('light')).toBe(true);
    expect(isValidThemeId('monokai')).toBe(true);
    expect(isValidThemeId('nord')).toBe(true);
    expect(isValidThemeId('dracula')).toBe(true);
    expect(isValidThemeId('gruvbox')).toBe(true);
    expect(isValidThemeId('ayu-dark')).toBe(true);
    expect(isValidThemeId('solarized-light')).toBe(true);
    expect(isValidThemeId('one-light')).toBe(true);
    expect(isValidThemeId('catppuccin-latte')).toBe(true);
    expect(isValidThemeId('papercolor')).toBe(true);
  });

  it('returns false for unknown ids', () => {
    expect(isValidThemeId('solarized')).toBe(false);
    expect(isValidThemeId('')).toBe(false);
  });
});
