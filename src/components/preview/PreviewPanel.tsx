import { convertFileSrc } from '@tauri-apps/api/core';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { tauriApi } from '../../lib/tauri';
import { useFileStore } from '../../store/fileStore';
import { useTabStore } from '../../store/tabStore';
import { useUiStore } from '../../store/uiStore';
import type { FileEntry } from '../../types';

type PreviewState =
  | { kind: 'none' }
  | { kind: 'loading' }
  | { kind: 'image'; src: string }
  | { kind: 'video'; src: string }
  | { kind: 'audio'; src: string }
  | { kind: 'text'; content: string; language: string }
  | { kind: 'dir'; entries: FileEntry[] }
  | { kind: 'binary' }
  | { kind: 'error'; message: string };

const IMAGE_EXTS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'svg',
  'bmp',
  'ico',
  'tiff',
  'tif',
  'avif',
  'heic',
  'heif',
]);
const VIDEO_EXTS = new Set(['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'flv']);
const AUDIO_EXTS = new Set(['mp3', 'wav', 'aac', 'flac', 'm4a', 'ogg', 'opus']);
const TEXT_EXTS = new Set([
  'txt',
  'md',
  'markdown',
  'rst',
  'log',
  'csv',
  'tsv',
  'json',
  'jsonc',
  'json5',
  'yaml',
  'yml',
  'toml',
  'ini',
  'env',
  'js',
  'jsx',
  'ts',
  'tsx',
  'mjs',
  'cjs',
  'html',
  'htm',
  'xml',
  'svg',
  'css',
  'scss',
  'less',
  'rs',
  'py',
  'rb',
  'go',
  'java',
  'kt',
  'swift',
  'c',
  'cpp',
  'cc',
  'h',
  'hpp',
  'sh',
  'bash',
  'zsh',
  'fish',
  'ps1',
  'bat',
  'sql',
  'graphql',
  'proto',
  'dockerfile',
  'gitignore',
  'editorconfig',
  'vue',
  'svelte',
  'astro',
  'php',
  'lua',
  'r',
  'dart',
  'cs',
]);

function getExt(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}

function guessLanguage(ext: string): string {
  const map: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    kt: 'kotlin',
    swift: 'swift',
    c: 'c',
    cpp: 'cpp',
    cc: 'cpp',
    h: 'c',
    hpp: 'cpp',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    fish: 'fish',
    html: 'html',
    htm: 'html',
    xml: 'xml',
    svg: 'xml',
    css: 'css',
    scss: 'scss',
    less: 'less',
    json: 'json',
    jsonc: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    sql: 'sql',
    md: 'markdown',
    vue: 'vue',
    svelte: 'svelte',
    php: 'php',
  };
  return map[ext] ?? 'plaintext';
}

export function PreviewPanel() {
  const { t } = useTranslation();
  const { previewWidth, setPreviewWidth } = useUiStore();
  const { activeTabId } = useTabStore();
  const { getPane, filteredEntries } = useFileStore();
  const pane = getPane(activeTabId);
  const entries = filteredEntries(activeTabId);
  const entry = entries[pane.cursor] ?? null;
  const [preview, setPreview] = useState<PreviewState>({ kind: 'none' });
  const prevPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!entry) {
      setPreview({ kind: 'none' });
      return;
    }
    if (entry.path === prevPathRef.current) return;
    prevPathRef.current = entry.path;

    if (entry.is_dir) {
      setPreview({ kind: 'loading' });
      tauriApi
        .listDir(entry.path, false)
        .then((entries) => {
          if (entry.path !== prevPathRef.current) return;
          const sorted = [...entries].sort((a, b) => {
            if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
            return a.name.localeCompare(b.name, 'ja');
          });
          setPreview({ kind: 'dir', entries: sorted });
        })
        .catch(() => {
          if (entry.path !== prevPathRef.current) return;
          setPreview({ kind: 'dir', entries: [] });
        });
      return;
    }

    const ext = getExt(entry.name);

    if (IMAGE_EXTS.has(ext)) {
      setPreview({ kind: 'image', src: convertFileSrc(entry.path) });
      return;
    }
    if (VIDEO_EXTS.has(ext)) {
      setPreview({ kind: 'video', src: convertFileSrc(entry.path) });
      return;
    }
    if (AUDIO_EXTS.has(ext)) {
      setPreview({ kind: 'audio', src: convertFileSrc(entry.path) });
      return;
    }
    if (TEXT_EXTS.has(ext) || ext === '') {
      setPreview({ kind: 'loading' });
      tauriApi
        .readTextFile(entry.path)
        .then((content) => {
          if (entry.path !== prevPathRef.current) return;
          setPreview({ kind: 'text', content, language: guessLanguage(ext) });
        })
        .catch((e) => {
          if (entry.path !== prevPathRef.current) return;
          const msg = String(e);
          if (msg === 'binary') setPreview({ kind: 'binary' });
          else setPreview({ kind: 'error', message: msg });
        });
      return;
    }

    setPreview({ kind: 'binary' });
  }, [entry]);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = previewWidth;
    const onMove = (ev: MouseEvent) => {
      setPreviewWidth(Math.max(200, Math.min(800, startWidth - (ev.clientX - startX))));
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
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="preview-panel" style={{ width: previewWidth }}>
      <div className="preview-resizer" onMouseDown={startResize} />
      <div className="preview-content">
        {!entry && <div className="preview-empty">{t('previewPanel.noSelection')}</div>}

        {entry && (
          <>
            <div className="preview-header">
              <div className="preview-filename">{entry.name}</div>
              <div className="preview-meta">
                {!entry.is_dir && entry.size != null && <span>{formatSize(entry.size)}</span>}
              </div>
            </div>

            <div className="preview-body">
              {preview.kind === 'loading' && (
                <div className="preview-empty">{t('previewPanel.loading')}</div>
              )}

              {preview.kind === 'image' && (
                <div className="preview-image-wrap">
                  <img
                    src={preview.src}
                    alt={entry.name}
                    className="preview-image"
                    onError={() =>
                      setPreview({ kind: 'error', message: t('previewPanel.imageLoadError') })
                    }
                  />
                </div>
              )}

              {preview.kind === 'video' && (
                <video key={preview.src} src={preview.src} controls className="preview-video" />
              )}

              {preview.kind === 'audio' && (
                <div className="preview-audio-wrap">
                  <div className="preview-audio-icon">🎵</div>
                  <audio key={preview.src} src={preview.src} controls className="preview-audio" />
                </div>
              )}

              {preview.kind === 'text' && (
                <pre className="preview-text">
                  <code>{preview.content}</code>
                </pre>
              )}

              {preview.kind === 'binary' && (
                <div className="preview-empty">
                  <div className="preview-binary-icon">📄</div>
                  <div>{t('previewPanel.binaryFile')}</div>
                  {entry.size != null && (
                    <div className="preview-meta">{formatSize(entry.size)}</div>
                  )}
                </div>
              )}

              {preview.kind === 'dir' && (
                <div className="preview-dir">
                  {preview.entries.length === 0 ? (
                    <div className="preview-dir-empty">{t('previewPanel.emptyFolder')}</div>
                  ) : (
                    <div className="preview-dir-list">
                      {preview.entries.map((e) => (
                        <div key={e.path} className="preview-dir-row">
                          <span className="preview-dir-icon">{e.is_dir ? '📁' : '📄'}</span>
                          <span className="preview-dir-name">{e.name}</span>
                          <span className="preview-dir-meta">
                            {!e.is_dir && e.size != null && (
                              <span className="preview-dir-size">{formatSize(e.size)}</span>
                            )}
                            {e.modified != null && (
                              <span className="preview-dir-date">
                                {new Date(e.modified * 1000).toLocaleDateString('ja-JP', {
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {preview.kind === 'error' && (
                <div className="preview-empty preview-error">{preview.message}</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
