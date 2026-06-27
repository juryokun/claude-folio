import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock ファクトリ内では外部変数を参照できないため、
// モック関数はファクトリ内で vi.fn() として定義し、
// インポート後に vi.mocked() で取得する
vi.mock('../../lib/tauri', () => ({
  tauriApi: {
    loadBookmarks: vi.fn(),
    saveBookmarks: vi.fn(),
  },
  isTauri: vi.fn().mockReturnValue(true),
}));

import { useBookmarkStore } from '../bookmarkStore';
import { tauriApi } from '../../lib/tauri';

const mockLoadBookmarks = vi.mocked(tauriApi.loadBookmarks);
const mockSaveBookmarks = vi.mocked(tauriApi.saveBookmarks);

function resetStore() {
  useBookmarkStore.setState({ bookmarks: [] });
  mockSaveBookmarks.mockResolvedValue(undefined);
}

describe('bookmarkStore 統合テスト', () => {
  beforeEach(() => {
    resetStore();
    mockLoadBookmarks.mockReset();
    mockSaveBookmarks.mockReset();
    mockSaveBookmarks.mockResolvedValue(undefined);
  });

  // ── loadBookmarks ──────────────────────────────────────────────────────────

  describe('loadBookmarks', () => {
    it('API の結果をストアに読み込む', async () => {
      mockLoadBookmarks.mockResolvedValue([
        { label: 'Home', path: '/Users/test' },
        { label: 'Work', path: '/Users/test/work' },
      ]);
      await useBookmarkStore.getState().loadBookmarks();
      const { bookmarks } = useBookmarkStore.getState();
      expect(bookmarks).toHaveLength(2);
      expect(bookmarks[0].label).toBe('Home');
      expect(bookmarks[1].label).toBe('Work');
    });

    it('各ブックマークに一意の id が付与される', async () => {
      mockLoadBookmarks.mockResolvedValue([
        { label: 'A', path: '/a' },
        { label: 'B', path: '/b' },
      ]);
      await useBookmarkStore.getState().loadBookmarks();
      const { bookmarks } = useBookmarkStore.getState();
      expect(bookmarks[0].id).toBeTruthy();
      expect(bookmarks[1].id).toBeTruthy();
      expect(bookmarks[0].id).not.toBe(bookmarks[1].id);
    });

    it('空リストの場合はストアも空になる', async () => {
      mockLoadBookmarks.mockResolvedValue([]);
      await useBookmarkStore.getState().loadBookmarks();
      expect(useBookmarkStore.getState().bookmarks).toHaveLength(0);
    });
  });

  // ── addBookmark ────────────────────────────────────────────────────────────

  describe('addBookmark', () => {
    it('ブックマークを追加して永続化する', async () => {
      await useBookmarkStore.getState().addBookmark('Projects', '/projects');
      const { bookmarks } = useBookmarkStore.getState();
      expect(bookmarks).toHaveLength(1);
      expect(bookmarks[0].label).toBe('Projects');
      expect(bookmarks[0].path).toBe('/projects');
      expect(mockSaveBookmarks).toHaveBeenCalledWith([{ label: 'Projects', path: '/projects' }]);
    });

    it('複数追加するとリストに積み上がる', async () => {
      await useBookmarkStore.getState().addBookmark('A', '/a');
      await useBookmarkStore.getState().addBookmark('B', '/b');
      expect(useBookmarkStore.getState().bookmarks).toHaveLength(2);
    });

    it('追加のたびに saveBookmarks が呼ばれる', async () => {
      await useBookmarkStore.getState().addBookmark('A', '/a');
      await useBookmarkStore.getState().addBookmark('B', '/b');
      expect(mockSaveBookmarks).toHaveBeenCalledTimes(2);
    });
  });

  // ── removeBookmark ─────────────────────────────────────────────────────────

  describe('removeBookmark', () => {
    it('id で指定したブックマークを削除する', async () => {
      await useBookmarkStore.getState().addBookmark('Target', '/target');
      const id = useBookmarkStore.getState().bookmarks[0].id;
      await useBookmarkStore.getState().removeBookmark(id);
      expect(useBookmarkStore.getState().bookmarks).toHaveLength(0);
    });

    it('他のブックマークには影響しない', async () => {
      await useBookmarkStore.getState().addBookmark('A', '/a');
      await useBookmarkStore.getState().addBookmark('B', '/b');
      const idA = useBookmarkStore.getState().bookmarks[0].id;
      await useBookmarkStore.getState().removeBookmark(idA);
      const remaining = useBookmarkStore.getState().bookmarks;
      expect(remaining).toHaveLength(1);
      expect(remaining[0].label).toBe('B');
    });

    it('削除後に saveBookmarks が空リストで呼ばれる', async () => {
      await useBookmarkStore.getState().addBookmark('A', '/a');
      mockSaveBookmarks.mockClear();
      const id = useBookmarkStore.getState().bookmarks[0].id;
      await useBookmarkStore.getState().removeBookmark(id);
      expect(mockSaveBookmarks).toHaveBeenCalledWith([]);
    });
  });

  // ── reorderBookmarks ───────────────────────────────────────────────────────

  describe('reorderBookmarks', () => {
    beforeEach(async () => {
      await useBookmarkStore.getState().addBookmark('A', '/a');
      await useBookmarkStore.getState().addBookmark('B', '/b');
      await useBookmarkStore.getState().addBookmark('C', '/c');
      mockSaveBookmarks.mockClear();
    });

    it('先頭アイテムを末尾へ移動できる', async () => {
      await useBookmarkStore.getState().reorderBookmarks(0, 2);
      const labels = useBookmarkStore.getState().bookmarks.map(b => b.label);
      expect(labels).toEqual(['B', 'C', 'A']);
    });

    it('末尾アイテムを先頭へ移動できる', async () => {
      await useBookmarkStore.getState().reorderBookmarks(2, 0);
      const labels = useBookmarkStore.getState().bookmarks.map(b => b.label);
      expect(labels).toEqual(['C', 'A', 'B']);
    });

    it('並べ替え後に saveBookmarks が呼ばれる', async () => {
      await useBookmarkStore.getState().reorderBookmarks(0, 2);
      expect(mockSaveBookmarks).toHaveBeenCalledTimes(1);
    });

    it('saveBookmarks には並べ替え後の順序が渡される', async () => {
      await useBookmarkStore.getState().reorderBookmarks(0, 2);
      const saved = mockSaveBookmarks.mock.calls[0][0] as { label: string; path: string }[];
      expect(saved.map(b => b.label)).toEqual(['B', 'C', 'A']);
    });
  });

  // ── add → remove → reorder の連鎖 ─────────────────────────────────────────

  describe('CRUD フロー全体', () => {
    it('追加・削除・並べ替えの連鎖が正しく動作する', async () => {
      await useBookmarkStore.getState().addBookmark('Alpha', '/alpha');
      await useBookmarkStore.getState().addBookmark('Beta',  '/beta');
      await useBookmarkStore.getState().addBookmark('Gamma', '/gamma');
      expect(useBookmarkStore.getState().bookmarks).toHaveLength(3);

      const betaId = useBookmarkStore.getState().bookmarks.find(b => b.label === 'Beta')!.id;
      await useBookmarkStore.getState().removeBookmark(betaId);
      expect(useBookmarkStore.getState().bookmarks.map(b => b.label)).toEqual(['Alpha', 'Gamma']);

      await useBookmarkStore.getState().reorderBookmarks(0, 1);
      expect(useBookmarkStore.getState().bookmarks.map(b => b.label)).toEqual(['Gamma', 'Alpha']);
    });
  });
});
