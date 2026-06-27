import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Bookmark } from '../types';

interface BookmarkStore {
  bookmarks: Bookmark[];
  addBookmark: (label: string, path: string) => void;
  removeBookmark: (id: string) => void;
  reorderBookmarks: (from: number, to: number) => void;
}

export const useBookmarkStore = create<BookmarkStore>()(
  persist(
    (set) => ({
      bookmarks: [],

      addBookmark: (label, path) => {
        set((s) => ({
          bookmarks: [...s.bookmarks, { id: crypto.randomUUID(), label, path }],
        }));
      },

      removeBookmark: (id) => {
        set((s) => ({ bookmarks: s.bookmarks.filter((b) => b.id !== id) }));
      },

      reorderBookmarks: (from, to) => {
        set((s) => {
          const bm = [...s.bookmarks];
          const [moved] = bm.splice(from, 1);
          bm.splice(to, 0, moved);
          return { bookmarks: bm };
        });
      },
    }),
    { name: 'mac-filer-bookmarks' }
  )
);
