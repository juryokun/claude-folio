import { create } from 'zustand';
import type { CustomCommand, ShellOutput } from '../lib/customCommands';
import { loadHistory, pushHistory, saveHistory } from '../lib/customCommands';
import { tauriApi } from '../lib/tauri';

interface CustomCommandStore {
  commands: CustomCommand[];
  history: string[];
  output: (ShellOutput & { command: string }) | null;

  loadCommands: () => Promise<void>;
  runCommand: (command: string, shell: string, cwd: string, label: string) => Promise<ShellOutput>;
  pushHistory: (entry: string) => void;
  clearOutput: () => void;
}

export const useCustomCommandStore = create<CustomCommandStore>((set, get) => ({
  commands: [],
  history: loadHistory(),
  output: null,

  loadCommands: async () => {
    const commands = await tauriApi.loadCustomCommands();
    set({ commands });
  },

  runCommand: async (command, shell, cwd, label) => {
    const result = await tauriApi.runShellCommand(shell, command, cwd);
    set({ output: { ...result, command: label } });
    return result;
  },

  pushHistory: (entry) => {
    const next = pushHistory(get().history, entry);
    saveHistory(next);
    set({ history: next });
  },

  clearOutput: () => set({ output: null }),
}));
