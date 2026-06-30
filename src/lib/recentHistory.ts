import path from 'path-browserify';

export interface RecentEntry {
  path: string;
  kind: 'file' | 'dir';
  accessed_at: number;
  modified?: number;
}

export type RecentMode = 'files' | 'all';

export function filterAndSortRecent(
  entries: RecentEntry[],
  query: string,
  mode: RecentMode,
): RecentEntry[] {
  let result = entries;

  if (mode === 'files') {
    result = result.filter((e) => e.kind === 'file');
  }

  if (query) {
    const lower = query.toLowerCase();
    result = result.filter((e) => path.basename(e.path).toLowerCase().includes(lower));
  }

  return [...result].sort((a, b) => b.accessed_at - a.accessed_at);
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatRecentDate(
  timestamp: number,
  todayLabel: string,
  yesterdayLabel: string,
): { label: string; time: string } {
  const d = new Date(timestamp);
  const now = new Date();
  const hms = [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
  if (sameDay(d, now)) return { label: todayLabel, time: hms };
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return { label: yesterdayLabel, time: hms };
  const label = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  return { label, time: hms };
}
