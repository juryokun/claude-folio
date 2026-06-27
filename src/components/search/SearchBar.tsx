import { useEffect, useRef } from 'react';
import { useTabStore } from '../../store/tabStore';
import { useFileStore } from '../../store/fileStore';
import { useUiStore } from '../../store/uiStore';

export function SearchBar() {
  const { activeTab } = useTabStore();
  const { getPane, setFilter } = useFileStore();
  const { vimMode, setVimMode } = useUiStore();

  const tab = activeTab();
  const pane = getPane(tab.id);
  const inputRef = useRef<HTMLInputElement>(null);

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
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setFilter(tab.id, '');
            setVimMode('NORMAL');
          }
          if (e.key === 'Enter') {
            setVimMode('NORMAL');
          }
        }}
        placeholder="検索..."
      />
    </div>
  );
}
