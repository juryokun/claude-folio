import { invoke } from '@tauri-apps/api/core';
import type { FileEntry } from '../types';

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

  moveToTrash: (paths: string[]) =>
    invoke<void>('move_to_trash', { paths }),

  copyPathToClipboard: (paths: string[]) =>
    invoke<void>('copy_path_to_clipboard', { paths }),

  copyNameToClipboard: (paths: string[]) =>
    invoke<void>('copy_name_to_clipboard', { paths }),

  openTerminalAt: (path: string, emulator: string) =>
    invoke<void>('open_terminal_at', { path, emulator }),

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
};
