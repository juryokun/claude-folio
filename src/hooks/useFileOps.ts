import { useCallback } from 'react';
import path from 'path-browserify';
import { tauriApi } from '../lib/tauri';
import { useTabStore } from '../store/tabStore';
import { useFileStore } from '../store/fileStore';
import { useUiStore } from '../store/uiStore';
import { useBookmarkStore } from '../store/bookmarkStore';

export function useFileOps() {
  const { activeTab, navigateTo } = useTabStore();
  const { getPane, filteredEntries, setClipboard, clipboard, loadDir, setCursor, toggleSelect, setPendingFocusName } =
    useFileStore();
  const { showHidden, terminalEmulator, setShowRename, setShowNewDir, showConfirmDialog, setShowCommandPalette, setVimMode, showStatusMessage } =
    useUiStore();
  const { addBookmark } = useBookmarkStore();

  const tab = activeTab();
  const tabId = tab.id;
  const currentPath = tab.path;
  const pane = getPane(tabId);
  const entries = filteredEntries(tabId);

  const cursorEntry = entries[pane.cursor] ?? null;

  const getTargetPaths = useCallback((): string[] => {
    if (pane.selected.size > 0) return Array.from(pane.selected);
    if (cursorEntry) return [cursorEntry.path];
    return [];
  }, [pane.selected, cursorEntry]);

  const reload = useCallback(() => {
    loadDir(tabId, currentPath, showHidden);
  }, [tabId, currentPath, showHidden, loadDir]);

  const handleNavigateInto = useCallback(() => {
    // l / Enter / ArrowRight — directories only; files are ignored
    if (!cursorEntry || !cursorEntry.is_dir) return;
    navigateTo(cursorEntry.path);
  }, [cursorEntry, navigateTo]);

  const handleNavigateUp = useCallback(() => {
    const parent = path.dirname(currentPath);
    if (parent !== currentPath) {
      const childName = path.basename(currentPath);
      setPendingFocusName(tabId, childName);
      navigateTo(parent);
    }
  }, [currentPath, tabId, navigateTo, setPendingFocusName]);

  const handleDelete = useCallback(() => {
    const targets = getTargetPaths();
    if (!targets.length) return;
    showConfirmDialog(
      `${targets.length}件をゴミ箱に移動しますか?`,
      async () => {
        try {
          await tauriApi.moveToTrash(targets);
          reload();
          showStatusMessage(`🗑️ ${targets.length}件をゴミ箱に移動しました`);
        } catch (e) {
          console.error('削除に失敗しました:', e);
        }
      }
    );
  }, [getTargetPaths, showConfirmDialog, reload, showStatusMessage]);

  const handleCut = useCallback(() => {
    const targets = getTargetPaths();
    if (!targets.length) return;
    setClipboard({ paths: targets, mode: 'cut' });
    showStatusMessage(`✂️ ${targets.length}件を切り取り`);
  }, [getTargetPaths, setClipboard, showStatusMessage]);

  const handleYank = useCallback(() => {
    const targets = getTargetPaths();
    if (!targets.length) return;
    setClipboard({ paths: targets, mode: 'copy' });
    showStatusMessage(`📋 ${targets.length}件をコピー`);
  }, [getTargetPaths, setClipboard, showStatusMessage]);

  const handlePaste = useCallback(async () => {
    if (!clipboard) return;
    try {
      if (clipboard.mode === 'copy') {
        await tauriApi.copyFiles(clipboard.paths, currentPath);
        showStatusMessage(`✅ ${clipboard.paths.length}件をペーストしました`);
      } else {
        await tauriApi.moveFiles(clipboard.paths, currentPath);
        setClipboard(null);
        showStatusMessage(`✅ ${clipboard.paths.length}件を移動しました`);
      }
      reload();
    } catch (e) {
      console.error('ペーストに失敗しました:', e);
    }
  }, [clipboard, currentPath, setClipboard, reload, showStatusMessage]);

  const handleCopyPath = useCallback(() => {
    const targets = getTargetPaths();
    if (!targets.length) return;
    tauriApi.copyPathToClipboard(targets)
      .then(() => showStatusMessage('📋 パスをクリップボードにコピーしました'))
      .catch(console.error);
  }, [getTargetPaths, showStatusMessage]);

  const handleCopyName = useCallback(() => {
    const targets = getTargetPaths();
    if (!targets.length) return;
    tauriApi.copyNameToClipboard(targets)
      .then(() => showStatusMessage('📋 ファイル名をクリップボードにコピーしました'))
      .catch(console.error);
  }, [getTargetPaths, showStatusMessage]);

  const handleOpenTerminal = useCallback(() => {
    if (cursorEntry && !cursorEntry.is_dir) {
      // o on a file → open with OS default app
      tauriApi.openFile(cursorEntry.path).catch(console.error);
    } else {
      // o on a directory (or no selection) → open terminal
      tauriApi.openTerminalAt(currentPath, terminalEmulator).catch(console.error);
    }
  }, [cursorEntry, currentPath, terminalEmulator]);

  const handleOpenEditor = useCallback(() => {
    if (!cursorEntry || cursorEntry.is_dir) return;
    const editorCmd = useUiStore.getState().editorCommand;
    if (editorCmd) {
      tauriApi.openWithEditor(cursorEntry.path, editorCmd).catch(console.error);
    } else {
      // fallback: open with OS default (same as o)
      tauriApi.openFile(cursorEntry.path).catch(console.error);
    }
  }, [cursorEntry]);

  const handleRename = useCallback(() => {
    if (!cursorEntry) return;
    setShowRename(true, cursorEntry.path);
  }, [cursorEntry, setShowRename]);

  const handleNewDir = useCallback(() => {
    setShowNewDir(true);
  }, [setShowNewDir]);

  const handleToggleSelect = useCallback(() => {
    if (!cursorEntry) return;
    toggleSelect(tabId, cursorEntry.path);
    // Move cursor down after selecting
    setCursor(tabId, Math.min(pane.cursor + 1, entries.length - 1));
  }, [cursorEntry, tabId, toggleSelect, setCursor, pane.cursor, entries.length]);

  const handleEnterSearch = useCallback(() => {
    setVimMode('SEARCH');
  }, [setVimMode]);

  const handleEnterCommand = useCallback(() => {
    setShowCommandPalette(true);
    setVimMode('COMMAND');
  }, [setShowCommandPalette, setVimMode]);

  const handleAddBookmark = useCallback(() => {
    const label = path.basename(currentPath) || currentPath;
    addBookmark(label, currentPath);
    showStatusMessage(`🔖 ブックマークに追加: ${label}`);
  }, [currentPath, addBookmark, showStatusMessage]);

  return {
    cursorEntry,
    entries,
    pane,
    handleNavigateInto,
    handleNavigateUp,
    handleDelete,
    handleCut,
    handleYank,
    handlePaste,
    handleCopyPath,
    handleCopyName,
    handleOpenTerminal,
    handleOpenEditor,
    handleRename,
    handleNewDir,
    handleToggleSelect,
    handleEnterSearch,
    handleEnterCommand,
    handleAddBookmark,
    reload,
  };
}
