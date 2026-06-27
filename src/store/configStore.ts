import { create } from 'zustand';
import { tauriApi } from '../lib/tauri';
import type { KeyBinding, VimAction } from '../lib/vim/keymap';
import { NORMAL_KEYMAP } from '../lib/vim/keymap';

export interface AppearanceConfig {
  dateFormat: string;  // e.g. "%Y/%m/%d"
  sizeUnit: 'binary' | 'decimal';
}

interface ConfigStore {
  appearance: AppearanceConfig;
  keymap: KeyBinding[];
  loaded: boolean;
  load: () => Promise<void>;
}

const DEFAULT_APPEARANCE: AppearanceConfig = {
  dateFormat: '%Y/%m/%d',
  sizeUnit: 'binary',
};

/** Parse "d d" → ['d','d'], "j" → ['j'] */
function parseSequence(seq: string): string[] {
  return seq.trim().split(/\s+/);
}

/** Merge config keymap overrides into the default keymap */
function buildKeymap(overrides: Record<string, string[]>): KeyBinding[] {
  if (!overrides || Object.keys(overrides).length === 0) return NORMAL_KEYMAP;

  // Start from defaults, drop any actions that are being overridden
  const actionsOverridden = new Set(Object.keys(overrides) as VimAction[]);
  const base = NORMAL_KEYMAP.filter((kb) => !actionsOverridden.has(kb.action));

  // Add the new bindings from config
  const additions: KeyBinding[] = [];
  for (const [action, sequences] of Object.entries(overrides)) {
    for (const seq of sequences) {
      additions.push({ keys: parseSequence(seq), action: action as VimAction });
    }
  }

  return [...base, ...additions];
}

export const useConfigStore = create<ConfigStore>((set) => ({
  appearance: DEFAULT_APPEARANCE,
  keymap: NORMAL_KEYMAP,
  loaded: false,

  load: async () => {
    try {
      const raw = await tauriApi.loadConfig();
      const appearance: AppearanceConfig = {
        dateFormat: raw.appearance?.date_format ?? DEFAULT_APPEARANCE.dateFormat,
        sizeUnit: (raw.appearance?.size_unit ?? 'binary') as 'binary' | 'decimal',
      };
      const keymap = buildKeymap(raw.keymap ?? {});
      const { useUiStore } = await import('./uiStore');
      const editorCommand = raw.editor?.command ?? '';
      if (editorCommand) useUiStore.getState().setEditorCommand(editorCommand);
      const terminalApp = raw.terminal?.app ?? '';
      if (terminalApp) useUiStore.getState().setTerminalApp(terminalApp);
      const terminalCommand = raw.terminal?.command ?? '';
      if (terminalCommand) useUiStore.getState().setTerminalCommand(terminalCommand);
      set({ appearance, keymap, loaded: true });
    } catch {
      set({ loaded: true }); // use defaults on error
    }
  },
}));
