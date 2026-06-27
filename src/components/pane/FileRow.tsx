import React from 'react';
import type { FileEntry } from '../../types';

interface Props {
  entry: FileEntry;
  isCursor: boolean;
  isSelected: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  style?: React.CSSProperties;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatDate(ts?: number): string {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleDateString('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
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
  entry, isCursor, isSelected, onClick, onDoubleClick, style,
}: Props) {
  return (
    <div
      className={`file-row${isCursor ? ' cursor' : ''}${isSelected ? ' selected' : ''}`}
      style={style}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', entry.path);
        e.dataTransfer.setData('application/x-mac-filer-paths', JSON.stringify([entry.path]));
      }}
    >
      <span className="file-select-indicator">{isSelected ? '✓' : ' '}</span>
      <FileIcon entry={entry} />
      <span className="file-name">{entry.name}{entry.is_symlink ? ' →' : ''}</span>
      <span className="file-size">{entry.is_dir ? '—' : formatSize(entry.size)}</span>
      <span className="file-date">{formatDate(entry.modified)}</span>
    </div>
  );
});
