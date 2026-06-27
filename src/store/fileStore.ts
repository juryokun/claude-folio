import { create } from 'zustand';
import type { FileEntry, ClipboardState } from '../types';
import { tauriApi, isTauri } from '../lib/tauri';

interface PaneState {
  entries: FileEntry[];
  loading: boolean;
  error: string | null;
  cursor: number;
  selected: Set<string>; // selected paths
  filterQuery: string;
  pendingFocusName: string | null; // entry name to focus after next load
}

interface FileStore {
  panes: Record<string, PaneState>;
  clipboard: ClipboardState | null;

  getPane: (tabId: string) => PaneState;
  loadDir: (tabId: string, path: string, showHidden: boolean) => Promise<void>;
  setPendingFocusName: (tabId: string, name: string | null) => void;
  setCursor: (tabId: string, index: number) => void;
  toggleSelect: (tabId: string, path: string) => void;
  clearSelection: (tabId: string) => void;
  setFilter: (tabId: string, query: string) => void;
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
});

export const useFileStore = create<FileStore>((set, get) => ({
  panes: {},
  clipboard: null,

  getPane: (tabId) => get().panes[tabId] ?? defaultPane(),

  loadDir: async (tabId, path, showHidden) => {
    if (!isTauri()) return;
    set((s) => ({
      panes: {
        ...s.panes,
        [tabId]: { ...(s.panes[tabId] ?? defaultPane()), loading: true, error: null },
      },
    }));
    try {
      const entries = await tauriApi.listDir(path, showHidden);
      set((s) => {
        const pane = s.panes[tabId] ?? defaultPane();
        const focusName = pane.pendingFocusName;
        const cursor = focusName
          ? Math.max(0, entries.findIndex((e) => e.name === focusName))
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
      // Keep zoxide in sync (fire and forget)
      tauriApi.zoxideAdd(path).catch(() => {});
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

  setClipboard: (state) => set({ clipboard: state }),

  filteredEntries: (tabId) => {
    const pane = get().panes[tabId] ?? defaultPane();
    if (!pane.filterQuery) return pane.entries;
    const q = pane.filterQuery.toLowerCase();
    return pane.entries.filter((e) => e.name.toLowerCase().includes(q));
  },
}));
