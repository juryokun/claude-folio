import { useVirtualizer } from '@tanstack/react-virtual';
import path from 'path-browserify';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFileOps } from '../../hooks/useFileOps';
import { tauriApi } from '../../lib/tauri';
import { useBookmarkStore } from '../../store/bookmarkStore';
import { useConfigStore } from '../../store/configStore';
import { type SortKey, useFileStore } from '../../store/fileStore';
import { useTabStore } from '../../store/tabStore';
import { useUiStore } from '../../store/uiStore';
import { ContextMenu } from './ContextMenu';
import { FileRow } from './FileRow';

interface Props {
  tabId: string;
}

function SortIndicator({ active, desc }: { active: boolean; desc: boolean }) {
  if (!active) return <span className="sort-indicator inactive">↕</span>;
  return <span className="sort-indicator active">{desc ? '↓' : '↑'}</span>;
}

interface ContextMenuState {
  x: number;
  y: number;
  kind: 'entry' | 'blank';
  entryIndex: number;
}

export function FilePane({ tabId }: Props) {
  const { t } = useTranslation();
  const { tabs, activeTabId, navigateTo } = useTabStore();
  const { getPane, filteredEntries, setCursor, loadDir, setSort, clipboard, loadGitStatus } =
    useFileStore();
  const { showHidden, columnWidths, setColumnWidths } = useUiStore();
  const visibleDateCols = useConfigStore((s) => s.visibleDateCols);
  const showGitStatus = useConfigStore((s) => s.appearance.gitStatus.show);
  const showSize = useConfigStore((s) => s.appearance.size.show);
  const fileOps = useFileOps();
  const { terminalApp, terminalCommand, showStatusMessage } = useUiStore();
  const { addBookmark } = useBookmarkStore();
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null);
  const startColResize = useCallback(
    (e: React.MouseEvent, col: 'size' | 'date' | 'dateCreated' | 'dateAccessed') => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startWidth = columnWidths[col];
      let moved = false;
      const onMove = (ev: MouseEvent) => {
        if (!moved && Math.abs(ev.clientX - startX) > 2) moved = true;
        const minWidth = 80;
        setColumnWidths({ [col]: Math.max(minWidth, startWidth - (ev.clientX - startX)) });
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        if (moved) {
          // suppress the click that fires after mouseup on trackpad
          window.addEventListener('click', (ev) => ev.stopPropagation(), {
            capture: true,
            once: true,
          });
        }
      };
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [columnWidths, setColumnWidths],
  );

  const tab = tabs.find((t) => t.id === tabId) ?? tabs[0];
  const pane = getPane(tabId);
  const entries = filteredEntries(tabId);
  const isActive = activeTabId === tabId;
  const inFindMode = !!pane.findMode;

  // Merge config-time column defs with UI column widths
  const dateCols = useMemo(
    () =>
      visibleDateCols.map((col) => ({
        ...col,
        width: columnWidths[col.colKey],
        label: t(col.labelKey),
      })),
    [visibleDateCols, columnWidths, t],
  );

  const { totalDateWidth, dateColSuffixWidths } = useMemo(() => {
    const suffixes: number[] = new Array(dateCols.length);
    let running = 0;
    for (let i = dateCols.length - 1; i >= 0; i--) {
      running += dateCols[i].width;
      suffixes[i] = running;
    }
    return { totalDateWidth: running, dateColSuffixWidths: suffixes };
  }, [dateCols]);

  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 22,
    overscan: 10,
  });

  // Scroll cursor into view
  useEffect(() => {
    if (isActive && entries.length > 0) {
      virtualizer.scrollToIndex(pane.cursor, { align: 'auto' });
    }
  }, [pane.cursor, isActive, virtualizer, entries.length]);

  // Load git status whenever the directory changes
  useEffect(() => {
    if (tab?.path) loadGitStatus(tabId, tab.path);
  }, [tabId, tab?.path, loadGitStatus]);

  // Drop target handler
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const paths = e.dataTransfer.getData('application/x-mac-filer-paths');
    if (paths) {
      const srcPaths: string[] = JSON.parse(paths);
      const dest = tab.path;
      try {
        if (e.altKey) {
          await tauriApi.copyFiles(srcPaths, dest);
        } else {
          await tauriApi.moveFiles(srcPaths, dest);
        }
        loadDir(tabId, dest, showHidden);
      } catch (e) {
        console.error(e);
      }
    }
    // Handle external files dropped from Finder
    if (e.dataTransfer.files.length > 0) {
      // Tauri provides paths via the file object path property
      const filePaths = Array.from(e.dataTransfer.files).map(
        (f) => (f as File & { path?: string }).path ?? f.name,
      );
      const validPaths = filePaths.filter(Boolean);
      if (validPaths.length > 0) {
        try {
          await tauriApi.copyFiles(validPaths, tab.path);
          loadDir(tabId, tab.path, showHidden);
        } catch (e) {
          console.error(e);
        }
      }
    }
  };

  const handleSortClick = (key: SortKey) => {
    if (pane.sortKey === key) {
      setSort(tabId, key, !pane.sortDesc);
    } else {
      setSort(tabId, key, false);
    }
  };

  const ctxEntry = ctxMenu?.kind === 'entry' ? (entries[ctxMenu.entryIndex] ?? null) : null;

  // For terminal/bookmark: dirs use the entry itself, files use the parent dir
  const ctxTargetDir = ctxEntry
    ? ctxEntry.is_dir
      ? ctxEntry.path
      : path.dirname(ctxEntry.path)
    : tab.path;

  const ctxMenuItems =
    ctxMenu == null
      ? []
      : ctxMenu.kind === 'entry' && ctxEntry
        ? [
            {
              label: t('filePane.ctx.rename'),
              icon: '✏️',
              shortcut: 'r',
              action: fileOps.handleRename,
            },
            {
              label: t('filePane.ctx.delete'),
              icon: '🗑️',
              shortcut: 'dd',
              action: fileOps.handleDelete,
            },
            { kind: 'sep' as const },
            {
              label: t('filePane.ctx.copy'),
              icon: '📋',
              shortcut: 'yy',
              action: fileOps.handleYank,
            },
            { label: t('filePane.ctx.cut'), icon: '✂️', shortcut: 'xx', action: fileOps.handleCut },
            {
              label: t('filePane.ctx.paste'),
              icon: '📌',
              shortcut: 'p',
              action: fileOps.handlePaste,
              disabled: !clipboard,
            },
            { kind: 'sep' as const },
            {
              label: t('filePane.ctx.copyPath'),
              icon: '🔗',
              shortcut: 'yp',
              action: fileOps.handleCopyPath,
            },
            {
              label: t('filePane.ctx.copyName'),
              icon: '📎',
              shortcut: 'yn',
              action: fileOps.handleCopyName,
            },
            { kind: 'sep' as const },
            {
              label: t('filePane.ctx.openTerminal'),
              icon: '🖥️',
              shortcut: 'T',
              disabled: !ctxEntry.is_dir,
              action: () =>
                tauriApi
                  .openTerminalAt(ctxTargetDir, terminalApp, terminalCommand)
                  .catch(console.error),
            },
            {
              label: t('filePane.ctx.addBookmark'),
              icon: '🔖',
              shortcut: 'B',
              disabled: !ctxEntry.is_dir,
              action: () => {
                const label = path.basename(ctxTargetDir) || ctxTargetDir;
                addBookmark(label, ctxTargetDir).then(() =>
                  showStatusMessage(`🔖 ブックマークに追加: ${label}`),
                );
              },
            },
            { kind: 'sep' as const },
            {
              label: t('filePane.ctx.openWith'),
              icon: '🚀',
              shortcut: 'O',
              action: fileOps.handleOpenWith,
              dim: true,
            },
            {
              label: t('filePane.ctx.openEditor'),
              icon: '📝',
              shortcut: 'e',
              action: fileOps.handleOpenEditor,
              dim: true,
            },
            {
              label: t('filePane.ctx.commandPalette'),
              icon: '⌨️',
              shortcut: ':',
              action: fileOps.handleEnterCommand,
              dim: true,
            },
          ]
        : ctxMenu.kind === 'blank'
          ? [
              {
                label: t('filePane.ctx.paste'),
                icon: '📌',
                shortcut: 'p',
                action: fileOps.handlePaste,
                disabled: !clipboard,
              },
              { kind: 'sep' as const },
              {
                label: t('filePane.ctx.newFile'),
                icon: '📄',
                shortcut: 'A',
                action: fileOps.handleNewFile,
              },
              {
                label: t('filePane.ctx.newFolder'),
                icon: '📁',
                shortcut: 'a',
                action: fileOps.handleNewDir,
              },
              { kind: 'sep' as const },
              {
                label: t('filePane.ctx.openTerminal'),
                icon: '🖥️',
                shortcut: 'T',
                action: fileOps.handleOpenTerminalHere,
              },
              {
                label: t('filePane.ctx.addBookmark'),
                icon: '🔖',
                shortcut: 'B',
                action: fileOps.handleAddBookmark,
              },
            ]
          : [];

  if (pane.loading) {
    return <div className="file-pane loading">{t('filePane.loading')}</div>;
  }
  if (pane.error) {
    return <div className="file-pane error">{pane.error}</div>;
  }

  return (
    <div
      className={`file-pane-wrapper${isActive ? ' active' : ''}`}
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Full-height separator lines */}
      <div
        className="col-line"
        style={{ right: totalDateWidth + (showSize ? columnWidths.size : 0) + 17 }}
      />
      {dateCols.map((col, i) => (
        <div
          key={col.key}
          className="col-line"
          style={{ right: dateColSuffixWidths[i] + 11 }}
        />
      ))}
      {pane.findMode && (
        <div className="find-mode-banner">
          <span className="find-bar-badge">
            {pane.findMode.type === 'file' ? 'ff' : pane.findMode.type === 'dir' ? 'fd' : 'fa'}
          </span>
          <span>{pane.findMode.query}</span>
          {pane.findMode.loading ? (
            <span className="find-mode-count">検索中…</span>
          ) : (
            <span className="find-mode-count">{pane.findMode.results.length}件</span>
          )}
          <span className="find-mode-hint">Enter で移動 / Esc でクリア</span>
        </div>
      )}
      <div className="file-list-header">
        <span className="file-select-indicator" />
        <span className="file-icon" />
        <span className="file-name header-col sortable" onClick={() => handleSortClick('name')}>
          {t('filePane.colName')}{' '}
          <SortIndicator active={pane.sortKey === 'name'} desc={pane.sortDesc} />
        </span>
        {showSize && (
          <span className="file-size header-col" style={{ width: columnWidths.size }}>
            {t('filePane.colSize')}
            <span className="col-resizer" onMouseDown={(e) => startColResize(e, 'size')} />
          </span>
        )}
        {dateCols.map((col) => (
          <span
            key={col.key}
            className="file-date header-col sortable"
            onClick={() => handleSortClick('time')}
            style={{ width: col.width }}
          >
            {col.label} <SortIndicator active={pane.sortKey === 'time'} desc={pane.sortDesc} />
            <span className="col-resizer" onMouseDown={(e) => startColResize(e, col.colKey)} />
          </span>
        ))}
      </div>
      <div
        className="file-pane"
        ref={parentRef}
        style={{ overflow: 'auto', flex: 1, minHeight: 0 }}
        onContextMenu={(e) => {
          e.preventDefault();
          if (activeTabId !== tabId) useTabStore.getState().setActiveTab(tabId);
          setCtxMenu({ x: e.clientX, y: e.clientY, kind: 'blank', entryIndex: -1 });
        }}
      >
        <div
          style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}
        >
          {virtualizer.getVirtualItems().map((vItem) => {
            const entry = entries[vItem.index];
            if (!entry) return null;
            return (
              <FileRow
                key={entry.path}
                entry={entry}
                isCursor={isActive && vItem.index === pane.cursor}
                isSelected={pane.selected.has(entry.path)}
                colSizeWidth={showSize ? columnWidths.size : undefined}
                dateCols={dateCols}
                gitSymbol={showGitStatus ? pane.gitStatus[entry.name] : undefined}
                subLabel={inFindMode ? path.dirname(entry.path) : undefined}
                dragPaths={
                  pane.selected.size > 0 && pane.selected.has(entry.path)
                    ? [...pane.selected]
                    : [entry.path]
                }
                onClick={() => {
                  if (activeTabId !== tabId) useTabStore.getState().setActiveTab(tabId);
                  setCursor(tabId, vItem.index);
                }}
                onDoubleClick={() => {
                  if (entry.is_dir) navigateTo(entry.path);
                  else tauriApi.openFile(entry.path).catch(console.error);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (activeTabId !== tabId) useTabStore.getState().setActiveTab(tabId);
                  setCursor(tabId, vItem.index);
                  setCtxMenu({
                    x: e.clientX,
                    y: e.clientY,
                    kind: 'entry',
                    entryIndex: vItem.index,
                  });
                }}
                style={{
                  position: 'absolute',
                  top: `${vItem.start}px`,
                  width: '100%',
                }}
              />
            );
          })}
        </div>
        {entries.length === 0 && !pane.loading && (
          <div className="empty-dir">{t('filePane.emptyFolder')}</div>
        )}
      </div>
      {ctxMenu && ctxMenuItems.length > 0 && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={ctxMenuItems}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}
