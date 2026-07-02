import { create } from 'zustand';
import type { RecentEntry } from '../lib/recentHistory';
import { tauriApi } from '../lib/tauri';

interface RecentStore {
  entries: RecentEntry[];
  loadEntries: () => Promise<void>;
}

export const useRecentStore = create<RecentStore>((set) => ({
  entries: [],

  loadEntries: async () => {
    const raw = await tauriApi.loadRecentEntries();
    const entries: RecentEntry[] = raw.map((e) => ({
      path: e.path,
      kind: e.kind === 'file' || e.kind === 'dir' ? e.kind : 'file',
      accessed_at: e.accessed_at,
      modified: e.modified,
    }));
    set({ entries });
  },
}));
