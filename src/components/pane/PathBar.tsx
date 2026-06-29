import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buildBreadcrumbItems } from '../../lib/breadcrumb';
import { favoritePath } from '../../lib/favorites';
import { commonPrefix, expandTilde } from '../../lib/pathCompletion';
import { tauriApi } from '../../lib/tauri';
import { useBookmarkStore } from '../../store/bookmarkStore';
import { useConfigStore } from '../../store/configStore';
import { useTabStore } from '../../store/tabStore';
import { useUiStore } from '../../store/uiStore';

interface PickerItem {
  id: string;
  label: string;
  path: string;
  isFavorite?: boolean;
}

type PathBarMode = 'path' | 'bookmark';

function getHome(): string {
  return window.__macFilerHome ?? `/Users/${window.__macFilerUsername ?? 'user'}`;
}

export function PathBar() {
  const { t } = useTranslation();
  const { activeTab, navigateTo } = useTabStore();
  const { setVimMode, hasZoxide } = useUiStore();
  const { bookmarks } = useBookmarkStore();
  const favorites = useConfigStore((s) => s.favorites);
  const tab = activeTab();
  const currentPath = tab.path;

  const [editing, setEditing] = useState(false);
  const [mode, setMode] = useState<PathBarMode>('path');
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionIndex, setSuggestionIndex] = useState(-1);
  // 'fs' | 'zoxide' — which backend is currently powering the suggestion list
  const [completionSource, setCompletionSource] = useState<'fs' | 'zoxide'>('fs');
  const inputRef = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);
  const imeEndedAtRef = useRef(0);

  const allPickerItems = useMemo((): PickerItem[] => {
    const home = getHome();
    const favItems: PickerItem[] = favorites.map((key) => ({
      id: `fav:${key}`,
      label: t(`sidebar.${key}`),
      path: favoritePath(key, home),
      isFavorite: true,
    }));
    const bmItems: PickerItem[] = bookmarks.map((b) => ({
      id: `bm:${b.id}`,
      label: b.label,
      path: b.path,
    }));
    return [...favItems, ...bmItems];
  }, [favorites, bookmarks, t]);

  const bookmarkSuggestions = useMemo(() => {
    if (mode !== 'bookmark') return [];
    const q = inputValue.toLowerCase();
    return allPickerItems.filter(
      (item) => !q || item.label.toLowerCase().includes(q) || item.path.toLowerCase().includes(q),
    );
  }, [mode, inputValue, allPickerItems]);

  const startMode = useCallback(
    (m: PathBarMode, initialValue: string) => {
      setMode(m);
      setInputValue(initialValue);
      setEditing(true);
      setSuggestions([]);
      setSuggestionIndex(m === 'bookmark' ? (allPickerItems.length > 0 ? 0 : -1) : -1);
      setCompletionSource('fs');
      setTimeout(() => {
        if (initialValue) inputRef.current?.select();
        else inputRef.current?.focus();
      }, 0);
    },
    [allPickerItems.length],
  );

  useEffect(() => {
    const handler = () => startMode('path', currentPath);
    const zoxideHandler = () => startMode('path', '');
    const bookmarkHandler = () => startMode('bookmark', '');
    window.addEventListener('folio:focus-path-bar', handler);
    window.addEventListener('folio:focus-zoxide', zoxideHandler);
    window.addEventListener('folio:focus-bookmarks', bookmarkHandler);
    return () => {
      window.removeEventListener('folio:focus-path-bar', handler);
      window.removeEventListener('folio:focus-zoxide', zoxideHandler);
      window.removeEventListener('folio:focus-bookmarks', bookmarkHandler);
    };
  }, [currentPath, startMode]);

  const close = () => {
    setEditing(false);
    setSuggestions([]);
    setSuggestionIndex(-1);
    setVimMode('NORMAL');
  };

  const commitPath = (value: string) => {
    close();
    if (!value) return;
    navigateTo(expandTilde(value, getHome()));
  };

  const commitBookmark = (index: number) => {
    const item = bookmarkSuggestions[index];
    if (!item) return;
    close();
    navigateTo(item.path);
  };

  // keepIndexAtMinus1: true after Tab — suggestions are shown as guide only, Enter uses inputValue
  const fetchCompletions = useCallback(
    async (value: string, keepIndexAtMinus1 = false) => {
      if (!value) {
        setSuggestions([]);
        setSuggestionIndex(-1);
        return;
      }

      const expanded = expandTilde(value, getHome());
      const isAbsPath = expanded.startsWith('/');

      if (isAbsPath) {
        try {
          const results = await tauriApi.listDirCompletions(expanded);
          setSuggestions(results);
          setSuggestionIndex(keepIndexAtMinus1 ? -1 : results.length > 0 ? 0 : -1);
          setCompletionSource('fs');
        } catch {
          setSuggestions([]);
          setSuggestionIndex(-1);
        }
      } else if (hasZoxide) {
        try {
          const results = await tauriApi.zoxideQuery(value);
          const trimmed = results.slice(0, 8);
          setSuggestions(trimmed);
          setSuggestionIndex(keepIndexAtMinus1 ? -1 : trimmed.length > 0 ? 0 : -1);
          setCompletionSource('zoxide');
        } catch {
          setSuggestions([]);
          setSuggestionIndex(-1);
        }
      } else {
        setSuggestions([]);
        setSuggestionIndex(-1);
      }
    },
    [hasZoxide],
  );

  const handleInputChange = (value: string) => {
    setInputValue(value);
    if (mode === 'bookmark') {
      setSuggestionIndex(0);
      return;
    }
    fetchCompletions(value);
  };

  const listLength = mode === 'bookmark' ? bookmarkSuggestions.length : suggestions.length;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      close();
      return;
    }

    if (e.ctrlKey && e.key === 'u') {
      e.preventDefault();
      setInputValue('');
      setSuggestions([]);
      setSuggestionIndex(mode === 'bookmark' ? 0 : -1);
      return;
    }

    // Tab in bookmark mode: fill input with selected item's path and switch to path mode
    if (e.key === 'Tab' && mode === 'bookmark') {
      e.preventDefault();
      const item = bookmarkSuggestions[suggestionIndex];
      if (item) {
        const path = item.path.endsWith('/') ? item.path : `${item.path}/`;
        setMode('path');
        setInputValue(path);
        fetchCompletions(path, true);
      }
      return;
    }

    // Tab: complete to current suggestion or common prefix
    if (e.key === 'Tab' && mode === 'path' && suggestions.length > 0) {
      e.preventDefault();
      if (suggestionIndex >= 0) {
        const completed = suggestions[suggestionIndex];
        setInputValue(completed);
        fetchCompletions(completed, true);
      } else {
        const prefix = commonPrefix(suggestions);
        if (prefix.length > expandTilde(inputValue, getHome()).length) {
          setInputValue(prefix);
          fetchCompletions(prefix, true);
        }
      }
      return;
    }

    if (e.key === 'Enter' && !composingRef.current && Date.now() - imeEndedAtRef.current >= 50) {
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

  const {
    items: breadcrumbItems,
    truncated,
    hiddenPath,
  } = useMemo(() => buildBreadcrumbItems(currentPath), [currentPath]);

  const placeholder =
    mode === 'bookmark' ? t('pathBar.bookmarkSearch') : t('pathBar.pathOrKeyword');

  return (
    <div className="path-bar">
      {editing ? (
        <div className="path-edit-container">
          <input
            ref={inputRef}
            className="path-input"
            value={inputValue}
            placeholder={placeholder}
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            onChange={(e) => handleInputChange(e.target.value)}
            onCompositionStart={() => {
              composingRef.current = true;
            }}
            onCompositionEnd={() => {
              composingRef.current = false;
              imeEndedAtRef.current = Date.now();
            }}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              setTimeout(() => {
                setEditing(false);
                setSuggestions([]);
                setVimMode('NORMAL');
              }, 150);
            }}
          />
          {/* Path / zoxide suggestions */}
          {mode === 'path' && suggestions.length > 0 && (
            <div className="path-suggestions">
              {completionSource === 'fs' && (
                <div className="path-suggestions-header">{t('pathBar.directoryCompletion')}</div>
              )}
              {suggestions.map((s, i) => (
                <div
                  key={s}
                  className={`path-suggestion${i === suggestionIndex ? ' active' : ''}`}
                  onMouseDown={() => {
                    if (completionSource === 'fs') {
                      setInputValue(s);
                      fetchCompletions(s, true);
                      inputRef.current?.focus();
                    } else {
                      commitPath(s);
                    }
                  }}
                >
                  {completionSource === 'fs'
                    ? (() => {
                        const parts = s.split('/').filter(Boolean);
                        return `${parts[parts.length - 1]}/`;
                      })()
                    : s}
                  {completionSource === 'fs' && <span className="path-suggestion-full">{s}</span>}
                </div>
              ))}
            </div>
          )}
          {/* Bookmark/Favorites picker */}
          {mode === 'bookmark' && (
            <div className="path-suggestions">
              {bookmarkSuggestions.length === 0 ? (
                <div className="path-suggestion path-suggestion--empty">
                  {t('pathBar.noMatches')}
                </div>
              ) : (
                bookmarkSuggestions.map((item, i) => (
                  <div
                    key={item.id}
                    className={`path-suggestion path-suggestion--bookmark${i === suggestionIndex ? ' active' : ''}`}
                    onMouseDown={() => commitBookmark(i)}
                  >
                    <span className="path-suggestion-label">
                      {item.isFavorite ? '📁 ' : '🔖 '}
                      {item.label}
                    </span>
                    <span className="path-suggestion-path">{item.path}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="path-breadcrumb" onClick={() => startMode('path', currentPath)}>
          {truncated ? (
            <span className="path-ellipsis" title={hiddenPath}>
              ...
            </span>
          ) : (
            <span
              className="path-segment"
              onClick={(e) => {
                e.stopPropagation();
                navigateTo('/');
              }}
            >
              /
            </span>
          )}
          {breadcrumbItems.map((item, i) => {
            const isLast = i === breadcrumbItems.length - 1;
            return (
              <span key={item.path} className={isLast ? 'path-crumb-last' : undefined}>
                <span className="path-sep">/</span>
                <span
                  className="path-segment"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateTo(item.path);
                  }}
                >
                  {item.seg}
                </span>
              </span>
            );
          })}
          <span className="path-edit-hint">{t('pathBar.editHint')}</span>
        </div>
      )}
    </div>
  );
}
