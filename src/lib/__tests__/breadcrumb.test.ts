import { describe, expect, it } from 'vitest';
import { buildBreadcrumbItems } from '../breadcrumb';

describe('buildBreadcrumbItems', () => {
  it('returns all segments when count is within maxVisible', () => {
    const result = buildBreadcrumbItems('/Users/juryokun/folio', 4);
    expect(result.truncated).toBe(false);
    expect(result.hiddenPath).toBe('');
    expect(result.items).toEqual([
      { seg: 'Users', path: '/Users' },
      { seg: 'juryokun', path: '/Users/juryokun' },
      { seg: 'folio', path: '/Users/juryokun/folio' },
    ]);
  });

  it('returns all segments when count equals maxVisible', () => {
    const result = buildBreadcrumbItems('/a/b/c/d', 4);
    expect(result.truncated).toBe(false);
    expect(result.items).toHaveLength(4);
  });

  it('truncates to last maxVisible segments when path is long', () => {
    const result = buildBreadcrumbItems(
      '/Users/juryokun/Practice/github.com/juryokun/folio/src',
      4,
    );
    expect(result.truncated).toBe(true);
    expect(result.items).toHaveLength(4);
    expect(result.items[0].seg).toBe('github.com');
    expect(result.items[3].seg).toBe('src');
  });

  it('sets correct paths for truncated segments', () => {
    const result = buildBreadcrumbItems('/a/b/c/d/e', 3);
    expect(result.items).toEqual([
      { seg: 'c', path: '/a/b/c' },
      { seg: 'd', path: '/a/b/c/d' },
      { seg: 'e', path: '/a/b/c/d/e' },
    ]);
  });

  it('sets hiddenPath to the omitted prefix', () => {
    const result = buildBreadcrumbItems('/a/b/c/d/e', 3);
    expect(result.hiddenPath).toBe('/a/b');
  });

  it('handles root path with no segments', () => {
    const result = buildBreadcrumbItems('/', 4);
    expect(result.truncated).toBe(false);
    expect(result.items).toHaveLength(0);
  });

  it('handles single segment path', () => {
    const result = buildBreadcrumbItems('/Users', 4);
    expect(result.truncated).toBe(false);
    expect(result.items).toEqual([{ seg: 'Users', path: '/Users' }]);
  });
});
