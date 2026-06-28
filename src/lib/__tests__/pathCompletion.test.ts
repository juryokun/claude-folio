import { describe, it, expect } from 'vitest';
import { commonPrefix, expandTilde } from '../pathCompletion';

describe('commonPrefix', () => {
  it('returns empty string for empty array', () => {
    expect(commonPrefix([])).toBe('');
  });

  it('returns the single string unchanged', () => {
    expect(commonPrefix(['/Users/foo/bar/'])).toBe('/Users/foo/bar/');
  });

  it('finds common prefix of multiple paths', () => {
    expect(commonPrefix(['/Users/foo/alpha/', '/Users/foo/alpha2/', '/Users/foo/aaa/']))
      .toBe('/Users/foo/a');
  });

  it('returns empty string when no common prefix', () => {
    expect(commonPrefix(['/aaa/', '/bbb/'])).toBe('/');
  });

  it('handles identical strings', () => {
    expect(commonPrefix(['/Users/foo/', '/Users/foo/'])).toBe('/Users/foo/');
  });
});

describe('expandTilde', () => {
  const HOME = '/Users/testuser';

  it('expands bare ~ to home + /', () => {
    expect(expandTilde('~', HOME)).toBe('/Users/testuser/');
  });

  it('expands ~/path to home/path', () => {
    expect(expandTilde('~/Documents', HOME)).toBe('/Users/testuser/Documents');
  });

  it('leaves absolute paths unchanged', () => {
    expect(expandTilde('/usr/local', HOME)).toBe('/usr/local');
  });

  it('leaves keyword (no slash) unchanged', () => {
    expect(expandTilde('work', HOME)).toBe('work');
  });
});
