import { listen } from '@tauri-apps/api/event';
import { useCallback, useEffect, useRef } from 'react';
import { KeybindingsHelp } from './components/help/KeybindingsHelp';
import { CommandOutputModal } from './components/modals/CommandOutputModal';
import { CommandPalette } from './components/modals/CommandPalette';
import { ConfirmModal } from './components/modals/ConfirmModal';
import { CopyConflictModal } from './components/modals/CopyConflictModal';
import { NewDirModal } from './components/modals/NewDirModal';
import { NewFileModal } from './components/modals/NewFileModal';
import { OpenWithModal } from './components/modals/OpenWithModal';
import { RenameModal } from './components/modals/RenameModal';
import { FilePane } from './components/pane/FilePane';
import { PathBar } from './components/pane/PathBar';
import { RecentPane } from './components/pane/RecentPane';
import { StatusBar } from './components/pane/StatusBar';
import { PreviewPanel } from './components/preview/PreviewPanel';
import { FindBar } from './components/search/FindBar';
import { SearchBar } from './components/search/SearchBar';
import { Sidebar } from './components/sidebar/Sidebar';
import { TabBar } from './components/tabs/TabBar';
import { useFileOps } from './hooks/useFileOps';
import { useVimKeys } from './hooks/useVimKeys';
import { tauriApi } from './lib/tauri';
import { applyTheme } from './lib/themes';
import type { VimAction } from './lib/vim/keymap';
import { useBookmarkStore } from './store/bookmarkStore';
import { useConfigStore } from './store/configStore';
import { useCustomCommandStore } from './store/customCommandStore';
import { useFileStore } from './store/fileStore';
import { setHomeDir, useTabStore } from './store/tabStore';
import { useUiStore } from './store/uiStore';
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
  const {
    tabs,
    activeTab,
    navigateTo,
    openTab,
    closeTab,
    nextTab,
    prevTab,
    activeTabId,
    goBack,
    goForward,
  } = useTabStore();
  const { loadDir, setCursor, getPane, filteredEntries, setSort, clearFind } = useFileStore();
  const {
    showHidden,
    toggleHidden,
    setShowHelp,
    setVimMode,
    toggleSidebar,
    showSidebar,
    showPreview,
    togglePreview,
    openFind,
    showRecent,
    openRecent,
    closeRecent,
  } = useUiStore();

  const fileOps = useFileOps();
  const fileOpsRef = useRef(fileOps);
  fileOpsRef.current = fileOps;

  const loadConfig = useConfigStore((s) => s.load);
  const keymap = useConfigStore((s) => s.keymap);
  const loadBookmarks = useBookmarkStore((s) => s.loadBookmarks);
  const loadCustomCommands = useCustomCommandStore((s) => s.loadCommands);

  // Resolve real home dir, then navigate to startup path arg (or home)
  useEffect(() => {
    getHomeDir().then(async (home) => {
      window.__macFilerUsername = home.split('/').pop();
      window.__macFilerHome = home;
      setHomeDir(home);
      const startupPath = await tauriApi.getStartupPath().catch(() => null);
      navigateTo(startupPath ?? home);
    });

    applyTheme(useUiStore.getState().theme);
    loadConfig();
    loadBookmarks().catch(() => {});
    tauriApi.suppressDsStore().catch(() => {});
    tauriApi
      .check7zipInstalled()
      .then(useUiStore.getState().setHas7zip)
      .catch(() => {});
    tauriApi
      .checkZoxideInstalled()
      .then(useUiStore.getState().setHasZoxide)
      .catch(() => {});
    tauriApi
      .checkFdInstalled()
      .then(useUiStore.getState().setHasFd)
      .catch(() => {});
    loadCustomCommands().catch(() => {});

    // When a second CLI launch targets this already-running instance, open a new tab.
    const unlisten = listen<string | null>('folio:open-tab', (event) => {
      const path = event.payload;
      openTab(path ?? undefined);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [loadConfig, loadBookmarks, loadCustomCommands, navigateTo, openTab]);

  // Load directory when active tab path changes
  const currentTab = activeTab();
  const currentTabPath = currentTab.path;
  const currentTabId = currentTab.id;
  useEffect(() => {
    loadDir(currentTabId, currentTabPath, showHidden);
  }, [currentTabId, currentTabPath, showHidden, loadDir]);

  // Watch active directory for external changes; debounce to avoid rapid reloads
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showHiddenRef = useRef(showHidden);
  showHiddenRef.current = showHidden;

  useEffect(() => {
    tauriApi.watchDir(currentTabPath).catch(() => {});

    let cancelled = false;
    let unlistenFn: (() => void) | null = null;

    listen('folio:dir-changed', () => {
      if (cancelled) return;
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
      reloadTimerRef.current = setTimeout(() => {
        const tab = useTabStore.getState().activeTab();
        loadDir(tab.id, tab.path, showHiddenRef.current, true);
      }, 300);
    }).then((fn) => {
      if (cancelled) {
        fn();
        return;
      }
      unlistenFn = fn;
    });

    return () => {
      cancelled = true;
      unlistenFn?.();
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    };
  }, [currentTabPath, loadDir]);

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
        case 'open_default':
          ops.handleOpenDefault();
          break;
        case 'quick_look':
          ops.handleQuickLook();
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
          window.dispatchEvent(new CustomEvent('folio:focus-path-bar'));
          break;
        case 'focus_zoxide':
          window.dispatchEvent(new CustomEvent('folio:focus-zoxide'));
          break;
        case 'go_back':
          goBack();
          break;
        case 'go_forward':
          goForward();
          break;
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
          window.dispatchEvent(new CustomEvent('folio:focus-bookmarks'));
          break;
        case 'toggle_preview':
          togglePreview();
          break;
        case 'find_files':
          openFind('file');
          break;
        case 'find_dirs':
          openFind('dir');
          break;
        case 'find_all':
          openFind('all');
          break;
        case 'find_recent':
          openRecent();
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
    [
      activeTabId,
      activeTab,
      setCursor,
      getPane,
      filteredEntries,
      toggleSidebar,
      openTab,
      closeTab,
      nextTab,
      prevTab,
      goBack,
      goForward,
      toggleHidden,
      togglePreview,
      setShowHelp,
      openFind,
      openRecent,
      setSort,
    ],
  );

  useVimKeys(handleVimAction, keymap);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key === 'Escape' && target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
        setVimMode('NORMAL');
        setShowHelp(false);
        closeRecent();
        const tab = useTabStore.getState().activeTab();
        clearFind(tab.id);
        useFileStore.getState().setClipboard(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [setVimMode, setShowHelp, closeRecent, clearFind]);

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
                style={{
                  display: !showRecent && t.id === activeTabId ? 'flex' : 'none',
                  flex: 1,
                  minHeight: 0,
                  overflow: 'hidden',
                }}
              >
                <FilePane tabId={t.id} />
              </div>
            ))}
            {showRecent && <RecentPane />}
          </div>
          <SearchBar />
          <FindBar />
          <StatusBar />
        </div>
        {showPreview && <PreviewPanel />}
      </div>

      <RenameModal />
      <NewDirModal />
      <NewFileModal />
      <ConfirmModal />
      <CommandPalette />
      <CommandOutputModal />
      <OpenWithModal />
      <CopyConflictModal />
      <KeybindingsHelp />
    </div>
  );
}
