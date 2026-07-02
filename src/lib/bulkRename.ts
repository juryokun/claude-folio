import path from 'path-browserify';
import type { FileEntry } from '../types';

export interface SequenceOptions {
  prefix: string;
  suffix: string; // inserted right before the extension
  start: number; // starting number
  digits: number; // zero-padded width
  preserveExt: boolean; // true: keep the original extension
}

export interface RegexOptions {
  pattern: string;
  flags: string; // e.g. 'g', 'gi'
  replacement: string; // may contain $1 etc. capture references
  targetExt: boolean; // false (default): apply only to the name without its extension
}

export interface RenamePlanItem {
  from: string;
  fromName: string;
  to: string;
  toName: string;
}

export type RenamePlanError =
  | { code: 'empty_name'; fromName: string }
  | { code: 'invalid_name'; fromName: string }
  | { code: 'duplicate_name'; name: string }
  | { code: 'invalid_regex' };

export interface RenamePlanResult {
  items: RenamePlanItem[];
  errors: RenamePlanError[];
}

function splitExt(name: string, isDir: boolean): { base: string; ext: string } {
  if (isDir) return { base: name, ext: '' };
  const ext = path.extname(name);
  return { base: ext ? name.slice(0, -ext.length) : name, ext };
}

function buildItem(entry: FileEntry, toName: string): RenamePlanItem {
  return {
    from: entry.path,
    fromName: entry.name,
    to: path.join(path.dirname(entry.path), toName),
    toName,
  };
}

// Validates syntactic issues first, then checks that the *final* name of every
// entry in the directory (renamed entries get their planned name, everyone else
// keeps their current name) is unique. This catches cross-selection collisions
// (e.g. a.txt -> b.txt while b.txt is selected and renamed elsewhere) that a
// naive "does the target clash with a non-selected file" check would miss —
// renaming to a name another selected file currently holds would otherwise
// silently overwrite it depending on execution order (`std::fs::rename` has no
// overwrite protection).
function validatePlan(items: RenamePlanItem[], allEntries: FileEntry[]): RenamePlanError[] {
  const errors: RenamePlanError[] = [];
  for (const item of items) {
    if (!item.toName) {
      errors.push({ code: 'empty_name', fromName: item.fromName });
    } else if (item.toName.includes('/')) {
      errors.push({ code: 'invalid_name', fromName: item.fromName });
    }
  }
  if (errors.length > 0) return errors;

  const itemByFrom = new Map(items.map((item) => [item.from, item]));
  // macOS's default filesystems (APFS/HFS+) are case-insensitive, so two
  // names differing only in case are still a real collision there.
  const countByKey = new Map<string, number>();
  const nameByKey = new Map<string, string>();
  for (const entry of allEntries) {
    const finalName = itemByFrom.get(entry.path)?.toName ?? entry.name;
    const key = finalName.toLowerCase();
    countByKey.set(key, (countByKey.get(key) ?? 0) + 1);
    if (!nameByKey.has(key)) nameByKey.set(key, finalName);
  }
  for (const [key, count] of countByKey) {
    const name = nameByKey.get(key);
    if (count > 1 && name) errors.push({ code: 'duplicate_name', name });
  }
  return errors;
}

export function planSequenceRename(
  selected: FileEntry[],
  allEntries: FileEntry[],
  opts: SequenceOptions,
): RenamePlanResult {
  const items = selected.map((entry, i) => {
    const { ext } = splitExt(entry.name, entry.is_dir);
    const num = String(opts.start + i).padStart(opts.digits, '0');
    const stem = `${opts.prefix}${num}${opts.suffix}`;
    const toName = opts.preserveExt ? `${stem}${ext}` : stem;
    return buildItem(entry, toName);
  });
  const errors = validatePlan(items, allEntries);
  return { items: errors.length ? [] : items, errors };
}

export function planRegexRename(
  selected: FileEntry[],
  allEntries: FileEntry[],
  opts: RegexOptions,
): RenamePlanResult {
  let regex: RegExp;
  try {
    regex = new RegExp(opts.pattern, opts.flags);
  } catch {
    return { items: [], errors: [{ code: 'invalid_regex' }] };
  }

  const items = selected.map((entry) => {
    const { base, ext } = splitExt(entry.name, entry.is_dir);
    const target = opts.targetExt ? entry.name : base;
    const replaced = target.replace(regex, opts.replacement);
    const toName = opts.targetExt ? replaced : `${replaced}${ext}`;
    return buildItem(entry, toName);
  });
  const errors = validatePlan(items, allEntries);
  return { items: errors.length ? [] : items, errors };
}
