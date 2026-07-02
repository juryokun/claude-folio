import { describe, expect, it } from 'vitest';
import type { RecentEntry } from '../recentHistory';
import { filterAndSortRecent, formatRecentDate } from '../recentHistory';

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

describe('formatRecentDate', () => {
  it('returns today label and HH:MM:SS for a timestamp from today', () => {
    const now = new Date();
    now.setHours(14, 30, 45, 0);
    const result = formatRecentDate(now.getTime(), 'Today', 'Yesterday');
    expect(result).toEqual({ label: 'Today', time: '14:30:45' });
  });

  it('uses provided today/yesterday labels', () => {
    const now = new Date();
    now.setHours(9, 5, 0, 0);
    const result = formatRecentDate(now.getTime(), '今日', '昨日');
    expect(result.label).toBe('今日');
  });

  it('returns yesterday label and HH:MM:SS for yesterday', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(9, 5, 0, 0);
    const result = formatRecentDate(yesterday.getTime(), 'Today', 'Yesterday');
    expect(result).toEqual({ label: 'Yesterday', time: '09:05:00' });
  });

  it('returns YYYY/MM/DD and HH:MM:SS for older timestamps', () => {
    const old = new Date(2025, 2, 15, 8, 0, 0, 0); // March 15, 2025
    const result = formatRecentDate(old.getTime(), 'Today', 'Yesterday');
    expect(result).toEqual({ label: '2025/03/15', time: '08:00:00' });
  });
});
