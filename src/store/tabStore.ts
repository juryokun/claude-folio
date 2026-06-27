import { create } from 'zustand';
import type { Tab } from '../types';

// Use the HOME environment variable available via Tauri's shell context,
// falling back to a safe default. Will be updated by App.tsx on mount.
const HOME = '/Users';

function makeTab(path: string): Tab {
  return {
    id: crypto.randomUUID(),
    path,
    history: [path],
    historyIndex: 0,
  };
}

interface TabStore {
  tabs: Tab[];
  activeTabId: string;

  activeTab: () => Tab;
  openTab: (path?: string) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  nextTab: () => void;
  prevTab: () => void;
  navigateTo: (path: string) => void;
  goBack: () => void;
  goForward: () => void;
  reorderTabs: (from: number, to: number) => void;
}

const initialTab = makeTab(HOME);

export const useTabStore = create<TabStore>((set, get) => ({
  tabs: [initialTab],
  activeTabId: initialTab.id,

  activeTab: () => {
    const { tabs, activeTabId } = get();
    return tabs.find((t) => t.id === activeTabId) ?? tabs[0];
  },

  openTab: (path) => {
    const newTab = makeTab(path ?? get().activeTab().path);
    set((s) => ({ tabs: [...s.tabs, newTab], activeTabId: newTab.id }));
  },

  closeTab: (id) => {
    set((s) => {
      if (s.tabs.length === 1) return s;
      const idx = s.tabs.findIndex((t) => t.id === id);
      const newTabs = s.tabs.filter((t) => t.id !== id);
      const newActive =
        s.activeTabId === id
          ? (newTabs[Math.max(0, idx - 1)]?.id ?? newTabs[0].id)
          : s.activeTabId;
      return { tabs: newTabs, activeTabId: newActive };
    });
  },

  setActiveTab: (id) => set({ activeTabId: id }),

  nextTab: () => {
    const { tabs, activeTabId } = get();
    const idx = tabs.findIndex((t) => t.id === activeTabId);
    const next = tabs[(idx + 1) % tabs.length];
    set({ activeTabId: next.id });
  },

  prevTab: () => {
    const { tabs, activeTabId } = get();
    const idx = tabs.findIndex((t) => t.id === activeTabId);
    const prev = tabs[(idx - 1 + tabs.length) % tabs.length];
    set({ activeTabId: prev.id });
  },

  navigateTo: (path) => {
    set((s) => ({
      tabs: s.tabs.map((t) => {
        if (t.id !== s.activeTabId) return t;
        const newHistory = t.history.slice(0, t.historyIndex + 1).concat(path);
        return { ...t, path, history: newHistory, historyIndex: newHistory.length - 1 };
      }),
    }));
  },

  goBack: () => {
    set((s) => ({
      tabs: s.tabs.map((t) => {
        if (t.id !== s.activeTabId || t.historyIndex === 0) return t;
        const newIndex = t.historyIndex - 1;
        return { ...t, path: t.history[newIndex], historyIndex: newIndex };
      }),
    }));
  },

  goForward: () => {
    set((s) => ({
      tabs: s.tabs.map((t) => {
        if (t.id !== s.activeTabId || t.historyIndex >= t.history.length - 1) return t;
        const newIndex = t.historyIndex + 1;
        return { ...t, path: t.history[newIndex], historyIndex: newIndex };
      }),
    }));
  },

  reorderTabs: (from, to) => {
    set((s) => {
      const tabs = [...s.tabs];
      const [moved] = tabs.splice(from, 1);
      tabs.splice(to, 0, moved);
      return { tabs };
    });
  },
}));
