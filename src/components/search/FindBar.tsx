import { useEffect, useRef, useState } from 'react';
import { useTabStore } from '../../store/tabStore';
import { useFileStore } from '../../store/fileStore';
import { useUiStore } from '../../store/uiStore';
import { useImeAwareEnter } from '../../hooks/useImeAwareEnter';

export function FindBar() {
  const { activeTab } = useTabStore();
  const { startFind, clearFind, getPane } = useFileStore();
  const { showFind, findType, closeFind, hasFd } = useUiStore();

  const tab = activeTab();
  const pane = getPane(tab.id);
  const findMode = pane.findMode;

  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const ime = useImeAwareEnter(() => {
    if (query.trim()) {
      startFind(tab.id, query.trim(), findType, tab.path);
    }
    closeFind();
  });

  useEffect(() => {
    if (showFind) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [showFind]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    ime.handlers.onKeyDown(e);
    if (e.key === 'Escape') {
      closeFind();
      clearFind(tab.id);
    }
  };

  // Inactive banner shown while find results are displayed
  if (!showFind) {
    if (!findMode) return null;
    const label = findMode.type === 'file' ? 'ff' : findMode.type === 'dir' ? 'fd' : 'fa';
    const count = findMode.loading ? '…' : String(findMode.results.length);
    return (
      <div className="find-bar find-bar--inactive">
        <span className="find-bar-badge">{label}</span>
        <span className="find-bar-query">{findMode.query}</span>
        <span className="find-bar-count">{count}件</span>
        <button onClick={() => clearFind(tab.id)}>✕</button>
      </div>
    );
  }

  const prompt = findType === 'file' ? 'find files:' : findType === 'dir' ? 'find dirs:' : 'find all:';
  const badge = findType === 'file' ? 'ff' : findType === 'dir' ? 'fd' : 'fa';

  return (
    <div className="find-bar find-bar--active">
      <span className="find-bar-badge">{badge}</span>
      <span className="find-bar-prompt">{prompt}</span>
      <input
        ref={inputRef}
        className="find-bar-input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        placeholder={hasFd ? '検索パターン...' : 'fd がインストールされていません'}
        disabled={!hasFd}
        {...ime.handlers}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}
