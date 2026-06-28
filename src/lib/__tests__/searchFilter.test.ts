import { describe, expect, it } from 'vitest';
import { matchesFilter, parseFilterQuery } from '../searchFilter';

describe('parseFilterQuery', () => {
  it('returns null for empty string', () => {
    expect(parseFilterQuery('')).toBeNull();
  });

  it('returns partial filter for plain text', () => {
    const result = parseFilterQuery('foo');
    expect(result?.type).toBe('partial');
  });

  it('returns regex filter when query starts with /', () => {
    const result = parseFilterQuery('/\\.tsx$');
    expect(result?.type).toBe('regex');
  });

  it('returns invalid_regex for broken pattern', () => {
    const result = parseFilterQuery('/[unclosed');
    expect(result?.type).toBe('invalid_regex');
  });

  it('regex is case-insensitive', () => {
    const result = parseFilterQuery('/FOO');
    expect(result?.type).toBe('regex');
    if (result?.type === 'regex') {
      expect(result.regex.flags).toContain('i');
    }
  });

  it('empty regex pattern (just /) returns regex matching everything', () => {
    const result = parseFilterQuery('/');
    expect(result?.type).toBe('regex');
  });
});

describe('matchesFilter – partial', () => {
  const filter = parseFilterQuery('foo');
  if (!filter) throw new Error('parseFilterQuery returned null');

  it('matches substring', () => {
    expect(matchesFilter('foobar', filter)).toBe(true);
  });

  it('matches case-insensitively', () => {
    expect(matchesFilter('FOObar', filter)).toBe(true);
  });

  it('does not match unrelated name', () => {
    expect(matchesFilter('barbaz', filter)).toBe(false);
  });
});

describe('matchesFilter – regex', () => {
  it('matches by extension', () => {
    const filter = parseFilterQuery('/\\.ts$');
    if (!filter) throw new Error('parseFilterQuery returned null');
    expect(matchesFilter('store.ts', filter)).toBe(true);
    expect(matchesFilter('store.tsx', filter)).toBe(false);
  });

  it('matches dotfiles pattern', () => {
    const filter = parseFilterQuery('/^\\.');
    if (!filter) throw new Error('parseFilterQuery returned null');
    expect(matchesFilter('.gitignore', filter)).toBe(true);
    expect(matchesFilter('readme.md', filter)).toBe(false);
  });

  it('is case-insensitive', () => {
    const filter = parseFilterQuery('/README');
    if (!filter) throw new Error('parseFilterQuery returned null');
    expect(matchesFilter('readme.md', filter)).toBe(true);
  });
});

describe('matchesFilter – invalid_regex', () => {
  it('always returns false', () => {
    const filter = parseFilterQuery('/[invalid');
    if (!filter) throw new Error('parseFilterQuery returned null');
    expect(matchesFilter('anything', filter)).toBe(false);
    expect(matchesFilter('[invalid', filter)).toBe(false);
  });
});
