import { describe, it, expect } from 'vitest';
import { parseSequence, buildKeymap } from '../keymapUtils';
import { NORMAL_KEYMAP } from '../keymap';

describe('parseSequence', () => {
  it('parses a single key', () => {
    expect(parseSequence('j')).toEqual(['j']);
  });

  it('parses a two-key sequence', () => {
    expect(parseSequence('d d')).toEqual(['d', 'd']);
  });

  it('parses "g g" as two keys', () => {
    expect(parseSequence('g g')).toEqual(['g', 'g']);
  });

  it('trims leading and trailing whitespace', () => {
    expect(parseSequence('  j  ')).toEqual(['j']);
  });

  it('collapses multiple spaces between keys', () => {
    expect(parseSequence('d  d')).toEqual(['d', 'd']);
  });
});

describe('buildKeymap', () => {
  it('returns NORMAL_KEYMAP unchanged when overrides is empty', () => {
    expect(buildKeymap({})).toBe(NORMAL_KEYMAP);
  });

  it('replaces bindings for overridden actions', () => {
    const km = buildKeymap({ cursor_down: ['n'] });
    const binding = km.find((b) => b.action === 'cursor_down');
    expect(binding).toBeDefined();
    expect(binding?.keys).toEqual(['n']);
    // default 'j' binding for cursor_down should be gone
    const oldBinding = km.find((b) => b.keys[0] === 'j' && b.action === 'cursor_down');
    expect(oldBinding).toBeUndefined();
  });

  it('keeps unrelated default bindings', () => {
    const km = buildKeymap({ cursor_down: ['n'] });
    const cursorUp = km.find((b) => b.action === 'cursor_up');
    expect(cursorUp).toBeDefined();
  });

  it('supports multiple sequences for one action', () => {
    const km = buildKeymap({ cursor_down: ['n', 'Ctrl+j'] });
    const bindings = km.filter((b) => b.action === 'cursor_down');
    expect(bindings.length).toBe(2);
    expect(bindings.map((b) => b.keys)).toContainEqual(['n']);
    expect(bindings.map((b) => b.keys)).toContainEqual(['Ctrl+j']);
  });

  it('supports chord sequences in overrides', () => {
    const km = buildKeymap({ delete_selected: ['d d'] });
    const binding = km.find((b) => b.action === 'delete_selected');
    expect(binding).toBeDefined();
    expect(binding?.keys).toEqual(['d', 'd']);
  });
});

describe('NORMAL_KEYMAP', () => {
  it('has no duplicate key sequences', () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const kb of NORMAL_KEYMAP) {
      const key = kb.keys.join('+');
      if (seen.has(key)) duplicates.push(key);
      seen.add(key);
    }
    expect(duplicates).toEqual([]);
  });

  describe('o prefix group', () => {
    it('oo → open_default', () => {
      const kb = NORMAL_KEYMAP.find((b) => b.keys.join('') === 'oo');
      expect(kb?.action).toBe('open_default');
    });
    it('oe → open_editor', () => {
      const kb = NORMAL_KEYMAP.find((b) => b.keys.join('') === 'oe');
      expect(kb?.action).toBe('open_editor');
    });
    it('ow → open_with_app', () => {
      const kb = NORMAL_KEYMAP.find((b) => b.keys.join('') === 'ow');
      expect(kb?.action).toBe('open_with_app');
    });
    it('oq → quick_look', () => {
      const kb = NORMAL_KEYMAP.find((b) => b.keys.join('') === 'oq');
      expect(kb?.action).toBe('quick_look');
    });
    it('standalone o has no binding', () => {
      const kb = NORMAL_KEYMAP.find((b) => b.keys.length === 1 && b.keys[0] === 'o');
      expect(kb).toBeUndefined();
    });
  });

  describe('n prefix group', () => {
    it('nd → new_dir', () => {
      const kb = NORMAL_KEYMAP.find((b) => b.keys.join('') === 'nd');
      expect(kb?.action).toBe('new_dir');
    });
    it('nf → new_file', () => {
      const kb = NORMAL_KEYMAP.find((b) => b.keys.join('') === 'nf');
      expect(kb?.action).toBe('new_file');
    });
    it('standalone n has no binding', () => {
      const kb = NORMAL_KEYMAP.find((b) => b.keys.length === 1 && b.keys[0] === 'n');
      expect(kb).toBeUndefined();
    });
  });

  it('T → open_terminal_here', () => {
    const kb = NORMAL_KEYMAP.find((b) => b.keys.length === 1 && b.keys[0] === 'T');
    expect(kb?.action).toBe('open_terminal_here');
  });

  it('open_terminal action is not in NORMAL_KEYMAP', () => {
    const kb = NORMAL_KEYMAP.find((b) => b.action === ('open_terminal' as string));
    expect(kb).toBeUndefined();
  });
});
