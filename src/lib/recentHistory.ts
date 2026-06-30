import path from 'path-browserify';

export interface RecentEntry {
  path: string;
  kind: 'file' | 'dir';
  accessed_at: number;
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

export function formatAccessedAt(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();

  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();

  const hhmm = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  if (isToday) return `今日 ${hhmm}`;
  if (isYesterday) return `昨日 ${hhmm}`;

  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${m}/${d} ${hhmm}`;
}
