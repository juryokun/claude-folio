import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import path from 'path-browserify';
import { tauriApi } from '../lib/tauri';
import { useTabStore } from '../store/tabStore';
import { useFileStore } from '../store/fileStore';
import { useUiStore } from '../store/uiStore';
import { useBookmarkStore } from '../store/bookmarkStore';

export function useFileOps() {
  const { t } = useTranslation();
  const { activeTab, navigateTo } = useTabStore();
  const { getPane, filteredEntries, setClipboard, clipboard, loadDir, setCursor, toggleSelect, setPendingFocusName } =
    useFileStore();
  const { showHidden, terminalApp, terminalCommand, setShowRename, setShowNewDir, setShowNewFile, showConfirmDialog, setShowCommandPalette, setVimMode, showStatusMessage, setShowOpenWith, showCopyConflict } =
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

  const reload = useCallback((preserveCursor = false) => {
    loadDir(tabId, currentPath, showHidden, preserveCursor);
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
      t('fileOps.confirmDelete', { count: targets.length }),
      async () => {
        try {
          await tauriApi.moveToTrash(targets);
          reload();
          showStatusMessage(t('fileOps.deleted', { count: targets.length }));
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
    showStatusMessage(t('fileOps.cut', { count: targets.length }));
  }, [getTargetPaths, setClipboard, showStatusMessage]);

  const handleYank = useCallback(() => {
    const targets = getTargetPaths();
    if (!targets.length) return;
    setClipboard({ paths: targets, mode: 'copy' });
    showStatusMessage(t('fileOps.copied', { count: targets.length }));
  }, [getTargetPaths, setClipboard, showStatusMessage]);

  const handlePaste = useCallback(async () => {
    if (!clipboard) return;

    const doCopy = async (strategy: 'overwrite' | 'rename') => {
      try {
        await tauriApi.copyFiles(clipboard.paths, currentPath, strategy);
        showStatusMessage(t('fileOps.pasted', { count: clipboard.paths.length }));
        reload();
      } catch (e) {
        console.error(t('fileOps.pasteError', { error: String(e) }));
      }
    };

    if (clipboard.mode === 'copy') {
      const conflicts = await tauriApi.checkCopyConflicts(clipboard.paths, currentPath);
      if (conflicts.length > 0) {
        showCopyConflict(conflicts, doCopy);
      } else {
        await doCopy('rename');
      }
    } else {
      try {
        await tauriApi.moveFiles(clipboard.paths, currentPath);
        setClipboard(null);
        showStatusMessage(t('fileOps.moved', { count: clipboard.paths.length }));
        reload();
      } catch (e) {
        console.error(t('fileOps.pasteError', { error: String(e) }));
      }
    }
  }, [clipboard, currentPath, setClipboard, reload, showStatusMessage, showCopyConflict]);

  const handleCopyPath = useCallback(() => {
    const targets = getTargetPaths();
    if (!targets.length) return;
    tauriApi.copyPathToClipboard(targets)
      .then(() => showStatusMessage(t('fileOps.pathCopied')))
      .catch(console.error);
  }, [getTargetPaths, showStatusMessage]);

  const handleCopyName = useCallback(() => {
    const targets = getTargetPaths();
    if (!targets.length) return;
    tauriApi.copyNameToClipboard(targets)
      .then(() => showStatusMessage(t('fileOps.nameCopied')))
      .catch(console.error);
  }, [getTargetPaths, showStatusMessage]);

  const handleOpenTerminal = useCallback(() => {
    if (cursorEntry && !cursorEntry.is_dir) {
      // o on a file → open with OS default app
      tauriApi.openFile(cursorEntry.path).catch(console.error);
    } else {
      // o on a directory (or no selection) → open terminal
      tauriApi.openTerminalAt(currentPath, terminalApp, terminalCommand).catch(console.error);
    }
  }, [cursorEntry, currentPath, terminalApp, terminalCommand]);

  const handleOpenTerminalHere = useCallback(() => {
    tauriApi.openTerminalAt(currentPath, terminalApp, terminalCommand).catch(console.error);
  }, [currentPath, terminalApp, terminalCommand]);

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

  const handleOpenWith = useCallback(() => {
    if (!cursorEntry) return;
    setShowOpenWith(true, cursorEntry.path);
  }, [cursorEntry, setShowOpenWith]);

  const handleRename = useCallback(() => {
    if (!cursorEntry) return;
    setShowRename(true, cursorEntry.path);
  }, [cursorEntry, setShowRename]);

  const handleNewDir = useCallback(() => {
    setShowNewDir(true);
  }, [setShowNewDir]);

  const handleNewFile = useCallback(() => {
    setShowNewFile(true);
  }, [setShowNewFile]);

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

  const handleAddBookmark = useCallback(async () => {
    const label = path.basename(currentPath) || currentPath;
    await addBookmark(label, currentPath);
    showStatusMessage(t('fileOps.bookmarkAdded', { label }));
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
    handleOpenTerminalHere,
    handleOpenWith,
    handleOpenEditor,
    handleRename,
    handleNewDir,
    handleNewFile,
    handleToggleSelect,
    handleEnterSearch,
    handleEnterCommand,
    handleAddBookmark,
    reload,
  };
}
