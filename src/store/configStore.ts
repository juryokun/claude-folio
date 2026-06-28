import { create } from 'zustand';
import { tauriApi } from '../lib/tauri';
import type { KeyBinding } from '../lib/vim/keymap';
import { NORMAL_KEYMAP } from '../lib/vim/keymap';
import { buildKeymap } from '../lib/vim/keymapUtils';

export interface AppearanceConfig {
  sizeUnit: 'binary' | 'decimal';
}

export type FavoriteKey =
  | 'home'
  | 'desktop'
  | 'documents'
  | 'downloads'
  | 'pictures'
  | 'music'
  | 'movies'
  | 'applications'
  | 'public';

const DEFAULT_FAVORITES: FavoriteKey[] = [
  'home',
  'desktop',
  'documents',
  'downloads',
  'pictures',
  'music',
  'movies',
  'applications',
];

interface ConfigStore {
  appearance: AppearanceConfig;
  keymap: KeyBinding[];
  favorites: FavoriteKey[];
  loaded: boolean;
  load: () => Promise<void>;
}

const DEFAULT_APPEARANCE: AppearanceConfig = {
  sizeUnit: 'binary',
};

export const useConfigStore = create<ConfigStore>((set) => ({
  appearance: DEFAULT_APPEARANCE,
  keymap: NORMAL_KEYMAP,
  favorites: DEFAULT_FAVORITES,
  loaded: false,

  load: async () => {
    try {
      const raw = await tauriApi.loadConfig();
      const appearance: AppearanceConfig = {
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
