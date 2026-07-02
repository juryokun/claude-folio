import { create } from 'zustand';
import { matchesFilter, parseFilterQuery } from '../lib/searchFilter';
import { isTauri, tauriApi } from '../lib/tauri';
import { computeVisualSelection } from '../lib/visualSelection';
import type { ClipboardState, FileEntry } from '../types';
import { useTabStore } from './tabStore';

export type SortKey = 'name' | 'time';

export interface FindMode {
  query: string;
  type: 'file' | 'dir' | 'all';
  results: FileEntry[];
  loading: boolean;
}

interface PaneState {
  entries: FileEntry[];
  displayEntries: FileEntry[]; // pre-computed: sorted + filtered (or findMode results)
  gitStatus: Record<string, string>; // filename → symbol (M/A/D/U/?)
  loading: boolean;
  error: string | null;
  cursor: number;
  selected: Set<string>; // selected paths
  visualAnchor: number | null; // display index where visual mode started, or null if inactive
  visualBaseSelection: Set<string> | null; // selection snapshot taken when visual mode started
  filterQuery: string;
  pendingFocusName: string | null; // entry name to focus after next load
  sortKey: SortKey;
  sortDesc: boolean;
  findMode: FindMode | null;
}

interface FileStore {
  panes: Record<string, PaneState>;
  clipboard: ClipboardState | null;

  getPane: (tabId: string) => PaneState;
  loadDir: (
    tabId: string,
    path: string,
    showHidden: boolean,
    preserveCursor?: boolean,
  ) => Promise<void>;
  setPendingFocusName: (tabId: string, name: string | null) => void;
  setCursor: (tabId: string, index: number) => void;
  toggleSelect: (tabId: string, path: string) => void;
  clearSelection: (tabId: string) => void;
  enterVisualMode: (tabId: string) => void;
  exitVisualMode: (tabId: string) => void;
  toggleVisualMode: (tabId: string) => void;
  setFilter: (tabId: string, query: string) => void;
  setSort: (tabId: string, key: SortKey, desc: boolean) => void;
  setClipboard: (state: ClipboardState | null) => void;
  filteredEntries: (tabId: string) => FileEntry[];
  loadGitStatus: (tabId: string, path: string) => Promise<void>;
  startFind: (
    tabId: string,
    query: string,
    type: 'file' | 'dir' | 'all',
    root: string,
  ) => Promise<void>;
  clearFind: (tabId: string) => void;
}

function sortEntries(entries: FileEntry[], sortKey: SortKey, sortDesc: boolean): FileEntry[] {
  return [...entries].sort((a, b) => {
    if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
    const cmp =
      sortKey === 'name'
        ? a.name.localeCompare(b.name, 'ja')
        : (a.modified ?? 0) - (b.modified ?? 0);
    return sortDesc ? -cmp : cmp;
  });
}

function computeDisplayEntries(pane: PaneState): FileEntry[] {
  if (pane.findMode) return pane.findMode.results;
  const filter = parseFilterQuery(pane.filterQuery);
  const filtered = filter
    ? pane.entries.filter((e) => matchesFilter(e.name, filter))
    : pane.entries;
  return sortEntries(filtered, pane.sortKey, pane.sortDesc);
}

const defaultPane = (): PaneState => ({
  entries: [],
  displayEntries: [],
  gitStatus: {},
  loading: false,
  error: null,
  cursor: 0,
  selected: new Set(),
  visualAnchor: null,
  visualBaseSelection: null,
  filterQuery: '',
  pendingFocusName: null,
  sortKey: 'name',
  sortDesc: false,
  findMode: null,
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
          const clampedCursor = Math.min(pane.cursor, Math.max(0, entries.length - 1));
          const newPane: PaneState = {
            ...pane,
            entries,
            loading: false,
            error: null,
            cursor: clampedCursor,
          };
          return {
            panes: {
              ...s.panes,
              [tabId]: { ...newPane, displayEntries: computeDisplayEntries(newPane) },
            },
          };
        }
        const focusName = pane.pendingFocusName;
        const sorted = sortEntries(entries, pane.sortKey, pane.sortDesc);
        const cursor = focusName
          ? Math.max(
              0,
              sorted.findIndex((e) => e.name === focusName),
            )
          : 0;
        // filter and find mode are reset on navigation, so displayEntries = sorted
        return {
          panes: {
            ...s.panes,
            [tabId]: {
              ...pane,
              entries,
              displayEntries: sorted,
              loading: false,
              error: null,
              cursor,
              selected: new Set(),
              visualAnchor: null,
              visualBaseSelection: null,
              filterQuery: '',
              pendingFocusName: null,
              findMode: null,
            },
          },
        };
      });
    } catch (e) {
      const errStr = String(e);
      // If the directory was deleted, navigate up to the nearest existing parent
      if (errStr.includes('does not exist') || errStr.includes('No such file')) {
        const { activeTab, navigateTo } = useTabStore.getState();
        if (activeTab().id === tabId) {
          const parts = path.split('/').filter(Boolean);
          while (parts.length > 0) {
            parts.pop();
            const parent = `/${parts.join('/')}` || '/';
            try {
              await tauriApi.listDir(parent, false);
              navigateTo(parent);
              return;
            } catch {
              /* keep going up */
            }
          }
          navigateTo('/');
        }
        return;
      }
      set((s) => ({
        panes: {
          ...s.panes,
          [tabId]: {
            ...(s.panes[tabId] ?? defaultPane()),
            loading: false,
            error: errStr,
          },
        },
      }));
    }
  },

  setCursor: (tabId, index) => {
    set((s) => {
      const pane = s.panes[tabId] ?? defaultPane();
      const cursor = Math.max(0, index);
      if (pane.visualAnchor === null) {
        return { panes: { ...s.panes, [tabId]: { ...pane, cursor } } };
      }
      const selected = computeVisualSelection(
        pane.displayEntries,
        pane.visualAnchor,
        cursor,
        pane.visualBaseSelection ?? new Set(),
      );
      return { panes: { ...s.panes, [tabId]: { ...pane, cursor, selected } } };
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

  enterVisualMode: (tabId) => {
    set((s) => {
      const pane = s.panes[tabId] ?? defaultPane();
      const base = new Set(pane.selected);
      const selected = computeVisualSelection(pane.displayEntries, pane.cursor, pane.cursor, base);
      return {
        panes: {
          ...s.panes,
          [tabId]: { ...pane, visualAnchor: pane.cursor, visualBaseSelection: base, selected },
        },
      };
    });
  },

  exitVisualMode: (tabId) => {
    set((s) => {
      const pane = s.panes[tabId] ?? defaultPane();
      return {
        panes: {
          ...s.panes,
          [tabId]: { ...pane, visualAnchor: null, visualBaseSelection: null },
        },
      };
    });
  },

  toggleVisualMode: (tabId) => {
    const pane = get().panes[tabId] ?? defaultPane();
    if (pane.visualAnchor === null) get().enterVisualMode(tabId);
    else get().exitVisualMode(tabId);
  },

  setFilter: (tabId, query) => {
    set((s) => {
      const pane = s.panes[tabId] ?? defaultPane();
      const newPane: PaneState = {
        ...pane,
        filterQuery: query,
        cursor: 0,
        visualAnchor: null,
        visualBaseSelection: null,
      };
      return {
        panes: {
          ...s.panes,
          [tabId]: { ...newPane, displayEntries: computeDisplayEntries(newPane) },
        },
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
      const newPane: PaneState = {
        ...pane,
        sortKey: key,
        sortDesc: desc,
        cursor: 0,
        visualAnchor: null,
        visualBaseSelection: null,
      };
      return {
        panes: {
          ...s.panes,
          [tabId]: { ...newPane, displayEntries: computeDisplayEntries(newPane) },
        },
      };
    });
  },

  setClipboard: (state) => set({ clipboard: state }),

  // Thin getter — display list is pre-computed in each setter
  filteredEntries: (tabId) => get().panes[tabId]?.displayEntries ?? [],

  loadGitStatus: async (tabId, path) => {
    try {
      const status = await tauriApi.getGitStatus(path);
      set((s) => {
        const pane = s.panes[tabId];
        if (!pane) return s;
        return { panes: { ...s.panes, [tabId]: { ...pane, gitStatus: status } } };
      });
    } catch {
      // not a git repo or git not available — leave gitStatus empty
    }
  },

  startFind: async (tabId, query, type, root) => {
    set((s) => {
      const pane = s.panes[tabId] ?? defaultPane();
      const findMode: FindMode = { query, type, results: [], loading: true };
      return {
        panes: {
          ...s.panes,
          [tabId]: {
            ...pane,
            findMode,
            displayEntries: [],
            cursor: 0,
            visualAnchor: null,
            visualBaseSelection: null,
          },
        },
      };
    });
    try {
      const results = await tauriApi.searchWithFd(root, query, type);
      set((s) => {
        const pane = s.panes[tabId] ?? defaultPane();
        const findMode: FindMode = { query, type, results, loading: false };
        return {
          panes: {
            ...s.panes,
            [tabId]: { ...pane, findMode, displayEntries: results, cursor: 0 },
          },
        };
      });
    } catch {
      set((s) => {
        const pane = s.panes[tabId] ?? defaultPane();
        const findMode: FindMode = { query, type, results: [], loading: false };
        return {
          panes: {
            ...s.panes,
            [tabId]: { ...pane, findMode, displayEntries: [] },
          },
        };
      });
    }
  },

  clearFind: (tabId) => {
    set((s) => {
      const pane = s.panes[tabId] ?? defaultPane();
      const newPane: PaneState = {
        ...pane,
        findMode: null,
        cursor: 0,
        visualAnchor: null,
        visualBaseSelection: null,
      };
      return {
        panes: {
          ...s.panes,
          [tabId]: { ...newPane, displayEntries: computeDisplayEntries(newPane) },
        },
      };
    });
  },
}));
