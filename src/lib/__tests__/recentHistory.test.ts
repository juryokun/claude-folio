import { describe, expect, it } from 'vitest';
import type { RecentEntry } from '../recentHistory';
import { filterAndSortRecent, formatAccessedAt } from '../recentHistory';

function entry(p: string, kind: 'file' | 'dir', accessed_at: number): RecentEntry {
  return { path: p, kind, accessed_at };
}

describe('filterAndSortRecent', () => {
  const entries: RecentEntry[] = [
    entry('/home/user/doc.txt', 'file', 3000),
    entry('/home/user/projects', 'dir', 2000),
    entry('/home/user/notes.md', 'file', 1000),
  ];

  it('mode=files excludes directories', () => {
    const result = filterAndSortRecent(entries, '', 'files');
    expect(result.every((e) => e.kind === 'file')).toBe(true);
    expect(result.length).toBe(2);
  });

  it('mode=all includes both files and directories', () => {
    const result = filterAndSortRecent(entries, '', 'all');
    expect(result.length).toBe(3);
  });

  it('query filters by basename case-insensitively', () => {
    const result = filterAndSortRecent(entries, 'DOC', 'all');
    expect(result.length).toBe(1);
    expect(result[0].path).toBe('/home/user/doc.txt');
  });

  it('empty query returns all entries for mode', () => {
    const result = filterAndSortRecent(entries, '', 'all');
    expect(result.length).toBe(3);
  });

  it('results are sorted by accessed_at descending', () => {
    const result = filterAndSortRecent(entries, '', 'all');
    expect(result[0].accessed_at).toBe(3000);
    expect(result[1].accessed_at).toBe(2000);
    expect(result[2].accessed_at).toBe(1000);
  });

  it('query does not match against directory portion', () => {
    const result = filterAndSortRecent(entries, 'user', 'all');
    expect(result.length).toBe(0);
  });
});

describe('formatAccessedAt', () => {
  it('returns 今日 HH:mm for a timestamp from today', () => {
    const now = new Date();
    now.setHours(14, 30, 0, 0);
    const result = formatAccessedAt(now.getTime());
    expect(result).toBe('今日 14:30');
  });

  it('returns 昨日 HH:mm for a timestamp from yesterday', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(9, 5, 0, 0);
    const result = formatAccessedAt(yesterday.getTime());
    expect(result).toBe('昨日 09:05');
  });

  it('returns M/D HH:mm for older timestamps', () => {
    const old = new Date(2025, 2, 15, 8, 0, 0, 0); // March 15, 2025
    const result = formatAccessedAt(old.getTime());
    expect(result).toBe('3/15 08:00');
  });
});
