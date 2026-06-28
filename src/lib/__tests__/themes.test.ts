import { describe, it, expect } from 'vitest';
import { THEMES, isValidThemeId } from '../themes';

describe('THEMES', () => {
  it('contains dark and light', () => {
    const ids = THEMES.map((t) => t.id);
    expect(ids).toContain('dark');
    expect(ids).toContain('light');
  });

  it('every theme has required CSS variables', () => {
    const required = ['--bg', '--bg-secondary', '--text', '--text-accent', '--border', '--cursor-bg'];
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
  });

  it('returns false for unknown ids', () => {
    expect(isValidThemeId('monokai')).toBe(false);
    expect(isValidThemeId('')).toBe(false);
  });
});
