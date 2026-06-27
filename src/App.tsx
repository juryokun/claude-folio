import { useEffect, useCallback } from 'react';
import { TabBar } from './components/tabs/TabBar';
import { Sidebar } from './components/sidebar/Sidebar';
import { FilePane } from './components/pane/FilePane';
import { PathBar } from './components/pane/PathBar';
import { StatusBar } from './components/pane/StatusBar';
import { SearchBar } from './components/search/SearchBar';
import { RenameModal } from './components/modals/RenameModal';
import { CommandPalette } from './components/modals/CommandPalette';
import { SettingsModal } from './components/settings/SettingsModal';
import { KeybindingsHelp } from './components/help/KeybindingsHelp';
import { useTabStore } from './store/tabStore';
import { useFileStore } from './store/fileStore';
import { useUiStore } from './store/uiStore';
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
  const { tabs, activeTab, navigateTo, openTab, closeTab, nextTab, prevTab, activeTabId } =
    useTabStore();
  const { loadDir, setCursor, getPane, filteredEntries } = useFileStore();
  const {
    showHidden, toggleHidden, setShowHelp, setShowSettings, setVimMode,
  } = useUiStore();

  const fileOps = useFileOps();

  useEffect(() => {
    getHomeDir().then((home) => {
      (window as any).__macFilerUsername = home.split('/').pop();
      if (useTabStore.getState().activeTab().path === '/Users') {
        navigateTo(home);
      }
    });

    tauriApi.suppressDsStore().catch(() => {});
    tauriApi.check7zipInstalled().then(useUiStore.getState().setHas7zip).catch(() => {});
    tauriApi.checkZoxideInstalled().then(useUiStore.getState().setHasZoxide).catch(() => {});
  }, []);

  // Load directory when active tab path changes
  useEffect(() => {
    const tab = activeTab();
    loadDir(tab.id, tab.path, showHidden);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab().path, activeTab().id]);

  // Reload all tabs when showHidden changes
  useEffect(() => {
    tabs.forEach((tab) => {
      loadDir(tab.id, tab.path, showHidden);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHidden]);

  const handleVimAction = useCallback(
    (action: VimAction) => {
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
          fileOps.handleNavigateUp();
          break;
        case 'navigate_into':
          fileOps.handleNavigateInto();
          break;
        case 'toggle_select':
          fileOps.handleToggleSelect();
          break;
        case 'delete_selected':
          fileOps.handleDelete();
          break;
        case 'cut_selected':
          fileOps.handleCut();
          break;
        case 'yank_selected':
          fileOps.handleYank();
          break;
        case 'paste':
          fileOps.handlePaste();
          break;
        case 'enter_search':
          fileOps.handleEnterSearch();
          break;
        case 'enter_command':
          fileOps.handleEnterCommand();
          break;
        case 'copy_path':
          fileOps.handleCopyPath();
          break;
        case 'copy_name':
          fileOps.handleCopyName();
          break;
        case 'open_terminal':
          fileOps.handleOpenTerminal();
          break;
        case 'rename':
          fileOps.handleRename();
          break;
        case 'new_dir':
          fileOps.handleNewDir();
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
        case 'toggle_hidden':
          toggleHidden();
          break;
        case 'show_help':
          setShowHelp(true);
          break;
        case 'open_selected':
          fileOps.handleNavigateInto();
          break;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeTabId]
  );

  useVimKeys(handleVimAction);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key === 'Escape' && target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
        setVimMode('NORMAL');
        setShowHelp(false);
        setShowSettings(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [setVimMode, setShowHelp, setShowSettings]);

  return (
    <div className="app">
      <TabBar />
      <div className="main-area">
        <Sidebar />
        <div className="content-area">
          <PathBar />
          <div className="file-area">
            {tabs.map((t) => (
              <div
                key={t.id}
                className="tab-content"
                style={{ display: t.id === activeTabId ? 'flex' : 'none', flex: 1 }}
              >
                <FilePane tabId={t.id} />
              </div>
            ))}
          </div>
          <SearchBar />
          <StatusBar />
        </div>
      </div>

      <RenameModal />
      <CommandPalette />
      <SettingsModal />
      <KeybindingsHelp />
    </div>
  );
}
