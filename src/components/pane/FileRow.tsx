import React from 'react';
import type { FileEntry } from '../../types';
import { isTauri, tauriApi } from '../../lib/tauri';
import { useConfigStore } from '../../store/configStore';

interface Props {
  entry: FileEntry;
  isCursor: boolean;
  isSelected: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  style?: React.CSSProperties;
  colSizeWidth: number;
  colDateWidth: number;
  dragPaths: string[];
}

function formatSize(bytes: number, unit: 'binary' | 'decimal'): string {
  if (bytes === 0) return '—';
  const base = unit === 'binary' ? 1024 : 1000;
  const units = unit === 'binary'
    ? ['B', 'KiB', 'MiB', 'GiB', 'TiB']
    : ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(base)), units.length - 1);
  return i === 0 ? `${bytes} B` : `${(bytes / Math.pow(base, i)).toFixed(1)} ${units[i]}`;
}

/** Minimal strftime-like formatter: %Y %m %d %H %M %S */
function formatDate(ts: number | undefined, fmt: string): string {
  if (!ts) return '—';
  const d = new Date(ts * 1000);
  return fmt
    .replace('%Y', String(d.getFullYear()))
    .replace('%m', String(d.getMonth() + 1).padStart(2, '0'))
    .replace('%d', String(d.getDate()).padStart(2, '0'))
    .replace('%H', String(d.getHours()).padStart(2, '0'))
    .replace('%M', String(d.getMinutes()).padStart(2, '0'))
    .replace('%S', String(d.getSeconds()).padStart(2, '0'));
}

function FileIcon({ entry }: { entry: FileEntry }) {
  if (entry.is_dir) return <span className="file-icon dir">📁</span>;
  const ext = entry.extension?.toLowerCase();
  const icons: Record<string, string> = {
    png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', webp: '🖼️', svg: '🖼️',
    mp4: '🎬', mov: '🎬', avi: '🎬', mkv: '🎬',
    mp3: '🎵', wav: '🎵', flac: '🎵', aac: '🎵',
    pdf: '📄',
    doc: '📝', docx: '📝', xls: '📊', xlsx: '📊', ppt: '📊', pptx: '📊',
    zip: '🗜️', tar: '🗜️', gz: '🗜️', '7z': '🗜️', rar: '🗜️',
    js: '💻', ts: '💻', tsx: '💻', jsx: '💻', rs: '💻', py: '💻', go: '💻',
    json: '📋', yaml: '📋', yml: '📋', toml: '📋',
    md: '📖', txt: '📄',
    sh: '⚙️', bash: '⚙️',
  };
  return <span className="file-icon">{ext && icons[ext] ? icons[ext] : '📄'}</span>;
}

export const FileRow = React.memo(function FileRow({
  entry, isCursor, isSelected, onClick, onDoubleClick, style, colSizeWidth, colDateWidth, dragPaths,
}: Props) {
  const { dateFormat, sizeUnit } = useConfigStore((s) => s.appearance);
  return (
    <div
      className={`file-row${isCursor ? ' cursor' : ''}${isSelected ? ' selected' : ''}`}
      style={style}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
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
      <span className="file-name">{entry.name}{entry.is_symlink ? ' →' : ''}</span>
      <span className="file-size" style={{ width: colSizeWidth }}>{entry.is_dir ? '—' : formatSize(entry.size, sizeUnit)}</span>
      <span className="file-date" style={{ width: colDateWidth }}>{formatDate(entry.modified, dateFormat)}</span>
    </div>
  );
});
