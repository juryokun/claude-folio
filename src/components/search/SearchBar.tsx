import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useTabStore } from '../../store/tabStore';
import { useFileStore } from '../../store/fileStore';
import { useUiStore } from '../../store/uiStore';
import { useImeAwareEnter } from '../../hooks/useImeAwareEnter';
import { parseFilterQuery } from '../../lib/searchFilter';

export function SearchBar() {
  const { t } = useTranslation();
  const { activeTab } = useTabStore();
  const { getPane, setFilter, setCursor, filteredEntries } = useFileStore();
  const { vimMode, setVimMode } = useUiStore();

  const tab = activeTab();
  const pane = getPane(tab.id);
  const inputRef = useRef<HTMLInputElement>(null);
  const ime = useImeAwareEnter(() => setVimMode('NORMAL'));
  const parsedFilter = parseFilterQuery(pane.filterQuery);
  const isInvalidRegex = parsedFilter?.type === 'invalid_regex';
  const isRegexMode = parsedFilter?.type === 'regex';

  useEffect(() => {
    if (vimMode === 'SEARCH') {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [vimMode]);

  if (vimMode !== 'SEARCH') {
    if (!pane.filterQuery) return null;
    return (
      <div className={`search-bar inactive${isInvalidRegex ? ' search-bar--error' : ''}`}>
        <span>🔍</span>
        {isRegexMode && <span className="search-mode-badge">regex</span>}
        <span className="search-query">{pane.filterQuery}</span>
        <button onClick={() => { setFilter(tab.id, ''); }}>✕</button>
      </div>
    );
  }

  return (
    <div className={`search-bar active${isInvalidRegex ? ' search-bar--error' : ''}`}>
      <span>/</span>
      {isRegexMode && <span className="search-mode-badge">regex</span>}
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
        placeholder={t('searchBar.placeholder')}
      />
    </div>
  );
}
