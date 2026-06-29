/** Replace home directory prefix with `~`. */
export function abbreviatePath(path: string, home: string): string {
  if (path === home) return '~';
  if (path.startsWith(`${home}/`)) return `~${path.slice(home.length)}`;
  return path;
}

/** Return the last path segment with a trailing slash. */
export function basename(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts.length > 0 ? `${parts[parts.length - 1]}/` : '/';
}

/** Longest common prefix across all strings in the array. */
export function commonPrefix(strs: string[]): string {
  if (strs.length === 0) return '';
  let prefix = strs[0];
  for (let i = 1; i < strs.length; i++) {
    while (!strs[i].startsWith(prefix)) {
      prefix = prefix.slice(0, -1);
    }
  }
  return prefix;
}

/** Expand a leading `~` to the given home directory. */
export function expandTilde(value: string, home: string): string {
  if (value === '~') return `${home}/`;
  if (value.startsWith('~/')) return home + value.slice(1);
  return value;
}
