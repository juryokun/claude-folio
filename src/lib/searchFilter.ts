export type FilterResult =
  | { type: 'partial'; query: string; queryLower: string }
  | { type: 'regex'; regex: RegExp }
  | { type: 'invalid_regex'; raw: string };

/** Parse a filter query string into a typed result. */
export function parseFilterQuery(query: string): FilterResult | null {
  if (!query) return null;
  if (query.startsWith('/')) {
    const pattern = query.slice(1);
    try {
      return { type: 'regex', regex: new RegExp(pattern, 'i') };
    } catch {
      return { type: 'invalid_regex', raw: pattern };
    }
  }
  return { type: 'partial', query, queryLower: query.toLowerCase() };
}

/** Return true if the filename matches the parsed filter. */
export function matchesFilter(name: string, filter: FilterResult): boolean {
  switch (filter.type) {
    case 'partial':
      return name.toLowerCase().includes(filter.queryLower);
    case 'regex':
      return filter.regex.test(name);
    case 'invalid_regex':
      return false;
  }
}
