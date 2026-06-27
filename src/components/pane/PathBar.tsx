import { useState, useRef, useEffect, useMemo } from 'react';
import { useTabStore } from '../../store/tabStore';
import { useUiStore } from '../../store/uiStore';
import { useBookmarkStore } from '../../store/bookmarkStore';
import { tauriApi } from '../../lib/tauri';

type PathBarMode = 'path' | 'zoxide' | 'bookmark';

export function PathBar() {
  const { activeTab, navigateTo } = useTabStore();
  const { setVimMode, hasZoxide } = useUiStore();
  const { bookmarks } = useBookmarkStore();
  const tab = activeTab();
  const currentPath = tab.path;

  const [editing, setEditing] = useState(false);
  const [mode, setMode] = useState<PathBarMode>('path');
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionIndex, setSuggestionIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);

  // Bookmark suggestions filtered by input
  const bookmarkSuggestions = useMemo(() => {
    if (mode !== 'bookmark') return [];
    const q = inputValue.toLowerCase();
    return bookmarks.filter(
      (b) => !q || b.label.toLowerCase().includes(q) || b.path.toLowerCase().includes(q)
    );
  }, [mode, inputValue, bookmarks]);

  // Exposed for Ctrl+L / z / b keys
  useEffect(() => {
    const handler = () => startMode('path', currentPath);
    const zoxideHandler = () => startMode('zoxide', '');
    const bookmarkHandler = () => startMode('bookmark', '');
    window.addEventListener('mac-filer:focus-path-bar', handler);
    window.addEventListener('mac-filer:focus-zoxide', zoxideHandler);
    window.addEventListener('mac-filer:focus-bookmarks', bookmarkHandler);
    return () => {
      window.removeEventListener('mac-filer:focus-path-bar', handler);
      window.removeEventListener('mac-filer:focus-zoxide', zoxideHandler);
      window.removeEventListener('mac-filer:focus-bookmarks', bookmarkHandler);
    };
  }, [currentPath]);

  const startMode = (m: PathBarMode, initialValue: string) => {
    setMode(m);
    setInputValue(initialValue);
    setEditing(true);
    setSuggestions([]);
    setSuggestionIndex(m === 'bookmark' ? (bookmarks.length > 0 ? 0 : -1) : -1);
    setTimeout(() => {
      if (initialValue) inputRef.current?.select();
      else inputRef.current?.focus();
    }, 0);
  };

  const close = () => {
    setEditing(false);
    setSuggestions([]);
    setSuggestionIndex(-1);
    setVimMode('NORMAL');
  };

  const commitPath = (value: string) => {
    close();
    if (!value) return;
    navigateTo(value);
  };

  const commitBookmark = (index: number) => {
    const bm = bookmarkSuggestions[index];
    if (!bm) return;
    close();
    navigateTo(bm.path);
  };

  const handleInputChange = async (value: string) => {
    setInputValue(value);

    if (mode === 'bookmark') {
      setSuggestionIndex(0);
      return;
    }

    if (!value || value.startsWith('/') || value.startsWith('~')) {
      setSuggestions([]);
      setSuggestionIndex(-1);
      return;
    }

    if (hasZoxide) {
      try {
        const results = await tauriApi.zoxideQuery(value);
        const trimmed = results.slice(0, 8);
        setSuggestions(trimmed);
        setSuggestionIndex(trimmed.length > 0 ? 0 : -1);
      } catch {
        setSuggestions([]);
        setSuggestionIndex(-1);
      }
    }
  };

  const listLength = mode === 'bookmark' ? bookmarkSuggestions.length : suggestions.length;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { close(); return; }
    if (e.ctrlKey && e.key === 'u') {
      e.preventDefault();
      setInputValue('');
      setSuggestions([]);
      setSuggestionIndex(mode === 'bookmark' ? 0 : -1);
      return;
    }
    if (e.key === 'Enter' && !composingRef.current) {
      e.preventDefault();
      if (mode === 'bookmark') {
        commitBookmark(suggestionIndex);
      } else {
        const val = suggestionIndex >= 0 ? suggestions[suggestionIndex] : inputValue;
        commitPath(val);
      }
      return;
    }
    const isCtrlJ = e.ctrlKey && e.key === 'j';
    const isCtrlK = e.ctrlKey && e.key === 'k';
    if (e.key === 'ArrowDown' || isCtrlJ) {
      e.preventDefault();
      setSuggestionIndex((i) => Math.min(i + 1, listLength - 1));
      return;
    }
    if (e.key === 'ArrowUp' || isCtrlK) {
      e.preventDefault();
      setSuggestionIndex((i) => Math.max(i - 1, 0));
      return;
    }
  };

  const segments = currentPath.split('/').filter(Boolean);

  const placeholder =
    mode === 'bookmark' ? '🔖 ブックマークを検索...' :
    mode === 'zoxide'   ? 'zoxide で移動先を検索...' :
    '';

  return (
    <div className="path-bar">
      {editing ? (
        <div className="path-edit-container">
          <input
            ref={inputRef}
            className={`path-input${mode !== 'path' ? ' path-input--search' : ''}`}
            value={inputValue}
            placeholder={placeholder}
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            onChange={(e) => handleInputChange(e.target.value)}
            onCompositionStart={() => { composingRef.current = true; }}
            onCompositionEnd={() => { setTimeout(() => { composingRef.current = false; }, 0); }}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              setTimeout(() => {
                setEditing(false);
                setSuggestions([]);
                setVimMode('NORMAL');
              }, 150);
            }}
          />
          {/* Zoxide suggestions */}
          {mode !== 'bookmark' && suggestions.length > 0 && (
            <div className="path-suggestions">
              {suggestions.map((s, i) => (
                <div
                  key={s}
                  className={`path-suggestion${i === suggestionIndex ? ' active' : ''}`}
                  onMouseDown={() => commitPath(s)}
                >
                  {s}
                </div>
              ))}
            </div>
          )}
          {/* Bookmark suggestions */}
          {mode === 'bookmark' && (
            <div className="path-suggestions">
              {bookmarkSuggestions.length === 0 ? (
                <div className="path-suggestion path-suggestion--empty">
                  {bookmarks.length === 0 ? 'ブックマークがありません (B キーで追加)' : '一致するブックマークがありません'}
                </div>
              ) : bookmarkSuggestions.map((bm, i) => (
                <div
                  key={bm.id}
                  className={`path-suggestion path-suggestion--bookmark${i === suggestionIndex ? ' active' : ''}`}
                  onMouseDown={() => commitBookmark(i)}
                >
                  <span className="path-suggestion-label">{bm.label}</span>
                  <span className="path-suggestion-path">{bm.path}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="path-breadcrumb" onClick={() => startMode('path', currentPath)}>
          <span
            className="path-segment"
            onClick={(e) => { e.stopPropagation(); navigateTo('/'); }}
          >
            /
          </span>
          {segments.map((seg, i) => {
            const segPath = '/' + segments.slice(0, i + 1).join('/');
            return (
              <span key={segPath}>
                {i > 0 && <span className="path-sep">/</span>}
                <span
                  className="path-segment"
                  onClick={(e) => { e.stopPropagation(); navigateTo(segPath); }}
                >
                  {seg}
                </span>
              </span>
            );
          })}
          <span className="path-edit-hint">クリックまたはCtrl+Lで編集</span>
        </div>
      )}
    </div>
  );
}
