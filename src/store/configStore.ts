import { create } from 'zustand';
import { tauriApi } from '../lib/tauri';
import type { KeyBinding, VimAction } from '../lib/vim/keymap';
import { NORMAL_KEYMAP } from '../lib/vim/keymap';

export interface AppearanceConfig {
  dateFormat: string;  // e.g. "%Y/%m/%d"
  sizeUnit: 'binary' | 'decimal';
}

export type FavoriteKey =
  | 'home' | 'desktop' | 'documents' | 'downloads'
  | 'pictures' | 'music' | 'movies' | 'applications' | 'public';

const DEFAULT_FAVORITES: FavoriteKey[] = [
  'home', 'desktop', 'documents', 'downloads',
  'pictures', 'music', 'movies', 'applications',
];

interface ConfigStore {
  appearance: AppearanceConfig;
  keymap: KeyBinding[];
  favorites: FavoriteKey[];
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
  favorites: DEFAULT_FAVORITES,
  loaded: false,

  load: async () => {
    try {
      const raw = await tauriApi.loadConfig();
      const appearance: AppearanceConfig = {
        dateFormat: raw.appearance?.date_format ?? DEFAULT_APPEARANCE.dateFormat,
        sizeUnit: (raw.appearance?.size_unit ?? 'binary') as 'binary' | 'decimal',
      };
      const keymap = buildKeymap(raw.keymap ?? {});
      const favorites = (raw.sidebar?.favorites ?? DEFAULT_FAVORITES) as FavoriteKey[];
      const { useUiStore } = await import('./uiStore');
      const editorCommand = raw.editor?.command ?? '';
      if (editorCommand) useUiStore.getState().setEditorCommand(editorCommand);
      const terminalApp = raw.terminal?.app ?? '';
      if (terminalApp) useUiStore.getState().setTerminalApp(terminalApp);
      const terminalCommand = raw.terminal?.command ?? '';
      if (terminalCommand) useUiStore.getState().setTerminalCommand(terminalCommand);
      const language = (raw.language ?? 'ja') as 'ja' | 'en';
      useUiStore.getState().setLanguage(language);
      set({ appearance, keymap, favorites, loaded: true });
    } catch {
      set({ loaded: true }); // use defaults on error
    }
  },
}));
