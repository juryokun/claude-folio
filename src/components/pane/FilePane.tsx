import { useRef, useEffect, useCallback, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { FileRow } from './FileRow';
import { ContextMenu } from './ContextMenu';
import { useTabStore } from '../../store/tabStore';
import { useFileStore, type SortKey } from '../../store/fileStore';
import { useUiStore } from '../../store/uiStore';
import { useFileOps } from '../../hooks/useFileOps';
import { tauriApi } from '../../lib/tauri';

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
  const { tabs, activeTabId, navigateTo } = useTabStore();
  const { getPane, filteredEntries, setCursor, loadDir, setSort, clipboard } = useFileStore();
  const { showHidden, columnWidths, setColumnWidths } = useUiStore();
  const fileOps = useFileOps();
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null);

  const startColResize = useCallback((e: React.MouseEvent, col: 'size' | 'date') => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = columnWidths[col];
    const onMove = (ev: MouseEvent) => {
      setColumnWidths({ [col]: Math.max(40, startWidth - (ev.clientX - startX)) });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [columnWidths, setColumnWidths]);

  const tab = tabs.find((t) => t.id === tabId)!;
  const pane = getPane(tabId);
  const entries = filteredEntries(tabId);
  const isActive = activeTabId === tabId;

  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    overscan: 10,
  });

  // Scroll cursor into view
  useEffect(() => {
    if (isActive && entries.length > 0) {
      virtualizer.scrollToIndex(pane.cursor, { align: 'auto' });
    }
  }, [pane.cursor, isActive]);

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
      const filePaths = Array.from(e.dataTransfer.files).map((f: any) => f.path ?? f.name);
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

  const ctxEntry = ctxMenu?.kind === 'entry' ? entries[ctxMenu.entryIndex] ?? null : null;
  const ctxMenuItems = ctxMenu == null ? [] : ctxMenu.kind === 'entry' && ctxEntry ? [
    { label: '名前を変更', icon: '✏️', shortcut: 'r', action: fileOps.handleRename },
    { label: 'ゴミ箱に移動', icon: '🗑️', shortcut: 'dd', action: fileOps.handleDelete },
    { kind: 'sep' as const },
    { label: 'コピー', icon: '📋', shortcut: 'yy', action: fileOps.handleYank },
    { label: '切り取り', icon: '✂️', shortcut: 'xx', action: fileOps.handleCut },
    { label: 'ペースト', icon: '📌', shortcut: 'p', action: fileOps.handlePaste, disabled: !clipboard },
    { kind: 'sep' as const },
    { label: 'パスをコピー', icon: '🔗', shortcut: 'yp', action: fileOps.handleCopyPath },
    { label: 'ファイル名をコピー', icon: '📎', shortcut: 'yn', action: fileOps.handleCopyName },
    { kind: 'sep' as const },
    { label: 'ターミナルで開く', icon: '🖥️', shortcut: 'T', action: fileOps.handleOpenTerminalHere },
    { label: 'ブックマークに追加', icon: '🔖', shortcut: 'B', action: fileOps.handleAddBookmark },
  ] : ctxMenu.kind === 'blank' ? [
    { label: 'ペースト', icon: '📌', shortcut: 'p', action: fileOps.handlePaste, disabled: !clipboard },
    { kind: 'sep' as const },
    { label: '新規ファイル', icon: '📄', shortcut: 'A', action: fileOps.handleNewFile },
    { label: '新規フォルダ', icon: '📁', shortcut: 'a', action: fileOps.handleNewDir },
    { kind: 'sep' as const },
    { label: 'ターミナルで開く', icon: '🖥️', shortcut: 'T', action: fileOps.handleOpenTerminalHere },
    { label: 'ブックマークに追加', icon: '🔖', shortcut: 'B', action: fileOps.handleAddBookmark },
  ] : [];

  if (pane.loading) {
    return <div className="file-pane loading">読み込み中...</div>;
  }
  if (pane.error) {
    return <div className="file-pane error">{pane.error}</div>;
  }

  return (
    <div
      className={`file-pane-wrapper${isActive ? ' active' : ''}`}
      style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Full-height separator lines. Right-side calculation:
          padding=8, date=W_d → sep2 center = 8 + W_d + 3 = W_d+11
          + gap=6 + size=W_s       → sep1 center = W_d+11 + 6 + W_s = W_d+W_s+17 */}
      <div className="col-line" style={{ right: columnWidths.date + columnWidths.size + 17 }} />
      <div className="col-line" style={{ right: columnWidths.date + 11 }} />
      <div className="file-list-header">
        <span className="file-select-indicator" />
        <span className="file-icon" />
        <span
          className="file-name header-col sortable"
          onClick={() => handleSortClick('name')}
        >
          名前 <SortIndicator active={pane.sortKey === 'name'} desc={pane.sortDesc} />
        </span>
        <span className="file-size header-col" style={{ width: columnWidths.size }}>
          サイズ
          <span className="col-resizer" onMouseDown={(e) => startColResize(e, 'size')} />
        </span>
        <span
          className="file-date header-col sortable"
          onClick={() => handleSortClick('time')}
          style={{ width: columnWidths.date }}
        >
          更新日 <SortIndicator active={pane.sortKey === 'time'} desc={pane.sortDesc} />
          <span className="col-resizer" onMouseDown={(e) => startColResize(e, 'date')} />
        </span>
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
              colSizeWidth={columnWidths.size}
              colDateWidth={columnWidths.date}
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
                setCtxMenu({ x: e.clientX, y: e.clientY, kind: 'entry', entryIndex: vItem.index });
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
        <div className="empty-dir">（空のフォルダ）</div>
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
