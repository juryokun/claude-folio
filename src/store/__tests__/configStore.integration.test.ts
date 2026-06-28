import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/tauri', () => ({
  tauriApi: { loadConfig: vi.fn() },
  isTauri: vi.fn().mockReturnValue(true),
}));

const mockSetEditorCommand = vi.fn();
const mockSetTerminalApp = vi.fn();
const mockSetTerminalCommand = vi.fn();
const mockSetLanguage = vi.fn();

// configStore が動的インポートする uiStore をモック
// ※ 変数参照は vi.mock ファクトリ外（ホイスト後）なので問題ない
vi.mock('../uiStore', () => ({
  useUiStore: {
    getState: () => ({
      setEditorCommand: mockSetEditorCommand,
      setTerminalApp: mockSetTerminalApp,
      setTerminalCommand: mockSetTerminalCommand,
      setLanguage: mockSetLanguage,
    }),
  },
}));

import { tauriApi } from '../../lib/tauri';
import { NORMAL_KEYMAP } from '../../lib/vim/keymap';
import { useConfigStore } from '../configStore';

const mockLoadConfig = vi.mocked(tauriApi.loadConfig);

const DEFAULT_FAVORITES = [
  'home',
  'desktop',
  'documents',
  'downloads',
  'pictures',
  'music',
  'movies',
  'applications',
];

function resetStore() {
  useConfigStore.setState({
    appearance: {
      dateModified: { show: true, format: 'auto' },
      dateCreated: { show: false, format: 'auto' },
      dateAccessed: { show: false, format: 'auto' },
      gitStatus: { show: true },
      size: { show: true, unit: 'binary' },
    },
    visibleDateCols: [
      { key: 'modified', format: 'auto', colKey: 'date', labelKey: 'filePane.colDate' },
    ],
    keymap: NORMAL_KEYMAP,
    favorites: DEFAULT_FAVORITES as ReturnType<typeof useConfigStore.getState>['favorites'],
    loaded: false,
  });
}

describe('configStore 統合テスト', () => {
  beforeEach(() => {
    resetStore();
    mockLoadConfig.mockReset();
    mockSetEditorCommand.mockReset();
    mockSetTerminalApp.mockReset();
    mockSetTerminalCommand.mockReset();
    mockSetLanguage.mockReset();
  });

  // ── デフォルト設定での load ─────────────────────────────────────────────────

  describe('load() — デフォルト設定', () => {
    it('空のレスポンスでもデフォルト値でロードされる', async () => {
      mockLoadConfig.mockResolvedValue({});
      await useConfigStore.getState().load();
      const state = useConfigStore.getState();
      expect(state.loaded).toBe(true);
      expect(state.appearance.size.unit).toBe('binary');
    });

    it('load 後に loaded フラグが true になる', async () => {
      mockLoadConfig.mockResolvedValue({});
      await useConfigStore.getState().load();
      expect(useConfigStore.getState().loaded).toBe(true);
    });

    it('エラー時もデフォルトで loaded になる', async () => {
      mockLoadConfig.mockRejectedValue(new Error('network error'));
      await useConfigStore.getState().load();
      expect(useConfigStore.getState().loaded).toBe(true);
    });
  });

  // ── appearance 設定 ────────────────────────────────────────────────────────

  describe('load() — appearance', () => {
    it('size.unit "decimal" を反映する', async () => {
      mockLoadConfig.mockResolvedValue({ appearance: { size: { unit: 'decimal' } } });
      await useConfigStore.getState().load();
      expect(useConfigStore.getState().appearance.size.unit).toBe('decimal');
    });

    it('size が未指定の場合は unit "binary" のまま', async () => {
      mockLoadConfig.mockResolvedValue({ appearance: {} });
      await useConfigStore.getState().load();
      expect(useConfigStore.getState().appearance.size.unit).toBe('binary');
    });

    it('size.show=false で size 列が非表示になる', async () => {
      mockLoadConfig.mockResolvedValue({ appearance: { size: { show: false } } });
      await useConfigStore.getState().load();
      expect(useConfigStore.getState().appearance.size.show).toBe(false);
    });

    it('date_modified.show=true のとき visibleDateCols に modified が含まれる', async () => {
      mockLoadConfig.mockResolvedValue({
        appearance: { date_modified: { show: true, format: 'auto' } },
      });
      await useConfigStore.getState().load();
      const cols = useConfigStore.getState().visibleDateCols;
      expect(cols.some((c) => c.key === 'modified')).toBe(true);
    });

    it('date_modified.show=false のとき visibleDateCols に modified が含まれない', async () => {
      mockLoadConfig.mockResolvedValue({
        appearance: { date_modified: { show: false, format: 'auto' } },
      });
      await useConfigStore.getState().load();
      const cols = useConfigStore.getState().visibleDateCols;
      expect(cols.some((c) => c.key === 'modified')).toBe(false);
    });

    it('date_created.show=true のとき visibleDateCols に created が含まれる', async () => {
      mockLoadConfig.mockResolvedValue({
        appearance: { date_created: { show: true, format: '%Y-%m-%d' } },
      });
      await useConfigStore.getState().load();
      const cols = useConfigStore.getState().visibleDateCols;
      const col = cols.find((c) => c.key === 'created');
      expect(col).toBeDefined();
      expect(col?.format).toBe('%Y-%m-%d');
    });

    it('デフォルトで date_modified のみ表示される', async () => {
      mockLoadConfig.mockResolvedValue({});
      await useConfigStore.getState().load();
      const cols = useConfigStore.getState().visibleDateCols;
      expect(cols).toHaveLength(1);
      expect(cols[0].key).toBe('modified');
    });
  });

  // ── keymap 設定 ────────────────────────────────────────────────────────────

  describe('load() — keymap', () => {
    it('keymap が空の場合は NORMAL_KEYMAP を返す', async () => {
      mockLoadConfig.mockResolvedValue({ keymap: {} });
      await useConfigStore.getState().load();
      expect(useConfigStore.getState().keymap).toBe(NORMAL_KEYMAP);
    });

    it('カスタムキーマップで指定したアクションのバインドが置き換わる', async () => {
      mockLoadConfig.mockResolvedValue({ keymap: { cursor_down: ['n'] } });
      await useConfigStore.getState().load();
      const km = useConfigStore.getState().keymap;
      const binding = km.find((b) => b.action === 'cursor_down');
      expect(binding?.keys).toEqual(['n']);
    });

    it('カスタムキーマップで他のバインドは保持される', async () => {
      mockLoadConfig.mockResolvedValue({ keymap: { cursor_down: ['n'] } });
      await useConfigStore.getState().load();
      const km = useConfigStore.getState().keymap;
      expect(km.find((b) => b.action === 'cursor_up')).toBeDefined();
    });

    it('コードシーケンス "g g" が正しくパースされる', async () => {
      mockLoadConfig.mockResolvedValue({ keymap: { cursor_first: ['g g'] } });
      await useConfigStore.getState().load();
      const km = useConfigStore.getState().keymap;
      const binding = km.find((b) => b.action === 'cursor_first');
      expect(binding?.keys).toEqual(['g', 'g']);
    });
  });

  // ── favorites 設定 ─────────────────────────────────────────────────────────

  describe('load() — favorites', () => {
    it('sidebar.favorites を反映する', async () => {
      mockLoadConfig.mockResolvedValue({ sidebar: { favorites: ['home', 'downloads'] } });
      await useConfigStore.getState().load();
      expect(useConfigStore.getState().favorites).toEqual(['home', 'downloads']);
    });

    it('sidebar が未指定の場合はデフォルト favorites を維持', async () => {
      mockLoadConfig.mockResolvedValue({});
      await useConfigStore.getState().load();
      expect(useConfigStore.getState().favorites).toContain('home');
      expect(useConfigStore.getState().favorites).toContain('documents');
    });
  });

  // ── uiStore への委譲 ───────────────────────────────────────────────────────

  describe('load() — uiStore への委譲', () => {
    it('editor.command が指定された場合は setEditorCommand が呼ばれる', async () => {
      mockLoadConfig.mockResolvedValue({ editor: { command: 'nvim' } });
      await useConfigStore.getState().load();
      expect(mockSetEditorCommand).toHaveBeenCalledWith('nvim');
    });

    it('editor.command が空の場合は setEditorCommand を呼ばない', async () => {
      mockLoadConfig.mockResolvedValue({ editor: { command: '' } });
      await useConfigStore.getState().load();
      expect(mockSetEditorCommand).not.toHaveBeenCalled();
    });

    it('terminal.app が指定された場合は setTerminalApp が呼ばれる', async () => {
      mockLoadConfig.mockResolvedValue({ terminal: { app: 'iTerm' } });
      await useConfigStore.getState().load();
      expect(mockSetTerminalApp).toHaveBeenCalledWith('iTerm');
    });

    it('terminal.command が指定された場合は setTerminalCommand が呼ばれる', async () => {
      mockLoadConfig.mockResolvedValue({ terminal: { command: 'alacritty --working-directory' } });
      await useConfigStore.getState().load();
      expect(mockSetTerminalCommand).toHaveBeenCalledWith('alacritty --working-directory');
    });

    it('language が指定された場合は setLanguage が呼ばれる', async () => {
      mockLoadConfig.mockResolvedValue({ language: 'ja' });
      await useConfigStore.getState().load();
      expect(mockSetLanguage).toHaveBeenCalledWith('ja');
    });

    it('language が未指定の場合は "ja" でフォールバックして setLanguage が呼ばれる', async () => {
      mockLoadConfig.mockResolvedValue({});
      await useConfigStore.getState().load();
      expect(mockSetLanguage).toHaveBeenCalledWith('ja');
    });

    it('language = "en" が明示されていれば "en" で setLanguage が呼ばれる', async () => {
      mockLoadConfig.mockResolvedValue({ language: 'en' });
      await useConfigStore.getState().load();
      expect(mockSetLanguage).toHaveBeenCalledWith('en');
    });
  });
});
