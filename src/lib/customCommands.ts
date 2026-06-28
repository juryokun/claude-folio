export type OutputMode = 'auto' | 'modal';

export interface CustomCommand {
  name: string;
  desc: string;
  command: string;
  shell: string;
  reload: boolean;
  confirm: boolean;
  output: OutputMode;
}

export interface ShellOutput {
  stdout: string;
  stderr: string;
  exit_code: number;
}

export interface PlaceholderContext {
  file: string;
  dir: string;
  name: string;
}

export function substitutePlaceholders(command: string, ctx: PlaceholderContext): string {
  return command
    .replace(/\{file\}/g, ctx.file)
    .replace(/\{dir\}/g, ctx.dir)
    .replace(/\{name\}/g, ctx.name);
}

const OUTPUT_MODAL_LINE_THRESHOLD = 5;
const OUTPUT_MODAL_CHAR_THRESHOLD = 300;

export function shouldShowOutputModal(output: string): boolean {
  const lines = output.trimEnd().split('\n').length;
  return lines > OUTPUT_MODAL_LINE_THRESHOLD || output.length > OUTPUT_MODAL_CHAR_THRESHOLD;
}

const HISTORY_KEY = 'folio-shell-history';
const HISTORY_MAX = 100;

export function loadHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function saveHistory(history: string[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, HISTORY_MAX)));
}

export function pushHistory(history: string[], entry: string): string[] {
  const deduped = history.filter((h) => h !== entry);
  return [entry, ...deduped].slice(0, HISTORY_MAX);
}
