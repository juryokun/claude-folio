import { describe, expect, it } from 'vitest';
import { getRenameSelectionRange } from '../renameSelection';

describe('getRenameSelectionRange', () => {
  it('selects the name up to the extension for a normal file', () => {
    expect(getRenameSelectionRange('file.txt', false)).toEqual({ start: 0, end: 4 });
  });

  it('selects up to the last extension for multi-dot names', () => {
    expect(getRenameSelectionRange('archive.tar.gz', false)).toEqual({ start: 0, end: 11 });
  });

  it('selects the whole name for a dotfile with no extension', () => {
    expect(getRenameSelectionRange('.gitignore', false)).toEqual({ start: 0, end: 10 });
  });

  it('selects the whole name for a file with no extension', () => {
    expect(getRenameSelectionRange('README', false)).toEqual({ start: 0, end: 6 });
  });

  it('selects the whole name for a directory, even with dots', () => {
    expect(getRenameSelectionRange('v1.2-release', true)).toEqual({ start: 0, end: 12 });
  });

  it('selects the whole name for a directory with no dots', () => {
    expect(getRenameSelectionRange('node_modules', true)).toEqual({ start: 0, end: 12 });
  });
});
