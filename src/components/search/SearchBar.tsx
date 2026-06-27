import { useEffect, useRef } from 'react';
import { useTabStore } from '../../store/tabStore';
import { useFileStore } from '../../store/fileStore';
import { useUiStore } from '../../store/uiStore';
import { useImeAwareEnter } from '../../hooks/useImeAwareEnter';

export function SearchBar() {
  const { activeTab } = useTabStore();
  const { getPane, setFilter, setCursor, filteredEntries } = useFileStore();
  const { vimMode, setVimMode } = useUiStore();

  const tab = activeTab();
  const pane = getPane(tab.id);
  const inputRef = useRef<HTMLInputElement>(null);
  const ime = useImeAwareEnter(() => setVimMode('NORMAL'));

  useEffect(() => {
    if (vimMode === 'SEARCH') {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [vimMode]);

  if (vimMode !== 'SEARCH') {
    if (!pane.filterQuery) return null;
    return (
      <div className="search-bar inactive">
        <span>🔍</span>
        <span className="search-query">{pane.filterQuery}</span>
        <button onClick={() => { setFilter(tab.id, ''); }}>✕</button>
      </div>
    );
  }

  return (
    <div className="search-bar active">
      <span>/</span>
      <input
        ref={inputRef}
        className="search-input"
        value={pane.filterQuery}
        onChange={(e) => setFilter(tab.id, e.target.value)}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        {...ime.handlers}
        onKeyDown={(e) => {
          ime.handlers.onKeyDown(e);
          if (e.key === 'Escape') {
            setFilter(tab.id, '');
            setVimMode('NORMAL');
          }
          if ((e.key === 'j' || e.key === 'k') && e.ctrlKey) {
            e.preventDefault();
            const entries = filteredEntries(tab.id);
            const pane = getPane(tab.id);
            const max = Math.max(0, entries.length - 1);
            const next = e.key === 'j'
              ? Math.min(pane.cursor + 1, max)
              : Math.max(pane.cursor - 1, 0);
            setCursor(tab.id, next);
          }
        }}
        placeholder="検索..."
      />
    </div>
  );
}
