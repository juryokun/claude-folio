import type { KeyBinding, VimAction } from './keymap';
import { NORMAL_KEYMAP } from './keymap';

/** Parse "d d" → ['d','d'], "j" → ['j'] */
export function parseSequence(seq: string): string[] {
  return seq.trim().split(/\s+/);
}

/** Merge config keymap overrides into the default keymap */
export function buildKeymap(overrides: Record<string, string[]>): KeyBinding[] {
  if (!overrides || Object.keys(overrides).length === 0) return NORMAL_KEYMAP;

  const actionsOverridden = new Set(Object.keys(overrides) as VimAction[]);
  const base = NORMAL_KEYMAP.filter((kb) => !actionsOverridden.has(kb.action));

  const additions: KeyBinding[] = [];
  for (const [action, sequences] of Object.entries(overrides)) {
    for (const seq of sequences) {
      additions.push({ keys: parseSequence(seq), action: action as VimAction });
    }
  }

  return [...base, ...additions];
}
