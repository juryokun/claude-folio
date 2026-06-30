import { useVirtualizer } from '@tanstack/react-virtual';
import path from 'path-browserify';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { RecentMode } from '../../lib/recentHistory';
import { filterAndSortRecent, formatAccessedAt } from '../../lib/recentHistory';
import { tauriApi } from '../../lib/tauri';
import { useRecentStore } from '../../store/recentStore';
import { useTabStore } from '../../store/tabStore';
import { useUiStore } from '../../store/uiStore';

const ROW_HEIGHT = 36;

export function RecentPane() {
  const { entries, loadEntries } = useRecentStore();
  const { navigateTo } = useTabStore();
  const { closeRecent } = useUiStore();

  const [cursor, setCursor] = useState(0);
  const [filterQuery, setFilterQuery] = useState('');
  const [filterActive, setFilterActive] = useState(false);
  const [mode, setMode] = useState<RecentMode>('all');

  const parentRef = useRef<HTMLDivElement>(null);
  const filterInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadEntries().catch(() => {});
  }, [loadEntries]);

  useEffect(() => {
    setCursor(0);
  }, [filterQuery, mode]);

  useEffect(() => {
    if (filterActive) {
      setTimeout(() => filterInputRef.current?.focus(), 0);
    }
  }, [filterActive]);

  const visible = useMemo(
    () => filterAndSortRecent(entries, filterQuery, mode),
    [entries, filterQuery, mode],
  );

  const virtualizer = useVirtualizer({
    count: visible.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  useEffect(() => {
    if (visible.length > 0) {
      virtualizer.scrollToIndex(Math.min(cursor, visible.length - 1), { align: 'auto' });
    }
  }, [cursor, visible.length, virtualizer]);

  const openEntry = (entry: (typeof visible)[number]) => {
    if (entry.kind === 'dir') {
      navigateTo(entry.path);
    } else {
      tauriApi.openFile(entry.path).catch(() => {});
      tauriApi.pushRecentEntry(entry.path, 'file').catch(() => {});
    }
    closeRecent();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;

      if (filterActive) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setFilterQuery('');
          setFilterActive(false);
          filterInputRef.current?.blur();
        }
        return;
      }

      if (target.tagName === 'INPUT') return;

      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          e.preventDefault();
          setCursor((c) => Math.min(c + 1, visible.length - 1));
          break;
        case 'k':
        case 'ArrowUp':
          e.preventDefault();
          setCursor((c) => Math.max(c - 1, 0));
          break;
        case 'f':
          e.preventDefault();
          setMode((m) => (m === 'all' ? 'files' : 'all'));
          break;
        case '/':
          e.preventDefault();
          setFilterActive(true);
          break;
        case 'Enter':
        case 'l': {
          e.preventDefault();
          const entry = visible[cursor];
          if (entry) openEntry(entry);
          break;
        }
        case 'Escape':
          e.preventDefault();
          closeRecent();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filterActive, visible, cursor, closeRecent, navigateTo]);

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-primary)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 10px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <span className="find-bar-badge">fr</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          最近使ったファイル・ディレクトリ
        </span>
        <button
          style={{
            marginLeft: 8,
            padding: '1px 8px',
            fontSize: 11,
            borderRadius: 4,
            border: '1px solid var(--border)',
            background: mode === 'files' ? 'var(--accent)' : 'transparent',
            color: mode === 'files' ? '#fff' : 'var(--text-muted)',
            cursor: 'pointer',
          }}
          onClick={() => setMode((m) => (m === 'all' ? 'files' : 'all'))}
          tabIndex={-1}
        >
          files only
        </button>
        {filterActive ? (
          <input
            ref={filterInputRef}
            style={{
              marginLeft: 'auto',
              padding: '1px 6px',
              fontSize: 12,
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              color: 'var(--text-primary)',
              outline: 'none',
              width: 180,
            }}
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="絞り込み..."
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        ) : (
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 11,
              color: 'var(--text-muted)',
            }}
          >
            {filterQuery ? `/${filterQuery}` : ''}
            <span style={{ marginLeft: 8, opacity: 0.6 }}>
              j/k 移動 · / 絞り込み · f 切替 · Enter 開く · Esc 閉じる
            </span>
          </span>
        )}
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>
          {visible.length}件
        </span>
      </div>

      <div ref={parentRef} style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((vItem) => {
            const entry = visible[vItem.index];
            if (!entry) return null;
            const isCursor = vItem.index === cursor;
            const base = path.basename(entry.path);
            const dir = path.dirname(entry.path);

            return (
              <div
                key={entry.path}
                onClick={() => {
                  setCursor(vItem.index);
                  openEntry(entry);
                }}
                style={{
                  position: 'absolute',
                  top: `${vItem.start}px`,
                  width: '100%',
                  height: ROW_HEIGHT,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '0 10px',
                  boxSizing: 'border-box',
                  cursor: 'pointer',
                  background: isCursor ? 'var(--cursor-bg)' : 'transparent',
                  color: isCursor ? 'var(--cursor-fg)' : 'var(--text-primary)',
                }}
              >
                <span style={{ fontSize: 14, flexShrink: 0 }}>
                  {entry.kind === 'dir' ? '📁' : '📄'}
                </span>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                  <span
                    style={{
                      fontWeight: 600,
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: 13,
                    }}
                  >
                    {base}
                  </span>
                  <span
                    style={{
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: 11,
                      opacity: 0.55,
                    }}
                  >
                    {dir}
                  </span>
                </span>
                <span
                  style={{
                    fontSize: 11,
                    opacity: 0.55,
                    flexShrink: 0,
                    marginLeft: 8,
                  }}
                >
                  {formatAccessedAt(entry.accessed_at)}
                </span>
              </div>
            );
          })}
        </div>
        {visible.length === 0 && (
          <div
            style={{
              padding: '32px 16px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: 13,
            }}
          >
            {entries.length === 0 ? '履歴がありません' : '一致する項目がありません'}
          </div>
        )}
      </div>
    </div>
  );
}
