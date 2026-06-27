import { create } from 'zustand';
import type { FileEntry, ClipboardState } from '../types';
import { tauriApi, isTauri } from '../lib/tauri';

export type SortKey = 'name' | 'time';

interface PaneState {
  entries: FileEntry[];
  loading: boolean;
  error: string | null;
  cursor: number;
  selected: Set<string>; // selected paths
  filterQuery: string;
  pendingFocusName: string | null; // entry name to focus after next load
  sortKey: SortKey;
  sortDesc: boolean;
}

interface FileStore {
  panes: Record<string, PaneState>;
  clipboard: ClipboardState | null;

  getPane: (tabId: string) => PaneState;
  loadDir: (tabId: string, path: string, showHidden: boolean, preserveCursor?: boolean) => Promise<void>;
  setPendingFocusName: (tabId: string, name: string | null) => void;
  setCursor: (tabId: string, index: number) => void;
  toggleSelect: (tabId: string, path: string) => void;
  clearSelection: (tabId: string) => void;
  setFilter: (tabId: string, query: string) => void;
  setSort: (tabId: string, key: SortKey, desc: boolean) => void;
  setClipboard: (state: ClipboardState | null) => void;
  filteredEntries: (tabId: string) => FileEntry[];
}

const defaultPane = (): PaneState => ({
  entries: [],
  loading: false,
  error: null,
  cursor: 0,
  selected: new Set(),
  filterQuery: '',
  pendingFocusName: null,
  sortKey: 'name',
  sortDesc: false,
});

export const useFileStore = create<FileStore>((set, get) => ({
  panes: {},
  clipboard: null,

  getPane: (tabId) => get().panes[tabId] ?? defaultPane(),

  loadDir: async (tabId, path, showHidden, preserveCursor = false) => {
    if (!isTauri()) return;
    // When preserving cursor, skip the loading spinner to avoid flicker
    if (!preserveCursor) {
      set((s) => ({
        panes: {
          ...s.panes,
          [tabId]: { ...(s.panes[tabId] ?? defaultPane()), loading: true, error: null },
        },
      }));
    }
    try {
      const entries = await tauriApi.listDir(path, showHidden);
      set((s) => {
        const pane = s.panes[tabId] ?? defaultPane();
        if (preserveCursor) {
          // Keep cursor, selection, and filter as-is; just update the entries
          const clampedCursor = Math.min(pane.cursor, Math.max(0, entries.length - 1));
          return {
            panes: {
              ...s.panes,
              [tabId]: { ...pane, entries, loading: false, error: null, cursor: clampedCursor },
            },
          };
        }
        const focusName = pane.pendingFocusName;
        // Find cursor in the sorted order, not raw order
        const { sortKey, sortDesc } = pane;
        const sorted = [...entries].sort((a, b) => {
          if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
          const cmp = sortKey === 'name'
            ? a.name.localeCompare(b.name, 'ja')
            : (a.modified ?? 0) - (b.modified ?? 0);
          return sortDesc ? -cmp : cmp;
        });
        const cursor = focusName
          ? Math.max(0, sorted.findIndex((e) => e.name === focusName))
          : 0;
        return {
          panes: {
            ...s.panes,
            [tabId]: {
              ...pane,
              entries,
              loading: false,
              error: null,
              cursor,
              selected: new Set(),
              filterQuery: '',
              pendingFocusName: null,
            },
          },
        };
      });

    } catch (e) {
      set((s) => ({
        panes: {
          ...s.panes,
          [tabId]: {
            ...(s.panes[tabId] ?? defaultPane()),
            loading: false,
            error: String(e),
          },
        },
      }));
    }
  },

  setCursor: (tabId, index) => {
    set((s) => {
      const pane = s.panes[tabId] ?? defaultPane();
      return {
        panes: { ...s.panes, [tabId]: { ...pane, cursor: Math.max(0, index) } },
      };
    });
  },

  toggleSelect: (tabId, path) => {
    set((s) => {
      const pane = s.panes[tabId] ?? defaultPane();
      const selected = new Set(pane.selected);
      if (selected.has(path)) selected.delete(path);
      else selected.add(path);
      return { panes: { ...s.panes, [tabId]: { ...pane, selected } } };
    });
  },

  clearSelection: (tabId) => {
    set((s) => {
      const pane = s.panes[tabId] ?? defaultPane();
      return { panes: { ...s.panes, [tabId]: { ...pane, selected: new Set() } } };
    });
  },

  setFilter: (tabId, query) => {
    set((s) => {
      const pane = s.panes[tabId] ?? defaultPane();
      return {
        panes: { ...s.panes, [tabId]: { ...pane, filterQuery: query, cursor: 0 } },
      };
    });
  },

  setPendingFocusName: (tabId, name) => {
    set((s) => {
      const pane = s.panes[tabId] ?? defaultPane();
      return { panes: { ...s.panes, [tabId]: { ...pane, pendingFocusName: name } } };
    });
  },

  setSort: (tabId, key, desc) => {
    set((s) => {
      const pane = s.panes[tabId] ?? defaultPane();
      return { panes: { ...s.panes, [tabId]: { ...pane, sortKey: key, sortDesc: desc, cursor: 0 } } };
    });
  },

  setClipboard: (state) => set({ clipboard: state }),

  filteredEntries: (tabId) => {
    const pane = get().panes[tabId] ?? defaultPane();
    let entries = pane.filterQuery
      ? pane.entries.filter((e) => e.name.toLowerCase().includes(pane.filterQuery.toLowerCase()))
      : pane.entries;

    const { sortKey, sortDesc } = pane;
    entries = [...entries].sort((a, b) => {
      // Directories always first
      if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
      let cmp = 0;
      if (sortKey === 'name') {
        cmp = a.name.localeCompare(b.name, 'ja');
      } else {
        cmp = (a.modified ?? 0) - (b.modified ?? 0);
      }
      return sortDesc ? -cmp : cmp;
    });
    return entries;
  },
}));
