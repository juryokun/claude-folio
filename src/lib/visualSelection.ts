import type { FileEntry } from '../types';

/** Returns the union of `base` and the paths between `anchor` and `cursor` (inclusive). */
export function computeVisualSelection(
  entries: FileEntry[],
  anchor: number,
  cursor: number,
  base: Set<string>,
): Set<string> {
  const lo = Math.min(anchor, cursor);
  const hi = Math.max(anchor, cursor);
  const range = entries.slice(lo, hi + 1).map((e) => e.path);
  return new Set([...base, ...range]);
}
