import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/tauri', () => ({
  tauriApi: {
    listDir: vi.fn(),
    zoxideAdd: vi.fn().mockResolvedValue(undefined),
    searchWithFd: vi.fn(),
  },
  isTauri: vi.fn().mockReturnValue(true),
}));

import { tauriApi } from '../../lib/tauri';
import type { FileEntry } from '../../types';
import { useFileStore } from '../fileStore';

const mockListDir = vi.mocked(tauriApi.listDir);
const mockSearchWithFd = vi.mocked(tauriApi.searchWithFd);

function entry(name: string, isDir = false, modified = 1000): FileEntry {
  return { name, path: `/test/${name}`, is_dir: isDir, is_symlink: false, size: 100, modified };
}

const TAB = 'tab-1';

function resetPane() {
  // replace=false でマージ。replace=true はアクション関数まで消してしまう
  useFileStore.setState({
    panes: {
      [TAB]: {
        entries: [],
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
        displayEntries: [],
        gitStatus: {},
      },
    },
    clipboard: null,
  });
}

describe('fileStore 統合テスト', () => {
  beforeEach(() => {
    resetPane();
    mockListDir.mockReset();
    mockSearchWithFd.mockReset();
  });

  // ── loadDir → filteredEntries ───────────────────────────────────────────────

  describe('loadDir → filteredEntries', () => {
    it('listDir の結果がストアに反映される', async () => {
      mockListDir.mockResolvedValue([entry('b.txt'), entry('a.txt')]);
      await useFileStore.getState().loadDir(TAB, '/test', false);
      const entries = useFileStore.getState().filteredEntries(TAB);
      expect(entries.map((e) => e.name)).toEqual(['a.txt', 'b.txt']);
    });

    it('ディレクトリはファイルより先に来る', async () => {
      mockListDir.mockResolvedValue([entry('z.txt'), entry('aaa', true)]);
      await useFileStore.getState().loadDir(TAB, '/test', false);
      const entries = useFileStore.getState().filteredEntries(TAB);
      expect(entries[0].is_dir).toBe(true);
      expect(entries[0].name).toBe('aaa');
    });

    it('エラー時は error フィールドが設定される', async () => {
      mockListDir.mockRejectedValue(new Error('permission denied'));
      await useFileStore.getState().loadDir(TAB, '/test', false);
      const pane = useFileStore.getState().getPane(TAB);
      expect(pane.error).toContain('permission denied');
    });

    it('loadDir 後にカーソルが 0 にリセットされる', async () => {
      mockListDir.mockResolvedValue([entry('a.txt'), entry('b.txt')]);
      useFileStore.getState().setCursor(TAB, 5);
      await useFileStore.getState().loadDir(TAB, '/test', false);
      expect(useFileStore.getState().getPane(TAB).cursor).toBe(0);
    });
  });

  // ── フィルタリング ─────────────────────────────────────────────────────────

  describe('setFilter → filteredEntries', () => {
    beforeEach(async () => {
      mockListDir.mockResolvedValue([
        entry('README.md'),
        entry('src', true),
        entry('package.json'),
        entry('tsconfig.json'),
      ]);
      await useFileStore.getState().loadDir(TAB, '/test', false);
    });

    it('クエリに一致するエントリのみ返す', () => {
      useFileStore.getState().setFilter(TAB, 'json');
      const entries = useFileStore.getState().filteredEntries(TAB);
      expect(entries.map((e) => e.name)).toEqual(['package.json', 'tsconfig.json']);
    });

    it('クエリ大文字小文字を無視する', () => {
      useFileStore.getState().setFilter(TAB, 'README');
      const entries = useFileStore.getState().filteredEntries(TAB);
      expect(entries[0].name).toBe('README.md');
    });

    it('空クエリで全エントリを返す', () => {
      useFileStore.getState().setFilter(TAB, 'json');
      useFileStore.getState().setFilter(TAB, '');
      const entries = useFileStore.getState().filteredEntries(TAB);
      expect(entries).toHaveLength(4);
    });

    it('フィルタ変更でカーソルが 0 にリセットされる', () => {
      useFileStore.getState().setCursor(TAB, 2);
      useFileStore.getState().setFilter(TAB, 'json');
      expect(useFileStore.getState().getPane(TAB).cursor).toBe(0);
    });
  });

  // ── ソート ─────────────────────────────────────────────────────────────────

  describe('setSort → filteredEntries', () => {
    beforeEach(async () => {
      mockListDir.mockResolvedValue([
        entry('b.txt', false, 3000),
        entry('a.txt', false, 1000),
        entry('c.txt', false, 2000),
      ]);
      await useFileStore.getState().loadDir(TAB, '/test', false);
    });

    it('名前昇順ソート', () => {
      useFileStore.getState().setSort(TAB, 'name', false);
      const names = useFileStore
        .getState()
        .filteredEntries(TAB)
        .map((e) => e.name);
      expect(names).toEqual(['a.txt', 'b.txt', 'c.txt']);
    });

    it('名前降順ソート', () => {
      useFileStore.getState().setSort(TAB, 'name', true);
      const names = useFileStore
        .getState()
        .filteredEntries(TAB)
        .map((e) => e.name);
      expect(names).toEqual(['c.txt', 'b.txt', 'a.txt']);
    });

    it('更新日時昇順ソート', () => {
      useFileStore.getState().setSort(TAB, 'time', false);
      const names = useFileStore
        .getState()
        .filteredEntries(TAB)
        .map((e) => e.name);
      expect(names).toEqual(['a.txt', 'c.txt', 'b.txt']);
    });

    it('更新日時降順ソート', () => {
      useFileStore.getState().setSort(TAB, 'time', true);
      const names = useFileStore
        .getState()
        .filteredEntries(TAB)
        .map((e) => e.name);
      expect(names).toEqual(['b.txt', 'c.txt', 'a.txt']);
    });
  });

  // ── 選択管理 ───────────────────────────────────────────────────────────────

  describe('toggleSelect / clearSelection', () => {
    beforeEach(async () => {
      mockListDir.mockResolvedValue([entry('a.txt'), entry('b.txt'), entry('c.txt')]);
      await useFileStore.getState().loadDir(TAB, '/test', false);
    });

    it('toggleSelect で選択・解除ができる', () => {
      useFileStore.getState().toggleSelect(TAB, '/test/a.txt');
      expect(useFileStore.getState().getPane(TAB).selected.has('/test/a.txt')).toBe(true);

      useFileStore.getState().toggleSelect(TAB, '/test/a.txt');
      expect(useFileStore.getState().getPane(TAB).selected.has('/test/a.txt')).toBe(false);
    });

    it('複数ファイルを個別に選択できる', () => {
      useFileStore.getState().toggleSelect(TAB, '/test/a.txt');
      useFileStore.getState().toggleSelect(TAB, '/test/c.txt');
      expect(useFileStore.getState().getPane(TAB).selected.size).toBe(2);
    });

    it('clearSelection で全選択が解除される', () => {
      useFileStore.getState().toggleSelect(TAB, '/test/a.txt');
      useFileStore.getState().toggleSelect(TAB, '/test/b.txt');
      useFileStore.getState().clearSelection(TAB);
      expect(useFileStore.getState().getPane(TAB).selected.size).toBe(0);
    });
  });

  // ── Visual mode（範囲選択） ────────────────────────────────────────────────

  describe('enterVisualMode / exitVisualMode / toggleVisualMode', () => {
    beforeEach(async () => {
      mockListDir.mockResolvedValue([
        entry('a.txt'),
        entry('b.txt'),
        entry('c.txt'),
        entry('d.txt'),
      ]);
      await useFileStore.getState().loadDir(TAB, '/test', false);
    });

    it('enterVisualMode で anchor がカーソル位置にセットされる', () => {
      useFileStore.getState().setCursor(TAB, 1);
      useFileStore.getState().enterVisualMode(TAB);
      const pane = useFileStore.getState().getPane(TAB);
      expect(pane.visualAnchor).toBe(1);
      expect(pane.selected.has('/test/b.txt')).toBe(true);
    });

    it('setCursor を繰り返すと選択範囲が伸縮する（下方向）', () => {
      useFileStore.getState().setCursor(TAB, 0);
      useFileStore.getState().enterVisualMode(TAB);
      useFileStore.getState().setCursor(TAB, 2);
      const selected = useFileStore.getState().getPane(TAB).selected;
      expect(selected).toEqual(new Set(['/test/a.txt', '/test/b.txt', '/test/c.txt']));
    });

    it('setCursor を繰り返すと選択範囲が伸縮する（上方向）', () => {
      useFileStore.getState().setCursor(TAB, 3);
      useFileStore.getState().enterVisualMode(TAB);
      useFileStore.getState().setCursor(TAB, 1);
      const selected = useFileStore.getState().getPane(TAB).selected;
      expect(selected).toEqual(new Set(['/test/b.txt', '/test/c.txt', '/test/d.txt']));
    });

    it('既存の選択（トグル選択）は visualBaseSelection として引き継がれる', () => {
      useFileStore.getState().toggleSelect(TAB, '/test/d.txt');
      useFileStore.getState().setCursor(TAB, 0);
      useFileStore.getState().enterVisualMode(TAB);
      useFileStore.getState().setCursor(TAB, 1);
      const selected = useFileStore.getState().getPane(TAB).selected;
      expect(selected).toEqual(new Set(['/test/a.txt', '/test/b.txt', '/test/d.txt']));
    });

    it('exitVisualMode で anchor は消えるが selected は保持される', () => {
      useFileStore.getState().setCursor(TAB, 0);
      useFileStore.getState().enterVisualMode(TAB);
      useFileStore.getState().setCursor(TAB, 2);
      useFileStore.getState().exitVisualMode(TAB);
      const pane = useFileStore.getState().getPane(TAB);
      expect(pane.visualAnchor).toBeNull();
      expect(pane.selected.size).toBe(3);
    });

    it('toggleVisualMode で開始・終了をトグルできる', () => {
      useFileStore.getState().toggleVisualMode(TAB);
      expect(useFileStore.getState().getPane(TAB).visualAnchor).not.toBeNull();
      useFileStore.getState().toggleVisualMode(TAB);
      expect(useFileStore.getState().getPane(TAB).visualAnchor).toBeNull();
    });

    it('loadDir（通常ナビゲーション）で visual mode がリセットされる', async () => {
      useFileStore.getState().enterVisualMode(TAB);
      mockListDir.mockResolvedValue([entry('a.txt'), entry('b.txt')]);
      await useFileStore.getState().loadDir(TAB, '/test', false);
      const pane = useFileStore.getState().getPane(TAB);
      expect(pane.visualAnchor).toBeNull();
      expect(pane.visualBaseSelection).toBeNull();
    });

    it('setFilter で displayEntries が変わると visual mode がリセットされる', () => {
      useFileStore.getState().enterVisualMode(TAB);
      useFileStore.getState().setFilter(TAB, 'a');
      const pane = useFileStore.getState().getPane(TAB);
      expect(pane.visualAnchor).toBeNull();
      expect(pane.visualBaseSelection).toBeNull();
    });

    it('setSort で displayEntries の並びが変わると visual mode がリセットされる', () => {
      useFileStore.getState().enterVisualMode(TAB);
      useFileStore.getState().setSort(TAB, 'name', true);
      const pane = useFileStore.getState().getPane(TAB);
      expect(pane.visualAnchor).toBeNull();
      expect(pane.visualBaseSelection).toBeNull();
    });

    it('startFind で visual mode がリセットされる', async () => {
      useFileStore.getState().enterVisualMode(TAB);
      mockSearchWithFd.mockResolvedValue([entry('found.txt')]);
      await useFileStore.getState().startFind(TAB, 'found', 'file', '/test');
      const pane = useFileStore.getState().getPane(TAB);
      expect(pane.visualAnchor).toBeNull();
      expect(pane.visualBaseSelection).toBeNull();
    });

    it('clearFind で visual mode がリセットされる', async () => {
      mockSearchWithFd.mockResolvedValue([entry('found.txt')]);
      await useFileStore.getState().startFind(TAB, 'found', 'file', '/test');
      useFileStore.getState().enterVisualMode(TAB);
      useFileStore.getState().clearFind(TAB);
      const pane = useFileStore.getState().getPane(TAB);
      expect(pane.visualAnchor).toBeNull();
      expect(pane.visualBaseSelection).toBeNull();
    });
  });

  // ── クリップボード ─────────────────────────────────────────────────────────

  describe('setClipboard', () => {
    it('クリップボードに状態をセットできる', () => {
      useFileStore.getState().setClipboard({ paths: ['/test/a.txt'], mode: 'copy' });
      expect(useFileStore.getState().clipboard).toEqual({ paths: ['/test/a.txt'], mode: 'copy' });
    });

    it('null をセットするとクリップボードがクリアされる', () => {
      useFileStore.getState().setClipboard({ paths: ['/test/a.txt'], mode: 'copy' });
      useFileStore.getState().setClipboard(null);
      expect(useFileStore.getState().clipboard).toBeNull();
    });

    it('cut モードもセットできる', () => {
      useFileStore.getState().setClipboard({ paths: ['/test/b.txt'], mode: 'cut' });
      expect(useFileStore.getState().clipboard?.mode).toBe('cut');
    });
  });

  // ── setSort 後のカーソルリセット ───────────────────────────────────────────

  describe('setSort → カーソルリセット', () => {
    beforeEach(async () => {
      mockListDir.mockResolvedValue([entry('a.txt'), entry('b.txt'), entry('c.txt')]);
      await useFileStore.getState().loadDir(TAB, '/test', false);
    });

    it('setSort を呼ぶとカーソルが 0 にリセットされる', () => {
      useFileStore.getState().setCursor(TAB, 2);
      useFileStore.getState().setSort(TAB, 'name', true);
      expect(useFileStore.getState().getPane(TAB).cursor).toBe(0);
    });

    it('同じソートキーで降順→昇順に変更してもカーソルがリセットされる', () => {
      useFileStore.getState().setCursor(TAB, 1);
      useFileStore.getState().setSort(TAB, 'name', true);
      useFileStore.getState().setCursor(TAB, 2);
      useFileStore.getState().setSort(TAB, 'name', false);
      expect(useFileStore.getState().getPane(TAB).cursor).toBe(0);
    });
  });

  // ── フィルタ + ソートの組み合わせ ─────────────────────────────────────────

  describe('setFilter + setSort の組み合わせ', () => {
    beforeEach(async () => {
      mockListDir.mockResolvedValue([
        entry('c.json', false, 3000),
        entry('a.txt', false, 1000),
        entry('b.json', false, 2000),
      ]);
      await useFileStore.getState().loadDir(TAB, '/test', false);
    });

    it('フィルタ後にソートが正しく効く', () => {
      useFileStore.getState().setFilter(TAB, 'json');
      useFileStore.getState().setSort(TAB, 'name', false);
      const names = useFileStore
        .getState()
        .filteredEntries(TAB)
        .map((e) => e.name);
      expect(names).toEqual(['b.json', 'c.json']);
    });

    it('フィルタ後に降順ソートが効く', () => {
      useFileStore.getState().setFilter(TAB, 'json');
      useFileStore.getState().setSort(TAB, 'name', true);
      const names = useFileStore
        .getState()
        .filteredEntries(TAB)
        .map((e) => e.name);
      expect(names).toEqual(['c.json', 'b.json']);
    });

    it('フィルタ後に時刻ソートが効く', () => {
      useFileStore.getState().setFilter(TAB, 'json');
      useFileStore.getState().setSort(TAB, 'time', false);
      const names = useFileStore
        .getState()
        .filteredEntries(TAB)
        .map((e) => e.name);
      expect(names).toEqual(['b.json', 'c.json']);
    });

    it('フィルタをクリアするとソート済み全件が返る', () => {
      useFileStore.getState().setFilter(TAB, 'json');
      useFileStore.getState().setSort(TAB, 'name', false);
      useFileStore.getState().setFilter(TAB, '');
      const names = useFileStore
        .getState()
        .filteredEntries(TAB)
        .map((e) => e.name);
      expect(names).toEqual(['a.txt', 'b.json', 'c.json']);
    });
  });

  // ── preserveCursor モード ──────────────────────────────────────────────────

  describe('loadDir with preserveCursor=true', () => {
    it('カーソル位置を保持したままエントリを更新する', async () => {
      mockListDir.mockResolvedValue([entry('a.txt'), entry('b.txt'), entry('c.txt')]);
      await useFileStore.getState().loadDir(TAB, '/test', false);
      useFileStore.getState().setCursor(TAB, 2);

      mockListDir.mockResolvedValue([
        entry('a.txt'),
        entry('b.txt'),
        entry('c.txt'),
        entry('d.txt'),
      ]);
      await useFileStore.getState().loadDir(TAB, '/test', false, true);

      expect(useFileStore.getState().getPane(TAB).cursor).toBe(2);
    });

    it('エントリ数が減った場合はカーソルをクランプする', async () => {
      mockListDir.mockResolvedValue([entry('a.txt'), entry('b.txt'), entry('c.txt')]);
      await useFileStore.getState().loadDir(TAB, '/test', false);
      useFileStore.getState().setCursor(TAB, 2);

      mockListDir.mockResolvedValue([entry('a.txt')]);
      await useFileStore.getState().loadDir(TAB, '/test', false, true);

      expect(useFileStore.getState().getPane(TAB).cursor).toBe(0);
    });

    it('findMode 中に loadDir しても検索結果を維持する（タブ切り替え相当）', async () => {
      mockSearchWithFd.mockResolvedValue([entry('found.txt')]);
      await useFileStore.getState().startFind(TAB, 'found', 'file', '/test');

      mockListDir.mockResolvedValue([entry('a.txt'), entry('b.txt')]);
      await useFileStore.getState().loadDir(TAB, '/test', false, true);

      const pane = useFileStore.getState().getPane(TAB);
      expect(pane.findMode?.query).toBe('found');
      expect(
        useFileStore
          .getState()
          .filteredEntries(TAB)
          .map((e) => e.name),
      ).toEqual(['found.txt']);
    });
  });

  describe('loadDir with preserveCursor=false（通常のナビゲーション）', () => {
    it('findMode 中に通常ナビゲーションすると検索結果がクリアされる', async () => {
      mockSearchWithFd.mockResolvedValue([entry('found.txt')]);
      await useFileStore.getState().startFind(TAB, 'found', 'file', '/test');

      mockListDir.mockResolvedValue([entry('a.txt'), entry('b.txt')]);
      await useFileStore.getState().loadDir(TAB, '/test', false);

      const pane = useFileStore.getState().getPane(TAB);
      expect(pane.findMode).toBeNull();
      expect(
        useFileStore
          .getState()
          .filteredEntries(TAB)
          .map((e) => e.name),
      ).toEqual(['a.txt', 'b.txt']);
    });
  });

  // ── setPendingFocusName ────────────────────────────────────────────────────

  describe('setPendingFocusName', () => {
    it('loadDir 後にカーソルが指定エントリ名の位置に移動する', async () => {
      useFileStore.getState().setPendingFocusName(TAB, 'c.txt');
      mockListDir.mockResolvedValue([entry('a.txt'), entry('b.txt'), entry('c.txt')]);
      await useFileStore.getState().loadDir(TAB, '/test', false);
      expect(useFileStore.getState().getPane(TAB).cursor).toBe(2);
    });

    it('loadDir 後に pendingFocusName が null にリセットされる', async () => {
      useFileStore.getState().setPendingFocusName(TAB, 'b.txt');
      mockListDir.mockResolvedValue([entry('a.txt'), entry('b.txt')]);
      await useFileStore.getState().loadDir(TAB, '/test', false);
      expect(useFileStore.getState().getPane(TAB).pendingFocusName).toBeNull();
    });

    it('存在しない名前を指定した場合はカーソルが 0 になる', async () => {
      useFileStore.getState().setPendingFocusName(TAB, 'ghost.txt');
      mockListDir.mockResolvedValue([entry('a.txt'), entry('b.txt')]);
      await useFileStore.getState().loadDir(TAB, '/test', false);
      expect(useFileStore.getState().getPane(TAB).cursor).toBe(0);
    });

    it('pendingFocusName を null にセットすると無効化される', async () => {
      useFileStore.getState().setPendingFocusName(TAB, 'b.txt');
      useFileStore.getState().setPendingFocusName(TAB, null);
      mockListDir.mockResolvedValue([entry('a.txt'), entry('b.txt'), entry('c.txt')]);
      await useFileStore.getState().loadDir(TAB, '/test', false);
      expect(useFileStore.getState().getPane(TAB).cursor).toBe(0);
    });
  });
});
