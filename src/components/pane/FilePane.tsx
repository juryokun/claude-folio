import { useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { FileRow } from './FileRow';
import { useTabStore } from '../../store/tabStore';
import { useFileStore } from '../../store/fileStore';
import { useUiStore } from '../../store/uiStore';
import { tauriApi } from '../../lib/tauri';

interface Props {
  tabId: string;
}

export function FilePane({ tabId }: Props) {
  const { tabs, activeTabId, navigateTo } = useTabStore();
  const { getPane, filteredEntries, setCursor, loadDir } = useFileStore();
  const { showHidden } = useUiStore();

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

  if (pane.loading) {
    return <div className="file-pane loading">読み込み中...</div>;
  }
  if (pane.error) {
    return <div className="file-pane error">{pane.error}</div>;
  }

  return (
    <div
      className={`file-pane${isActive ? ' active' : ''}`}
      ref={parentRef}
      style={{ overflow: 'auto', flex: 1, minHeight: 0 }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
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
              onClick={() => {
                if (activeTabId !== tabId) useTabStore.getState().setActiveTab(tabId);
                setCursor(tabId, vItem.index);
              }}
              onDoubleClick={() => {
                if (entry.is_dir) navigateTo(entry.path);
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
  );
}
