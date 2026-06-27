import { useEffect, useCallback, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { TabBar } from './components/tabs/TabBar';
import { Sidebar } from './components/sidebar/Sidebar';
import { FilePane } from './components/pane/FilePane';
import { PathBar } from './components/pane/PathBar';
import { StatusBar } from './components/pane/StatusBar';
import { SearchBar } from './components/search/SearchBar';
import { RenameModal } from './components/modals/RenameModal';
import { NewDirModal } from './components/modals/NewDirModal';
import { NewFileModal } from './components/modals/NewFileModal';
import { ConfirmModal } from './components/modals/ConfirmModal';
import { CommandPalette } from './components/modals/CommandPalette';
import { OpenWithModal } from './components/modals/OpenWithModal';
import { PreviewPanel } from './components/preview/PreviewPanel';
import { KeybindingsHelp } from './components/help/KeybindingsHelp';
import { useTabStore } from './store/tabStore';
import { useFileStore } from './store/fileStore';
import { useUiStore } from './store/uiStore';
import { useConfigStore } from './store/configStore';
import { useBookmarkStore } from './store/bookmarkStore';
import { useVimKeys } from './hooks/useVimKeys';
import { useFileOps } from './hooks/useFileOps';
import { tauriApi } from './lib/tauri';
import type { VimAction } from './lib/vim/keymap';
import './App.css';

async function getHomeDir(): Promise<string> {
  try {
    const { homeDir } = await import('@tauri-apps/api/path');
    return await homeDir();
  } catch {
    return '/Users';
  }
}

export default function App() {
  const { tabs, activeTab, navigateTo, openTab, closeTab, nextTab, prevTab, activeTabId, goBack, goForward } =
    useTabStore();
  const { loadDir, setCursor, getPane, filteredEntries, setSort } = useFileStore();
  const {
    showHidden, toggleHidden, setShowHelp, setVimMode, toggleSidebar, showSidebar,
    showPreview, togglePreview,
  } = useUiStore();

  const fileOps = useFileOps();
  const fileOpsRef = useRef(fileOps);
  fileOpsRef.current = fileOps;

  const loadConfig = useConfigStore((s) => s.load);
  const keymap = useConfigStore((s) => s.keymap);
  const loadBookmarks = useBookmarkStore((s) => s.loadBookmarks);

  // Resolve real home dir and navigate there on startup
  useEffect(() => {
    getHomeDir().then((home) => {
      (window as any).__macFilerUsername = home.split('/').pop();
      navigateTo(home);
    });

    loadConfig();
    loadBookmarks().catch(() => {});
    tauriApi.suppressDsStore().catch(() => {});
    tauriApi.check7zipInstalled().then(useUiStore.getState().setHas7zip).catch(() => {});
    tauriApi.checkZoxideInstalled().then(useUiStore.getState().setHasZoxide).catch(() => {});
  }, []);

  // Load directory when active tab path changes
  const currentTabPath = activeTab().path;
  const currentTabId = activeTab().id;
  useEffect(() => {
    loadDir(currentTabId, currentTabPath, showHidden);
  }, [currentTabId, currentTabPath, showHidden]);

  // Watch active directory for external changes; debounce to avoid rapid reloads
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showHiddenRef = useRef(showHidden);
  showHiddenRef.current = showHidden;

  useEffect(() => {
    tauriApi.watchDir(currentTabPath).catch(() => {});

    let cancelled = false;
    let unlistenFn: (() => void) | null = null;

    listen('mac-filer:dir-changed', () => {
      if (cancelled) return;
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
      reloadTimerRef.current = setTimeout(() => {
        const tab = useTabStore.getState().activeTab();
        loadDir(tab.id, tab.path, showHiddenRef.current, true);
      }, 300);
    }).then((fn) => {
      if (cancelled) { fn(); return; }
      unlistenFn = fn;
    });

    return () => {
      cancelled = true;
      unlistenFn?.();
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    };
  }, [currentTabPath]);

  const handleVimAction = useCallback(
    (action: VimAction) => {
      const ops = fileOpsRef.current;
      const tab = activeTab();
      const pane = getPane(tab.id);
      const entries = filteredEntries(tab.id);
      const maxIdx = Math.max(0, entries.length - 1);

      switch (action) {
        case 'cursor_down':
          setCursor(tab.id, Math.min(pane.cursor + 1, maxIdx));
          break;
        case 'cursor_up':
          setCursor(tab.id, Math.max(pane.cursor - 1, 0));
          break;
        case 'cursor_first':
          setCursor(tab.id, 0);
          break;
        case 'cursor_last':
          setCursor(tab.id, maxIdx);
          break;
        case 'navigate_up':
          ops.handleNavigateUp();
          break;
        case 'navigate_into':
        case 'open_selected':
          ops.handleNavigateInto();
          break;
        case 'toggle_select':
          ops.handleToggleSelect();
          break;
        case 'delete_selected':
          ops.handleDelete();
          break;
        case 'cut_selected':
          ops.handleCut();
          break;
        case 'yank_selected':
          ops.handleYank();
          break;
        case 'paste':
          ops.handlePaste();
          break;
        case 'enter_search':
          ops.handleEnterSearch();
          break;
        case 'enter_command':
          ops.handleEnterCommand();
          break;
        case 'copy_path':
          ops.handleCopyPath();
          break;
        case 'copy_name':
          ops.handleCopyName();
          break;
        case 'open_terminal':
          ops.handleOpenTerminal();
          break;
        case 'open_terminal_here':
          ops.handleOpenTerminalHere();
          break;
        case 'open_with_app':
          ops.handleOpenWith();
          break;
        case 'open_editor':
          ops.handleOpenEditor();
          break;
        case 'toggle_sidebar':
          toggleSidebar();
          break;
        case 'rename':
          ops.handleRename();
          break;
        case 'new_dir':
          ops.handleNewDir();
          break;
        case 'new_file':
          ops.handleNewFile();
          break;
        case 'new_tab':
          openTab();
          break;
        case 'close_tab':
          closeTab(activeTabId);
          break;
        case 'next_tab':
          nextTab();
          break;
        case 'prev_tab':
          prevTab();
          break;
        case 'focus_path_bar':
          window.dispatchEvent(new CustomEvent('mac-filer:focus-path-bar'));
          break;
        case 'focus_zoxide':
          window.dispatchEvent(new CustomEvent('mac-filer:focus-zoxide'));
          break;
        case 'go_back': goBack(); break;
        case 'go_forward': goForward(); break;
        case 'reload':
          ops.reload(true);
          useUiStore.getState().showStatusMessage('再読み込みしました');
          break;
        case 'toggle_hidden':
          toggleHidden();
          break;
        case 'show_help':
          setShowHelp(true);
          break;
        case 'add_bookmark':
          ops.handleAddBookmark();
          break;
        case 'open_bookmark_picker':
          window.dispatchEvent(new CustomEvent('mac-filer:focus-bookmarks'));
          break;
        case 'toggle_preview':
          togglePreview();
          break;
        case 'sort_name':
          setSort(activeTabId, 'name', false);
          break;
        case 'sort_name_desc':
          setSort(activeTabId, 'name', true);
          break;
        case 'sort_time':
          setSort(activeTabId, 'time', false);
          break;
        case 'sort_time_desc':
          setSort(activeTabId, 'time', true);
          break;
        case 'sort_reverse': {
          const pane = getPane(activeTabId);
          setSort(activeTabId, pane.sortKey, !pane.sortDesc);
          break;
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeTabId]
  );

  useVimKeys(handleVimAction, keymap);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key === 'Escape' && target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
        setVimMode('NORMAL');
        setShowHelp(false);
        useFileStore.getState().setClipboard(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [setVimMode, setShowHelp]);

  return (
    <div className="app">
      <TabBar />
      <div className="main-area">
        {showSidebar && <Sidebar />}
        <div className="content-area">
          <PathBar />
          <div className="file-area">
            {tabs.map((t) => (
              <div
                key={t.id}
                className="tab-content"
                style={{ display: t.id === activeTabId ? 'flex' : 'none', flex: 1, minHeight: 0, overflow: 'hidden' }}
              >
                <FilePane tabId={t.id} />
              </div>
            ))}
          </div>
          <SearchBar />
          <StatusBar />
        </div>
        {showPreview && <PreviewPanel />}
      </div>

      <RenameModal />
      <NewDirModal />
      <NewFileModal />
      <ConfirmModal />
      <CommandPalette />
      <OpenWithModal />
      <KeybindingsHelp />
    </div>
  );
}
