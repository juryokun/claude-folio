import { invoke, isTauri, Channel } from '@tauri-apps/api/core';
import type { FileEntry } from '../types';

export { isTauri };

export const tauriApi = {
  listDir: (path: string, showHidden: boolean) =>
    invoke<FileEntry[]>('list_dir', { path, showHidden }),

  renameFile: (from: string, to: string) =>
    invoke<void>('rename_file', { from, to }),

  copyFiles: (sources: string[], dest: string) =>
    invoke<void>('copy_files', { sources, dest }),

  moveFiles: (sources: string[], dest: string) =>
    invoke<void>('move_files', { sources, dest }),

  createDir: (path: string) =>
    invoke<void>('create_dir', { path }),

  createFile: (path: string) =>
    invoke<void>('create_file', { path }),

  moveToTrash: (paths: string[]) =>
    invoke<void>('move_to_trash', { paths }),

  copyPathToClipboard: (paths: string[]) =>
    invoke<void>('copy_path_to_clipboard', { paths }),

  copyNameToClipboard: (paths: string[]) =>
    invoke<void>('copy_name_to_clipboard', { paths }),

  openFile: (path: string) =>
    invoke<void>('open_file', { path }),

  openWithApp: (path: string, app: string) =>
    invoke<void>('open_with_app', { path, app }),

  listApplications: () =>
    invoke<string[]>('list_applications'),

  openWithCommand: (path: string, cmd: string) =>
    invoke<void>('open_with_editor', { path, editorCmd: cmd }),

  openWithEditor: (path: string, editorCmd: string) =>
    invoke<void>('open_with_editor', { path, editorCmd }),

  openTerminalAt: (path: string, app: string, command: string) =>
    invoke<void>('open_terminal_at', { path, app, command }),

  detectGoogleDrive: () =>
    invoke<string[]>('detect_google_drive'),

  suppressDsStore: () =>
    invoke<void>('suppress_ds_store'),

  checkZoxideInstalled: () =>
    invoke<boolean>('check_zoxide_installed'),

  zoxideQuery: (query: string) =>
    invoke<string[]>('zoxide_query', { query }),

  zoxideAdd: (path: string) =>
    invoke<void>('zoxide_add', { path }),

  searchFiles: (root: string, query: string, maxResults = 500) =>
    invoke<FileEntry[]>('search_files', { root, query, maxResults }),

  check7zipInstalled: () =>
    invoke<boolean>('check_7zip_installed'),

  compress7zip: (paths: string[], dest: string, windowsCompat = true) =>
    invoke<void>('compress_7zip', { paths, dest, windowsCompat }),

  extract7zip: (archive: string, dest: string) =>
    invoke<void>('extract_7zip', { archive, dest }),

  watchDir: (path: string) =>
    invoke<void>('watch_dir', { path }),

  unwatchDir: () =>
    invoke<void>('unwatch_dir'),

  loadBookmarks: () =>
    invoke<{ label: string; path: string }[]>('load_bookmarks'),

  saveBookmarks: (bookmarks: { label: string; path: string }[]) =>
    invoke<void>('save_bookmarks', { bookmarks }),

  loadConfig: () =>
    invoke<{ appearance?: { date_format?: string; size_unit?: string }; editor?: { command?: string }; terminal?: { app?: string; command?: string }; keymap?: Record<string, string[]> }>('load_config'),

  initConfig: () =>
    invoke<string>('init_config'),

  startNativeDrag: (paths: string[], label: string): Promise<void> => {
    // Build a simple PNG drag image via canvas
    const canvas = document.createElement('canvas');
    const scale = window.devicePixelRatio || 1;
    const w = Math.min(260, label.length * 8 + 32);
    canvas.width = w * scale;
    canvas.height = 28 * scale;
    canvas.style.width = `${w}px`;
    canvas.style.height = '28px';
    const ctx = canvas.getContext('2d')!;
    ctx.scale(scale, scale);
    ctx.fillStyle = 'rgba(30, 30, 30, 0.85)';
    ctx.roundRect(0, 0, w, 28, 6);
    ctx.fill();
    ctx.fillStyle = '#cccccc';
    ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(paths.length > 1 ? `${paths.length} 個のアイテム` : label, 10, 19);
    const image = canvas.toDataURL('image/png');

    const onEvent = new Channel();
    return invoke('plugin:drag|start_drag', { item: paths, image, onEvent });
  },
};
