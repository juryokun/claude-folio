import { useCallback } from 'react';
import path from 'path-browserify';
import { tauriApi } from '../lib/tauri';
import { useTabStore } from '../store/tabStore';
import { useFileStore } from '../store/fileStore';
import { useUiStore } from '../store/uiStore';

export function useFileOps() {
  const { activeTab, navigateTo } = useTabStore();
  const { getPane, filteredEntries, setClipboard, clipboard, loadDir, setCursor, toggleSelect, setPendingFocusName } =
    useFileStore();
  const { showHidden, terminalEmulator, setShowRename, setShowNewDir, setShowCommandPalette, setVimMode } =
    useUiStore();

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
    if (!cursorEntry) return;
    if (cursorEntry.is_dir) {
      navigateTo(cursorEntry.path);
    } else {
      tauriApi.openTerminalAt(cursorEntry.path, terminalEmulator).catch(console.error);
    }
  }, [cursorEntry, navigateTo, terminalEmulator]);

  const handleNavigateUp = useCallback(() => {
    const parent = path.dirname(currentPath);
    if (parent !== currentPath) {
      const childName = path.basename(currentPath);
      setPendingFocusName(tabId, childName);
      navigateTo(parent);
    }
  }, [currentPath, tabId, navigateTo, setPendingFocusName]);

  const handleDelete = useCallback(async () => {
    const targets = getTargetPaths();
    if (!targets.length) return;
    if (!confirm(`${targets.length}件をゴミ箱に移動しますか?`)) return;
    try {
      await tauriApi.moveToTrash(targets);
      reload();
    } catch (e) {
      alert(`削除に失敗しました: ${e}`);
    }
  }, [getTargetPaths, reload]);

  const handleCut = useCallback(() => {
    const targets = getTargetPaths();
    if (!targets.length) return;
    setClipboard({ paths: targets, mode: 'cut' });
  }, [getTargetPaths, setClipboard]);

  const handleYank = useCallback(() => {
    const targets = getTargetPaths();
    if (!targets.length) return;
    setClipboard({ paths: targets, mode: 'copy' });
  }, [getTargetPaths, setClipboard]);

  const handlePaste = useCallback(async () => {
    if (!clipboard) return;
    try {
      if (clipboard.mode === 'copy') {
        await tauriApi.copyFiles(clipboard.paths, currentPath);
      } else {
        await tauriApi.moveFiles(clipboard.paths, currentPath);
        setClipboard(null);
      }
      reload();
    } catch (e) {
      alert(`ペーストに失敗しました: ${e}`);
    }
  }, [clipboard, currentPath, setClipboard, reload]);

  const handleCopyPath = useCallback(() => {
    const targets = getTargetPaths();
    if (!targets.length) return;
    tauriApi.copyPathToClipboard(targets).catch(console.error);
  }, [getTargetPaths]);

  const handleCopyName = useCallback(() => {
    const targets = getTargetPaths();
    if (!targets.length) return;
    tauriApi.copyNameToClipboard(targets).catch(console.error);
  }, [getTargetPaths]);

  const handleOpenTerminal = useCallback(() => {
    tauriApi.openTerminalAt(currentPath, terminalEmulator).catch(console.error);
  }, [currentPath, terminalEmulator]);

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
    handleRename,
    handleNewDir,
    handleToggleSelect,
    handleEnterSearch,
    handleEnterCommand,
    reload,
  };
}
