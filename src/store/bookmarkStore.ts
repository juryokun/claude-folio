import { create } from 'zustand';
import type { Bookmark } from '../types';
import { tauriApi } from '../lib/tauri';

interface BookmarkStore {
  bookmarks: Bookmark[];
  loadBookmarks: () => Promise<void>;
  addBookmark: (label: string, path: string) => Promise<void>;
  removeBookmark: (id: string) => Promise<void>;
  reorderBookmarks: (from: number, to: number) => Promise<void>;
}

async function persist(bookmarks: Bookmark[]) {
  await tauriApi.saveBookmarks(bookmarks.map(({ label, path }) => ({ label, path })));
}

export const useBookmarkStore = create<BookmarkStore>((set, get) => ({
  bookmarks: [],

  loadBookmarks: async () => {
    const entries = await tauriApi.loadBookmarks();
    const bookmarks = entries.map((e) => ({
      id: crypto.randomUUID(),
      label: e.label,
      path: e.path,
    }));
    set({ bookmarks });
  },

  addBookmark: async (label, path) => {
    const bookmark: Bookmark = { id: crypto.randomUUID(), label, path };
    const bookmarks = [...get().bookmarks, bookmark];
    set({ bookmarks });
    await persist(bookmarks);
  },

  removeBookmark: async (id) => {
    const bookmarks = get().bookmarks.filter((b) => b.id !== id);
    set({ bookmarks });
    await persist(bookmarks);
  },

  reorderBookmarks: async (from, to) => {
    const bm = [...get().bookmarks];
    const [moved] = bm.splice(from, 1);
    bm.splice(to, 0, moved);
    set({ bookmarks: bm });
    await persist(bm);
  },
}));
