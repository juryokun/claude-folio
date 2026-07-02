// A tab switch (as opposed to a brand-new tab or in-tab navigation) should
// preserve the pane's cursor/selection/filter/find state instead of
// resetting it, but only when that pane has already been loaded once.
export function shouldPreserveCursor(
  prevTabId: string,
  currentTabId: string,
  paneExists: boolean,
): boolean {
  return prevTabId !== currentTabId && paneExists;
}
