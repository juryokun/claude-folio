import React from 'react';
import { useTranslation } from 'react-i18next';
import { isTauri, tauriApi } from '../../lib/tauri';
import { useConfigStore } from '../../store/configStore';
import { useUiStore } from '../../store/uiStore';
import type { ClipboardMode, FileEntry } from '../../types';

export interface DateColDef {
  key: 'modified' | 'created' | 'accessed';
  width: number;
  format: string;
}

interface Props {
  entry: FileEntry;
  isCursor: boolean;
  isSelected: boolean;
  clipboardMode?: ClipboardMode;
  onClick: () => void;
  onDoubleClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
  colSizeWidth?: number;
  dateCols: DateColDef[];
  dragPaths: string[];
  subLabel?: string;
  gitSymbol?: string;
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

function applyStrftime(ts: number, fmt: string): string {
  const d = new Date(ts * 1000);
  return fmt
    .replace('%Y', String(d.getFullYear()))
    .replace('%m', String(d.getMonth() + 1).padStart(2, '0'))
    .replace('%d', String(d.getDate()).padStart(2, '0'))
    .replace('%H', String(d.getHours()).padStart(2, '0'))
    .replace('%M', String(d.getMinutes()).padStart(2, '0'))
    .replace('%S', String(d.getSeconds()).padStart(2, '0'));
}

function formatDateParts(
  ts: number | undefined,
  fmt: string,
  todayLabel: string,
  yesterdayLabel: string,
): { label: string; time: string } {
  if (!ts) return { label: '—', time: '' };

  if (fmt !== 'auto') {
    // Custom format: no label/time split, put everything in label
    return { label: applyStrftime(ts, fmt), time: '' };
  }

  const d = new Date(ts * 1000);
  const now = new Date();
  const hms = [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();

  if (isToday) return { label: todayLabel, time: hms };
  if (isYesterday) return { label: yesterdayLabel, time: hms };
  const date = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  return { label: date, time: hms };
}

const FILE_ICONS: Record<string, string> = {
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

function OfficeFileIcon({
  fill,
  foldFill,
  label,
}: {
  fill: string;
  foldFill: string;
  label: string;
}) {
  return (
    <span className="file-icon">
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
        <path d="M4 2h11l5 5v15a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" fill={fill} />
        <path d="M15 2v5h5z" fill={foldFill} />
        <text
          x="11.5"
          y="19"
          textAnchor="middle"
          fontSize="9"
          fontWeight="700"
          fill="#fff"
          fontFamily="Arial, sans-serif"
        >
          {label}
        </text>
      </svg>
    </span>
  );
}

const WordIcon = () => <OfficeFileIcon fill="#2B579A" foldFill="#17365D" label="W" />;
const ExcelIcon = () => <OfficeFileIcon fill="#217346" foldFill="#185C37" label="X" />;
const PowerPointIcon = () => <OfficeFileIcon fill="#B7472A" foldFill="#8C3521" label="P" />;

const OFFICE_ICONS: Record<string, () => React.JSX.Element> = {
  doc: WordIcon,
  docx: WordIcon,
  xls: ExcelIcon,
  xlsx: ExcelIcon,
  ppt: PowerPointIcon,
  pptx: PowerPointIcon,
};

const GIT_BADGE_CLASS: Record<string, string> = {
  '=': 'clean',
  M: 'modified',
  A: 'added',
  D: 'deleted',
  '?': 'untracked',
};

const GIT_BADGE_SYMBOL: Record<string, string> = {
  '=': '✓',
  M: '!',
  A: '+',
  D: '×',
  '?': '?',
};

function FileIcon({ entry }: { entry: FileEntry }) {
  if (entry.is_dir) return <span className="file-icon dir">📁</span>;
  const ext = entry.extension?.toLowerCase();
  const OfficeIcon = ext && OFFICE_ICONS[ext];
  if (OfficeIcon) return <OfficeIcon />;
  return <span className="file-icon">{(ext && FILE_ICONS[ext]) || '📄'}</span>;
}

export const FileRow = React.memo(function FileRow({
  entry,
  isCursor,
  isSelected,
  clipboardMode,
  onClick,
  onDoubleClick,
  onContextMenu,
  style,
  colSizeWidth,
  dateCols,
  dragPaths,
  subLabel,
  gitSymbol,
}: Props) {
  const { t } = useTranslation();
  const sizeUnit = useConfigStore((s) => s.appearance.size.unit);
  const rawPendingKey = useUiStore((s) => s.pendingKey);
  const pendingKey = isCursor ? rawPendingKey : null;
  return (
    <div
      className={`file-row${isCursor ? ' cursor' : ''}${isSelected ? ' selected' : ''}${entry.name.startsWith('.') ? ' hidden' : ''}${clipboardMode ? ` clipboard-${clipboardMode}` : ''}`}
      style={style}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      draggable
      onDragStart={(e) => {
        // HTML5 data for internal drops within this app
        e.dataTransfer.setData('text/plain', dragPaths[0]);
        e.dataTransfer.setData('application/x-folio-paths', JSON.stringify(dragPaths));
        // Native OS drag so external apps (Chrome, Finder, etc.) can receive real files
        if (isTauri()) {
          const label = dragPaths.length === 1 ? entry.name : `${dragPaths.length} items`;
          tauriApi.startNativeDrag(dragPaths, label).catch(console.error);
        }
      }}
    >
      <span className="file-select-indicator">{isSelected ? '✓' : ' '}</span>
      <span className="file-icon-wrapper">
        <FileIcon entry={entry} />
        {gitSymbol && (
          <span className={`file-git-badge git-badge-${GIT_BADGE_CLASS[gitSymbol] ?? 'unmerged'}`}>
            {GIT_BADGE_SYMBOL[gitSymbol] ?? '!'}
          </span>
        )}
      </span>
      <span className="file-name">
        {entry.name}
        {entry.is_symlink && (
          <span className="file-symlink-target"> → {entry.link_target ?? '?'}</span>
        )}
        {subLabel && <span className="file-sub-label">{subLabel}</span>}
      </span>
      {colSizeWidth !== undefined && (
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
      )}
      {dateCols.map((col) => {
        const ts =
          col.key === 'created'
            ? entry.created
            : col.key === 'accessed'
              ? entry.accessed
              : entry.modified;
        const { label, time } = formatDateParts(
          ts,
          col.format,
          t('fileDate.today'),
          t('fileDate.yesterday'),
        );
        return (
          <span key={col.key} className="file-date" style={{ width: col.width }}>
            <span className="file-date-label">{label}</span>
            {time && <span className="file-date-time">{time}</span>}
          </span>
        );
      })}
      {pendingKey && <span className="file-prefix-badge">{pendingKey} ▸</span>}
    </div>
  );
});
