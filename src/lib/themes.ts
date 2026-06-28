export type ThemeId = 'dark' | 'light' | 'monokai' | 'nord' | 'dracula' | 'gruvbox' | 'ayu-dark';

export interface Theme {
  id: ThemeId;
  label: string;
  vars: Record<string, string>;
}

export const THEMES: Theme[] = [
  {
    id: 'dark',
    label: 'Dark (VS Code)',
    vars: {
      '--bg': '#1e1e1e',
      '--bg-secondary': '#252526',
      '--bg-hover': '#2a2d2e',
      '--bg-active': '#094771',
      '--bg-selected': '#1a3a5c',
      '--text': '#cccccc',
      '--text-dim': '#6e7681',
      '--text-accent': '#4fc1ff',
      '--border': '#3c3c3c',
      '--cursor-bg': '#264f78',
    },
  },
  {
    id: 'light',
    label: 'Light',
    vars: {
      '--bg': '#ffffff',
      '--bg-secondary': '#f3f3f3',
      '--bg-hover': '#e8e8e8',
      '--bg-active': '#cce5ff',
      '--bg-selected': '#ddeeff',
      '--text': '#1f1f1f',
      '--text-dim': '#8a8a8a',
      '--text-accent': '#0066cc',
      '--border': '#d4d4d4',
      '--cursor-bg': '#b3d4f5',
    },
  },
  {
    id: 'monokai',
    label: 'Monokai',
    vars: {
      '--bg': '#272822',
      '--bg-secondary': '#2d2e27',
      '--bg-hover': '#3e3d32',
      '--bg-active': '#49483e',
      '--bg-selected': '#403e31',
      '--text': '#f8f8f2',
      '--text-dim': '#75715e',
      '--text-accent': '#e6db74',
      '--border': '#3e3d32',
      '--cursor-bg': '#49483e',
    },
  },
  {
    id: 'nord',
    label: 'Nord',
    vars: {
      '--bg': '#2e3440',
      '--bg-secondary': '#3b4252',
      '--bg-hover': '#434c5e',
      '--bg-active': '#4c566a',
      '--bg-selected': '#3d4c5e',
      '--text': '#d8dee9',
      '--text-dim': '#616e88',
      '--text-accent': '#88c0d0',
      '--border': '#434c5e',
      '--cursor-bg': '#4c566a',
    },
  },
  {
    id: 'dracula',
    label: 'Dracula',
    vars: {
      '--bg': '#282a36',
      '--bg-secondary': '#21222c',
      '--bg-hover': '#44475a',
      '--bg-active': '#44475a',
      '--bg-selected': '#383a4a',
      '--text': '#f8f8f2',
      '--text-dim': '#6272a4',
      '--text-accent': '#bd93f9',
      '--border': '#44475a',
      '--cursor-bg': '#44475a',
    },
  },
  {
    id: 'gruvbox',
    label: 'Gruvbox Dark',
    vars: {
      '--bg': '#282828',
      '--bg-secondary': '#1d2021',
      '--bg-hover': '#3c3836',
      '--bg-active': '#504945',
      '--bg-selected': '#3c3836',
      '--text': '#ebdbb2',
      '--text-dim': '#928374',
      '--text-accent': '#fabd2f',
      '--border': '#3c3836',
      '--cursor-bg': '#504945',
    },
  },
  {
    id: 'ayu-dark',
    label: 'Ayu Dark',
    vars: {
      '--bg': '#0a0e14',
      '--bg-secondary': '#0d1017',
      '--bg-hover': '#131721',
      '--bg-active': '#3d1f1f',
      '--bg-selected': '#2a1515',
      '--text': '#b3b1ad',
      '--text-dim': '#3d424d',
      '--text-accent': '#ff3333',
      '--border': '#1a1f29',
      '--cursor-bg': '#3d1f1f',
    },
  },
];

export function applyTheme(id: ThemeId): void {
  const theme = THEMES.find((t) => t.id === id);
  if (!theme) return;
  const root = document.documentElement;
  for (const [key, value] of Object.entries(theme.vars)) {
    root.style.setProperty(key, value);
  }
}

export function isValidThemeId(id: string): id is ThemeId {
  return THEMES.some((t) => t.id === id);
}
