export interface BreadcrumbItem {
  seg: string;
  path: string;
}

export interface BreadcrumbResult {
  items: BreadcrumbItem[];
  truncated: boolean;
  hiddenPath: string;
}

export function buildBreadcrumbItems(currentPath: string, maxVisible = 4): BreadcrumbResult {
  const segments = currentPath.split('/').filter(Boolean);
  const truncated = segments.length > maxVisible;
  const offset = truncated ? segments.length - maxVisible : 0;
  const visible = truncated ? segments.slice(-maxVisible) : segments;
  const items = visible.map((seg, i) => ({
    seg,
    path: `/${segments.slice(0, offset + i + 1).join('/')}`,
  }));
  const hiddenPath = truncated ? `/${segments.slice(0, offset).join('/')}` : '';
  return { items, truncated, hiddenPath };
}
