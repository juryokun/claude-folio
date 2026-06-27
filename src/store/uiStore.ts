import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { VimMode, TerminalEmulator } from '../types';

interface UiStore {
  vimMode: VimMode;
  showHidden: boolean;
  showHelp: boolean;
  showSettings: boolean;
  showRename: boolean;
  showNewDir: boolean;
  showConfirm: boolean;
  confirmMessage: string;
  confirmCallback: (() => void) | null;
  showCommandPalette: boolean;
  renameTarget: string | null;
  has7zip: boolean;
  hasZoxide: boolean;
  terminalEmulator: TerminalEmulator;
  googleDrivePaths: string[];
  sidebarWidth: number;
  statusMessage: string | null;

  setVimMode: (mode: VimMode) => void;
  showStatusMessage: (msg: string, durationMs?: number) => void;
  toggleHidden: () => void;
  setShowHelp: (v: boolean) => void;
  setShowSettings: (v: boolean) => void;
  setShowRename: (v: boolean, target?: string) => void;
  setShowNewDir: (v: boolean) => void;
  showConfirmDialog: (message: string, onConfirm: () => void) => void;
  closeConfirm: () => void;
  setShowCommandPalette: (v: boolean) => void;
  setHas7zip: (v: boolean) => void;
  setHasZoxide: (v: boolean) => void;
  setTerminalEmulator: (v: TerminalEmulator) => void;
  setGoogleDrivePaths: (paths: string[]) => void;
  setSidebarWidth: (w: number) => void;
}

export const useUiStore = create<UiStore>()(
  persist(
    (set) => ({
      vimMode: 'NORMAL',
      showHidden: false,
      showHelp: false,
      showSettings: false,
      showRename: false,
      showNewDir: false,
      showConfirm: false,
      confirmMessage: '',
      confirmCallback: null,
      showCommandPalette: false,
      renameTarget: null,
      has7zip: false,
      hasZoxide: false,
      terminalEmulator: 'terminal',
      googleDrivePaths: [],
      sidebarWidth: 220,
      statusMessage: null,

      setVimMode: (mode) => set({ vimMode: mode }),
      showStatusMessage: (msg, durationMs = 2000) => {
        set({ statusMessage: msg });
        setTimeout(() => set({ statusMessage: null }), durationMs);
      },
      toggleHidden: () => set((s) => ({ showHidden: !s.showHidden })),
      setShowHelp: (v) => set({ showHelp: v }),
      setShowSettings: (v) => set({ showSettings: v }),
      setShowRename: (v, target) => set({ showRename: v, renameTarget: target ?? null }),
      setShowNewDir: (v) => set({ showNewDir: v }),
      showConfirmDialog: (message, onConfirm) =>
        set({ showConfirm: true, confirmMessage: message, confirmCallback: onConfirm }),
      closeConfirm: () => set({ showConfirm: false, confirmMessage: '', confirmCallback: null }),
      setShowCommandPalette: (v) => set({ showCommandPalette: v }),
      setHas7zip: (v) => set({ has7zip: v }),
      setHasZoxide: (v) => set({ hasZoxide: v }),
      setTerminalEmulator: (v) => set({ terminalEmulator: v }),
      setGoogleDrivePaths: (paths) => set({ googleDrivePaths: paths }),
      setSidebarWidth: (w) => set({ sidebarWidth: w }),
    }),
    {
      name: 'mac-filer-ui',
      partialize: (s) => ({
        showHidden: s.showHidden,
        terminalEmulator: s.terminalEmulator,
        sidebarWidth: s.sidebarWidth,
      }),
    }
  )
);
