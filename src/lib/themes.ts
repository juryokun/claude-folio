export type ThemeId = 'dark' | 'light';

export interface Theme {
  id: ThemeId;
  label: string;
  vars: Record<string, string>;
}

export const THEMES: Theme[] = [
  {
    id: 'dark',
    label: 'Dark',
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
