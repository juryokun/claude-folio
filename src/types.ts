export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  is_symlink: boolean;
  link_target?: string;
  size: number;
  modified?: number; // Unix timestamp seconds
  created?: number; // Unix timestamp seconds
  accessed?: number; // Unix timestamp seconds
  extension?: string;
}

export interface Tab {
  id: string;
  path: string;
  history: string[];
  historyIndex: number;
}

export interface Bookmark {
  id: string;
  label: string;
  path: string;
}

export type ClipboardMode = 'copy' | 'cut';

export interface ClipboardState {
  paths: string[];
  mode: ClipboardMode;
}

export type VimMode = 'NORMAL' | 'SEARCH' | 'COMMAND';

export type TerminalEmulator = 'terminal' | 'iterm2' | 'warp';
