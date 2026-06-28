import { describe, it, expect } from 'vitest';
import {
  substitutePlaceholders,
  shouldShowOutputModal,
  pushHistory,
} from '../customCommands';

describe('substitutePlaceholders', () => {
  const ctx = { file: '/home/user/docs/report.pdf', dir: '/home/user/docs', name: 'report.pdf' };

  it('replaces {file}', () => {
    expect(substitutePlaceholders('open {file}', ctx)).toBe('open /home/user/docs/report.pdf');
  });

  it('replaces {dir}', () => {
    expect(substitutePlaceholders('ls {dir}', ctx)).toBe('ls /home/user/docs');
  });

  it('replaces {name}', () => {
    expect(substitutePlaceholders('echo {name}', ctx)).toBe('echo report.pdf');
  });

  it('replaces multiple placeholders', () => {
    expect(substitutePlaceholders('cp {file} {dir}/backup_{name}', ctx))
      .toBe('cp /home/user/docs/report.pdf /home/user/docs/backup_report.pdf');
  });

  it('replaces repeated placeholder', () => {
    expect(substitutePlaceholders('{file} {file}', ctx))
      .toBe('/home/user/docs/report.pdf /home/user/docs/report.pdf');
  });

  it('leaves unknown placeholders untouched', () => {
    expect(substitutePlaceholders('echo {unknown}', ctx)).toBe('echo {unknown}');
  });

  it('no placeholders returns command unchanged', () => {
    expect(substitutePlaceholders('git status', ctx)).toBe('git status');
  });
});

describe('shouldShowOutputModal', () => {
  it('returns false for short output', () => {
    expect(shouldShowOutputModal('done\n')).toBe(false);
  });

  it('returns true when lines exceed threshold', () => {
    const output = Array.from({ length: 6 }, (_, i) => `line ${i}`).join('\n');
    expect(shouldShowOutputModal(output)).toBe(true);
  });

  it('returns true when chars exceed threshold', () => {
    expect(shouldShowOutputModal('a'.repeat(301))).toBe(true);
  });
});

describe('pushHistory', () => {
  it('prepends entry to history', () => {
    expect(pushHistory(['b', 'c'], 'a')).toEqual(['a', 'b', 'c']);
  });

  it('deduplicates existing entry', () => {
    expect(pushHistory(['a', 'b', 'c'], 'b')).toEqual(['b', 'a', 'c']);
  });

  it('caps at 100 entries', () => {
    const history = Array.from({ length: 100 }, (_, i) => `cmd${i}`);
    const result = pushHistory(history, 'new');
    expect(result.length).toBe(100);
    expect(result[0]).toBe('new');
  });
});
