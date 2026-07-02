import path from 'path-browserify';

/** Selection range to pre-select in the rename input: stem only for files, full name for directories. */
export function getRenameSelectionRange(
  baseName: string,
  isDir: boolean,
): { start: number; end: number } {
  if (isDir) return { start: 0, end: baseName.length };
  const ext = path.extname(baseName);
  const end = ext ? baseName.length - ext.length : baseName.length;
  return { start: 0, end };
}
