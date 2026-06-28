import React from 'react';
import { isTauri, tauriApi } from '../../lib/tauri';
import { useConfigStore } from '../../store/configStore';
import { useUiStore } from '../../store/uiStore';
import type { FileEntry } from '../../types';

interface Props {
  entry: FileEntry;
  isCursor: boolean;
  isSelected: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
  colSizeWidth: number;
  colDateWidth: number;
  dragPaths: string[];
  subLabel?: string; // shown dimmed under the filename (e.g. parent path in find mode)
}

function formatSize(
  bytes: number,
  unit: 'binary' | 'decimal',
): { value: string; unit: string } | null {
  if (bytes === 0) return null;
  const base = unit === 'binary' ? 1024 : 1000;
  const units =
    unit === 'binary' ? ['B', 'KiB', 'MiB', 'GiB', 'TiB'] : ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(base)), units.length - 1);
  const value = i === 0 ? String(bytes) : (bytes / base ** i).toFixed(1);
  return { value, unit: units[i] };
}

/** Minimal strftime-like formatter: %Y %m %d %H %M %S */
function applyDateFormat(ts: number, fmt: string): string {
  const d = new Date(ts * 1000);
  return fmt
    .replace('%Y', String(d.getFullYear()))
    .replace('%m', String(d.getMonth() + 1).padStart(2, '0'))
    .replace('%d', String(d.getDate()).padStart(2, '0'))
    .replace('%H', String(d.getHours()).padStart(2, '0'))
    .replace('%M', String(d.getMinutes()).padStart(2, '0'))
    .replace('%S', String(d.getSeconds()).padStart(2, '0'));
}

// Strip time tokens (%H, %M, %S and surrounding separators) to get date-only format
function dateOnlyFormat(fmt: string): string {
  return fmt.replace(/\s*[^ ]*%[HMS][^ ]*/g, '').trim();
}

function formatDate(ts: number | undefined, fmt: string, dateOnly = false): string {
  if (!ts) return '—';
  const f = dateOnly ? dateOnlyFormat(fmt) : fmt;
  return applyDateFormat(ts, f);
}

function FileIcon({ entry }: { entry: FileEntry }) {
  if (entry.is_dir) return <span className="file-icon dir">📁</span>;
  const ext = entry.extension?.toLowerCase();
  const icons: Record<string, string> = {
    png: '🖼️',
    jpg: '🖼️',
    jpeg: '🖼️',
    gif: '🖼️',
    webp: '🖼️',
    svg: '🖼️',
    mp4: '🎬',
    mov: '🎬',
    avi: '🎬',
    mkv: '🎬',
    mp3: '🎵',
    wav: '🎵',
    flac: '🎵',
    aac: '🎵',
    pdf: '📄',
    doc: '📝',
    docx: '📝',
    xls: '📊',
    xlsx: '📊',
    ppt: '📊',
    pptx: '📊',
    zip: '🗜️',
    tar: '🗜️',
    gz: '🗜️',
    '7z': '🗜️',
    rar: '🗜️',
    js: '💻',
    ts: '💻',
    tsx: '💻',
    jsx: '💻',
    rs: '💻',
    py: '💻',
    go: '💻',
    json: '📋',
    yaml: '📋',
    yml: '📋',
    toml: '📋',
    md: '📖',
    txt: '📄',
    sh: '⚙️',
    bash: '⚙️',
  };
  return <span className="file-icon">{ext && icons[ext] ? icons[ext] : '📄'}</span>;
}

export const FileRow = React.memo(function FileRow({
  entry,
  isCursor,
  isSelected,
  onClick,
  onDoubleClick,
  onContextMenu,
  style,
  colSizeWidth,
  colDateWidth,
  dragPaths,
  subLabel,
}: Props) {
  const { dateFormat, sizeUnit } = useConfigStore((s) => s.appearance);
  const pendingKey = useUiStore((s) => (isCursor ? s.pendingKey : null));
  return (
    <div
      className={`file-row${isCursor ? ' cursor' : ''}${isSelected ? ' selected' : ''}`}
      style={style}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      draggable
      onDragStart={(e) => {
        // HTML5 data for internal drops within this app
        e.dataTransfer.setData('text/plain', dragPaths[0]);
        e.dataTransfer.setData('application/x-mac-filer-paths', JSON.stringify(dragPaths));
        // Native OS drag so external apps (Chrome, Finder, etc.) can receive real files
        if (isTauri()) {
          const label = dragPaths.length === 1 ? entry.name : `${dragPaths.length} items`;
          tauriApi.startNativeDrag(dragPaths, label).catch(console.error);
        }
      }}
    >
      <span className="file-select-indicator">{isSelected ? '✓' : ' '}</span>
      <FileIcon entry={entry} />
      <span className="file-name">
        {entry.name}
        {entry.is_symlink && (
          <span className="file-symlink-target"> → {entry.link_target ?? '?'}</span>
        )}
        {subLabel && <span className="file-sub-label">{subLabel}</span>}
      </span>
      <span className="file-size" style={{ width: colSizeWidth }}>
        {entry.is_dir ? (
          <>
            <span className="file-size-value">—</span>
            <span className="file-size-unit" />
          </>
        ) : (
          (() => {
            const s = formatSize(entry.size, sizeUnit);
            return s ? (
              <>
                <span className="file-size-value">{s.value}</span>
                <span className="file-size-unit">{s.unit}</span>
              </>
            ) : (
              <>
                <span className="file-size-value">0</span>
                <span className="file-size-unit">B</span>
              </>
            );
          })()
        )}
      </span>
      <span className="file-date" style={{ width: colDateWidth }}>
        {formatDate(entry.modified, dateFormat, colDateWidth < 120)}
      </span>
      {pendingKey && <span className="file-prefix-badge">{pendingKey} ▸</span>}
    </div>
  );
});
