import { create } from 'zustand';
import { tauriApi } from '../lib/tauri';
import type { KeyBinding } from '../lib/vim/keymap';
import { NORMAL_KEYMAP } from '../lib/vim/keymap';
import { buildKeymap } from '../lib/vim/keymapUtils';

export interface DateColumnConfig {
  show: boolean;
  /** "auto" = today/yesterday logic, otherwise strftime-like format string */
  format: string;
}

export interface AppearanceConfig {
  dateModified: DateColumnConfig;
  dateCreated: DateColumnConfig;
  dateAccessed: DateColumnConfig;
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
  dateModified: { show: true, format: 'auto' },
  dateCreated: { show: false, format: 'auto' },
  dateAccessed: { show: false, format: 'auto' },
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
      const ra = raw.appearance as Record<string, unknown> | undefined;
      const parseDateCol = (key: string, defaultShow: boolean): DateColumnConfig => {
        const v = ra?.[key] as { show?: boolean; format?: string } | undefined;
        return { show: v?.show ?? defaultShow, format: v?.format ?? 'auto' };
      };
      const appearance: AppearanceConfig = {
        dateModified: parseDateCol('date_modified', true),
        dateCreated: parseDateCol('date_created', false),
        dateAccessed: parseDateCol('date_accessed', false),
        sizeUnit: ((ra?.size_unit as string) ?? 'binary') as 'binary' | 'decimal',
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
