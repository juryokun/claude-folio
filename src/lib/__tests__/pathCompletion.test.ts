import { describe, expect, it } from 'vitest';
import { abbreviatePath, basename, commonPrefix, expandTilde } from '../pathCompletion';

describe('abbreviatePath', () => {
  const HOME = '/Users/john';

  it('replaces home prefix with ~', () => {
    expect(abbreviatePath('/Users/john/Documents', HOME)).toBe('~/Documents');
  });

  it('returns ~ for home directory itself', () => {
    expect(abbreviatePath('/Users/john', HOME)).toBe('~');
  });

  it('does not match a longer username with same prefix', () => {
    expect(abbreviatePath('/Users/johndoe/projects', HOME)).toBe('/Users/johndoe/projects');
  });

  it('leaves unrelated paths unchanged', () => {
    expect(abbreviatePath('/usr/local/bin', HOME)).toBe('/usr/local/bin');
  });
});

describe('basename', () => {
  it('returns last segment with trailing slash', () => {
    expect(basename('/Users/john/projects')).toBe('projects/');
  });

  it('returns / for root path', () => {
    expect(basename('/')).toBe('/');
  });

  it('returns last segment even with trailing slash in input', () => {
    expect(basename('/Users/john/projects/')).toBe('projects/');
  });
});

describe('commonPrefix', () => {
  it('returns empty string for empty array', () => {
    expect(commonPrefix([])).toBe('');
  });

  it('returns the single string unchanged', () => {
    expect(commonPrefix(['/Users/foo/bar/'])).toBe('/Users/foo/bar/');
  });

  it('finds common prefix of multiple paths', () => {
    expect(commonPrefix(['/Users/foo/alpha/', '/Users/foo/alpha2/', '/Users/foo/aaa/'])).toBe(
      '/Users/foo/a',
    );
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
