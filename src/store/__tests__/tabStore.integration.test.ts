import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/tauri', () => ({
  tauriApi: { zoxideAdd: vi.fn().mockResolvedValue(undefined) },
  isTauri: vi.fn().mockReturnValue(true),
}));

import { useTabStore, setHomeDir } from '../tabStore';
import type { Tab } from '../../types';

function makeTab(path: string): Tab {
  return { id: crypto.randomUUID(), path, history: [path], historyIndex: 0 };
}

function reset(path = '/Users/test'): Tab {
  const tab = makeTab(path);
  // replace=false でマージ。replace=true はアクション関数まで消してしまう
  useTabStore.setState({ tabs: [tab], activeTabId: tab.id });
  return tab;
}

describe('tabStore 統合テスト', () => {
  beforeEach(() => {
    setHomeDir('/Users/test');
    reset();
  });

  // ── タブの開閉 ──────────────────────────────────────────────────────────────

  describe('openTab', () => {
    it('指定パスで新タブを開きアクティブにする', () => {
      useTabStore.getState().openTab('/tmp');
      const { tabs, activeTabId } = useTabStore.getState();
      expect(tabs).toHaveLength(2);
      expect(tabs[1].path).toBe('/tmp');
      expect(activeTabId).toBe(tabs[1].id);
    });

    it('パス省略時は現在タブのパスを引き継ぐ', () => {
      reset('/Users/test/docs');
      useTabStore.getState().openTab();
      expect(useTabStore.getState().tabs[1].path).toBe('/Users/test/docs');
    });

    it('複数タブを連続して開ける', () => {
      useTabStore.getState().openTab('/a');
      useTabStore.getState().openTab('/b');
      useTabStore.getState().openTab('/c');
      expect(useTabStore.getState().tabs).toHaveLength(4);
    });
  });

  describe('closeTab', () => {
    it('最後の1タブは閉じない', () => {
      const { tabs } = useTabStore.getState();
      useTabStore.getState().closeTab(tabs[0].id);
      expect(useTabStore.getState().tabs).toHaveLength(1);
    });

    it('タブを閉じると隣接タブがアクティブになる', () => {
      useTabStore.getState().openTab('/a');
      useTabStore.getState().openTab('/b');
      const { tabs } = useTabStore.getState();
      const [t0, t1] = tabs;
      useTabStore.setState({ activeTabId: t1.id });
      useTabStore.getState().closeTab(t1.id);
      expect(useTabStore.getState().activeTabId).toBe(t0.id);
    });

    it('末尾タブを閉じると直前タブがアクティブになる', () => {
      useTabStore.getState().openTab('/a');
      const { tabs } = useTabStore.getState();
      const lastId = tabs[tabs.length - 1].id;
      useTabStore.setState({ activeTabId: lastId });
      useTabStore.getState().closeTab(lastId);
      const state = useTabStore.getState();
      expect(state.activeTabId).toBe(state.tabs[state.tabs.length - 1].id);
    });
  });

  // ── タブ切り替え ────────────────────────────────────────────────────────────

  describe('nextTab / prevTab', () => {
    it('nextTab で次のタブに移動する', () => {
      useTabStore.getState().openTab('/a');
      const t0id = useTabStore.getState().tabs[0].id;
      useTabStore.setState({ activeTabId: t0id });

      useTabStore.getState().nextTab();
      expect(useTabStore.getState().activeTabId).toBe(useTabStore.getState().tabs[1].id);
    });

    it('末尾で nextTab すると先頭に戻る（ループ）', () => {
      useTabStore.getState().openTab('/a');
      const { tabs } = useTabStore.getState();
      useTabStore.setState({ activeTabId: tabs[tabs.length - 1].id });

      useTabStore.getState().nextTab();
      expect(useTabStore.getState().activeTabId).toBe(tabs[0].id);
    });

    it('先頭で prevTab すると末尾に移動する（ループ）', () => {
      useTabStore.getState().openTab('/a');
      const { tabs } = useTabStore.getState();
      useTabStore.setState({ activeTabId: tabs[0].id });

      useTabStore.getState().prevTab();
      expect(useTabStore.getState().activeTabId).toBe(tabs[tabs.length - 1].id);
    });
  });

  // ── ナビゲーション履歴 ─────────────────────────────────────────────────────

  describe('navigateTo / goBack / goForward', () => {
    it('navigateTo でパスが更新され履歴が追記される', () => {
      useTabStore.getState().navigateTo('/Users/test/docs');
      const tab = useTabStore.getState().activeTab();
      expect(tab.path).toBe('/Users/test/docs');
      expect(tab.history).toHaveLength(2);
      expect(tab.historyIndex).toBe(1);
    });

    it('goBack で直前のパスに戻る', () => {
      useTabStore.getState().navigateTo('/step1');
      useTabStore.getState().navigateTo('/step2');
      useTabStore.getState().goBack();
      expect(useTabStore.getState().activeTab().path).toBe('/step1');
    });

    it('goBack → goForward で元に戻る', () => {
      useTabStore.getState().navigateTo('/step1');
      useTabStore.getState().navigateTo('/step2');
      useTabStore.getState().goBack();
      useTabStore.getState().goForward();
      expect(useTabStore.getState().activeTab().path).toBe('/step2');
    });

    it('先頭より前に goBack しても何も起きない', () => {
      useTabStore.getState().goBack();
      expect(useTabStore.getState().activeTab().historyIndex).toBe(0);
    });

    it('末尾より先に goForward しても何も起きない', () => {
      useTabStore.getState().navigateTo('/step1');
      useTabStore.getState().goForward();
      expect(useTabStore.getState().activeTab().path).toBe('/step1');
    });

    it('goBack 後に navigateTo すると未来の履歴が切り捨てられる', () => {
      const initialPath = useTabStore.getState().activeTab().path;
      useTabStore.getState().navigateTo('/a');
      useTabStore.getState().navigateTo('/b');
      useTabStore.getState().goBack();    // /a にいる
      useTabStore.getState().navigateTo('/c');
      const tab = useTabStore.getState().activeTab();
      expect(tab.history).toEqual([initialPath, '/a', '/c']);
      expect(tab.path).toBe('/c');
    });

    it('チルダを含むパスをホームディレクトリに展開する', () => {
      useTabStore.getState().navigateTo('~/docs');
      expect(useTabStore.getState().activeTab().path).toBe('/Users/test/docs');
    });
  });

  // ── タブの並べ替え ──────────────────────────────────────────────────────────

  describe('reorderTabs', () => {
    it('タブを別の位置に移動できる', () => {
      useTabStore.getState().openTab('/a');
      useTabStore.getState().openTab('/b');
      const before = useTabStore.getState().tabs.map(t => t.path);

      useTabStore.getState().reorderTabs(0, 2);

      const after = useTabStore.getState().tabs.map(t => t.path);
      expect(after[0]).toBe(before[1]);
      expect(after[2]).toBe(before[0]);
    });
  });
});
