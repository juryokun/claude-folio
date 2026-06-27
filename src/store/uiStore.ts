import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { VimMode } from '../types';

interface UiStore {
  vimMode: VimMode;
  showHidden: boolean;
  showHelp: boolean;
  showRename: boolean;
  showNewDir: boolean;
  showNewFile: boolean;
  showConfirm: boolean;
  confirmMessage: string;
  confirmCallback: (() => void) | null;
  showCommandPalette: boolean;
  renameTarget: string | null;
  showOpenWith: boolean;
  openWithTarget: string | null;
  has7zip: boolean;
  hasZoxide: boolean;
  terminalApp: string;
  terminalCommand: string;
  googleDrivePaths: string[];
  sidebarWidth: number;
  columnWidths: { size: number; date: number };
  statusMessage: string | null;
  editorCommand: string;
  showSidebar: boolean;
  showPreview: boolean;
  previewWidth: number;
  copyConflict: { conflicts: string[]; onResolve: (strategy: 'overwrite' | 'rename') => void } | null;

  setVimMode: (mode: VimMode) => void;
  setEditorCommand: (cmd: string) => void;
  setTerminalApp: (app: string) => void;
  setTerminalCommand: (cmd: string) => void;
  toggleSidebar: () => void;
  showStatusMessage: (msg: string, durationMs?: number) => void;
  toggleHidden: () => void;
  setShowHelp: (v: boolean) => void;
  setShowRename: (v: boolean, target?: string) => void;
  setShowNewDir: (v: boolean) => void;
  setShowNewFile: (v: boolean) => void;
  showConfirmDialog: (message: string, onConfirm: () => void) => void;
  closeConfirm: () => void;
  setShowCommandPalette: (v: boolean) => void;
  setShowOpenWith: (v: boolean, target?: string) => void;
  setHas7zip: (v: boolean) => void;
  setHasZoxide: (v: boolean) => void;
  setGoogleDrivePaths: (paths: string[]) => void;
  setSidebarWidth: (w: number) => void;
  setColumnWidths: (w: Partial<{ size: number; date: number }>) => void;
  togglePreview: () => void;
  setPreviewWidth: (w: number) => void;
  showCopyConflict: (conflicts: string[], onResolve: (strategy: 'overwrite' | 'rename') => void) => void;
  closeCopyConflict: () => void;
}

export const useUiStore = create<UiStore>()(
  persist(
    (set) => ({
      vimMode: 'NORMAL',
      showHidden: false,
      showHelp: false,
      showRename: false,
      showNewDir: false,
      showNewFile: false,
      showConfirm: false,
      confirmMessage: '',
      confirmCallback: null,
      showCommandPalette: false,
      renameTarget: null,
      showOpenWith: false,
      openWithTarget: null,
      has7zip: false,
      hasZoxide: false,
      terminalApp: '',
      terminalCommand: '',
      googleDrivePaths: [],
      sidebarWidth: 220,
      columnWidths: { size: 90, date: 140 },
      statusMessage: null,
      editorCommand: '',
      showSidebar: true,
      showPreview: false,
      previewWidth: 320,
      copyConflict: null,

      setVimMode: (mode) => set({ vimMode: mode }),
      setEditorCommand: (cmd) => set({ editorCommand: cmd }),
      setTerminalApp: (app) => set({ terminalApp: app }),
      setTerminalCommand: (cmd) => set({ terminalCommand: cmd }),
      toggleSidebar: () => set((s) => ({ showSidebar: !s.showSidebar })),
      showStatusMessage: (msg, durationMs = 2000) => {
        set({ statusMessage: msg });
        setTimeout(() => set({ statusMessage: null }), durationMs);
      },
      toggleHidden: () => set((s) => ({ showHidden: !s.showHidden })),
      setShowHelp: (v) => set({ showHelp: v }),
      setShowRename: (v, target) => set({ showRename: v, renameTarget: target ?? null }),
      setShowNewDir: (v) => set({ showNewDir: v }),
      setShowNewFile: (v) => set({ showNewFile: v }),
      showConfirmDialog: (message, onConfirm) =>
        set({ showConfirm: true, confirmMessage: message, confirmCallback: onConfirm }),
      closeConfirm: () => set({ showConfirm: false, confirmMessage: '', confirmCallback: null }),
      setShowCommandPalette: (v) => set({ showCommandPalette: v }),
      setShowOpenWith: (v, target) => set({ showOpenWith: v, openWithTarget: target ?? null }),
      setHas7zip: (v) => set({ has7zip: v }),
      setHasZoxide: (v) => set({ hasZoxide: v }),
      setGoogleDrivePaths: (paths) => set({ googleDrivePaths: paths }),
      setSidebarWidth: (w) => set({ sidebarWidth: w }),
      setColumnWidths: (w) => set((s) => ({ columnWidths: { ...s.columnWidths, ...w } })),
      togglePreview: () => set((s) => ({ showPreview: !s.showPreview })),
      setPreviewWidth: (w) => set({ previewWidth: w }),
      showCopyConflict: (conflicts, onResolve) => set({ copyConflict: { conflicts, onResolve } }),
      closeCopyConflict: () => set({ copyConflict: null }),
    }),
    {
      name: 'folio-ui',
      partialize: (s) => ({
        showHidden: s.showHidden,
        showSidebar: s.showSidebar,
        sidebarWidth: s.sidebarWidth,
        columnWidths: s.columnWidths,
        showPreview: s.showPreview,
        previewWidth: s.previewWidth,
      }),
    }
  )
);
