import { describe, expect, it } from 'vitest';
import type { FileEntry } from '../../types';
import { computeVisualSelection } from '../visualSelection';

function makeEntries(names: string[]): FileEntry[] {
  return names.map((name) => ({
    name,
    path: `/dir/${name}`,
    is_dir: false,
    is_symlink: false,
    size: 0,
  }));
}

describe('computeVisualSelection', () => {
  const entries = makeEntries(['a', 'b', 'c', 'd', 'e']);

  it('selects the range when anchor is before cursor', () => {
    const result = computeVisualSelection(entries, 1, 3, new Set());
    expect(result).toEqual(new Set(['/dir/b', '/dir/c', '/dir/d']));
  });

  it('selects the range when anchor is after cursor', () => {
    const result = computeVisualSelection(entries, 3, 1, new Set());
    expect(result).toEqual(new Set(['/dir/b', '/dir/c', '/dir/d']));
  });

  it('selects a single entry when anchor equals cursor', () => {
    const result = computeVisualSelection(entries, 2, 2, new Set());
    expect(result).toEqual(new Set(['/dir/c']));
  });

  it('unions the range with the base selection', () => {
    const base = new Set(['/dir/e']);
    const result = computeVisualSelection(entries, 0, 1, base);
    expect(result).toEqual(new Set(['/dir/a', '/dir/b', '/dir/e']));
  });

  it('returns an empty set for empty entries', () => {
    const result = computeVisualSelection([], 0, 0, new Set());
    expect(result).toEqual(new Set());
  });
});
