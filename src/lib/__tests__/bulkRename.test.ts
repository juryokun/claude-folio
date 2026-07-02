import { describe, expect, it } from 'vitest';
import type { FileEntry } from '../../types';
import { planRegexRename, planSequenceRename } from '../bulkRename';

function entry(name: string, isDir = false): FileEntry {
  return { name, path: `/dir/${name}`, is_dir: isDir, is_symlink: false, size: 0 };
}

describe('planSequenceRename', () => {
  const all = [entry('a.jpg'), entry('b.jpg'), entry('c.jpg')];

  it('assigns zero-padded sequential numbers in input order', () => {
    const result = planSequenceRename(all, all, {
      prefix: 'photo_',
      suffix: '',
      start: 1,
      digits: 3,
      preserveExt: true,
    });
    expect(result.errors).toEqual([]);
    expect(result.items.map((i) => i.toName)).toEqual([
      'photo_001.jpg',
      'photo_002.jpg',
      'photo_003.jpg',
    ]);
  });

  it('honors a custom start number', () => {
    const result = planSequenceRename(all, all, {
      prefix: '',
      suffix: '',
      start: 10,
      digits: 2,
      preserveExt: true,
    });
    expect(result.items.map((i) => i.toName)).toEqual(['10.jpg', '11.jpg', '12.jpg']);
  });

  it('drops the extension when preserveExt is false', () => {
    const result = planSequenceRename([entry('a.jpg')], all, {
      prefix: 'file',
      suffix: '',
      start: 1,
      digits: 1,
      preserveExt: false,
    });
    expect(result.items[0].toName).toBe('file1');
  });

  it('does not split a dotted directory name as an extension', () => {
    const dirEntry = entry('v1.2-release', true);
    const result = planSequenceRename([dirEntry], [dirEntry], {
      prefix: 'backup_',
      suffix: '',
      start: 1,
      digits: 1,
      preserveExt: true,
    });
    expect(result.items[0].toName).toBe('backup_1');
  });

  it('reports a collision with a non-selected existing file', () => {
    const conflict = [...all, entry('photo_001.jpg')];
    const result = planSequenceRename(all, conflict, {
      prefix: 'photo_',
      suffix: '',
      start: 1,
      digits: 3,
      preserveExt: true,
    });
    expect(result.errors).toEqual([{ code: 'duplicate_name', name: 'photo_001.jpg' }]);
    expect(result.items).toEqual([]);
  });

  it('rejects a target name containing a path separator', () => {
    const result = planSequenceRename([entry('a.jpg')], all, {
      prefix: '../evil/',
      suffix: '',
      start: 1,
      digits: 1,
      preserveExt: false,
    });
    expect(result.errors).toEqual([{ code: 'invalid_name', fromName: 'a.jpg' }]);
    expect(result.items).toEqual([]);
  });

  it('is case-insensitive when detecting collisions (macOS default filesystem)', () => {
    const conflict = [entry('a.jpg'), entry('PHOTO_001')];
    const result = planSequenceRename([entry('a.jpg')], conflict, {
      prefix: 'photo_',
      suffix: '',
      start: 1,
      digits: 3,
      preserveExt: false,
    });
    expect(result.errors).toEqual([{ code: 'duplicate_name', name: 'photo_001' }]);
  });
});

describe('planRegexRename', () => {
  const all = [entry('IMG_001.jpg'), entry('IMG_002.jpg')];

  it('applies capture-group replacement to the name without extension', () => {
    const result = planRegexRename(all, all, {
      pattern: 'IMG_(\\d+)',
      flags: '',
      replacement: 'photo-$1',
      targetExt: false,
    });
    expect(result.errors).toEqual([]);
    expect(result.items.map((i) => i.toName)).toEqual(['photo-001.jpg', 'photo-002.jpg']);
  });

  it('applies the replacement to the full name including extension when targetExt is true', () => {
    const result = planRegexRename([entry('a.txt')], [entry('a.txt')], {
      pattern: '\\.txt$',
      flags: '',
      replacement: '.md',
      targetExt: true,
    });
    expect(result.items[0].toName).toBe('a.md');
  });

  it('returns an error for an invalid regex pattern', () => {
    const result = planRegexRename(all, all, {
      pattern: '[unclosed',
      flags: '',
      replacement: 'x',
      targetExt: false,
    });
    expect(result.errors).toEqual([{ code: 'invalid_regex' }]);
    expect(result.items).toEqual([]);
  });

  it('reports a duplicate-name error when the replacement collapses two names into one', () => {
    const result = planRegexRename(all, all, {
      pattern: 'IMG_\\d+',
      flags: '',
      replacement: 'same',
      targetExt: false,
    });
    expect(result.errors).toEqual([{ code: 'duplicate_name', name: 'same.jpg' }]);
    expect(result.items).toEqual([]);
  });

  it('reports a collision when a selected file is renamed to another selected file’s current name', () => {
    // IMG_002.jpg -> IMG_001.jpg while IMG_001.jpg is itself selected (and would be
    // renamed away). Silently allowing this would let filesystem rename order decide
    // whether IMG_001.jpg's original contents survive.
    const result = planRegexRename(all, all, {
      pattern: 'IMG_002',
      flags: '',
      replacement: 'IMG_001',
      targetExt: false,
    });
    expect(result.errors).toEqual([{ code: 'duplicate_name', name: 'IMG_001.jpg' }]);
    expect(result.items).toEqual([]);
  });

  it('replaces all occurrences when the global flag is set', () => {
    const result = planRegexRename([entry('a-a.txt')], [entry('a-a.txt')], {
      pattern: 'a',
      flags: 'g',
      replacement: 'b',
      targetExt: false,
    });
    expect(result.items[0].toName).toBe('b-b.txt');
  });

  it('replaces only the first occurrence without the global flag', () => {
    const result = planRegexRename([entry('a-a.txt')], [entry('a-a.txt')], {
      pattern: 'a',
      flags: '',
      replacement: 'b',
      targetExt: false,
    });
    expect(result.items[0].toName).toBe('b-a.txt');
  });
});
