import { useState, useRef, useEffect } from 'react';
import { useTabStore } from '../../store/tabStore';
import { useUiStore } from '../../store/uiStore';
import { tauriApi } from '../../lib/tauri';

export function PathBar() {
  const { activeTab, navigateTo } = useTabStore();
  const { setVimMode, hasZoxide } = useUiStore();
  const tab = activeTab();
  const currentPath = tab.path;

  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionIndex, setSuggestionIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  // Exposed for Ctrl+L / z key
  useEffect(() => {
    const handler = () => startEdit(currentPath);
    const zoxideHandler = () => startEdit('');
    window.addEventListener('mac-filer:focus-path-bar', handler);
    window.addEventListener('mac-filer:focus-zoxide', zoxideHandler);
    return () => {
      window.removeEventListener('mac-filer:focus-path-bar', handler);
      window.removeEventListener('mac-filer:focus-zoxide', zoxideHandler);
    };
  }, [currentPath]);

  const startEdit = (initialValue: string) => {
    setInputValue(initialValue);
    setEditing(true);
    setSuggestions([]);
    setSuggestionIndex(-1);
    setTimeout(() => {
      if (initialValue) {
        inputRef.current?.select();
      } else {
        inputRef.current?.focus();
      }
    }, 0);
  };

  const commitEdit = (value: string) => {
    setEditing(false);
    setSuggestions([]);
    setVimMode('NORMAL');
    if (!value) return;
    navigateTo(value);
  };

  const handleInputChange = async (value: string) => {
    setInputValue(value);

    if (!value) {
      setSuggestions([]);
      setSuggestionIndex(-1);
      return;
    }

    // Absolute path: show filesystem completions (simplified: just use zoxide)
    if (value.startsWith('/') || value.startsWith('~')) {
      setSuggestions([]);
      setSuggestionIndex(-1);
      return;
    }

    // Zoxide query — auto-select first result
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setEditing(false);
      setSuggestions([]);
      setSuggestionIndex(-1);
      setVimMode('NORMAL');
      return;
    }
    if (e.ctrlKey && e.key === 'u') {
      e.preventDefault();
      setInputValue('');
      setSuggestions([]);
      setSuggestionIndex(-1);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = suggestionIndex >= 0 ? suggestions[suggestionIndex] : inputValue;
      commitEdit(val);
      return;
    }
    const isCtrlJ = e.ctrlKey && e.key === 'j';
    const isCtrlK = e.ctrlKey && e.key === 'k';
    if (e.key === 'ArrowDown' || isCtrlJ) {
      e.preventDefault();
      setSuggestionIndex((i) => Math.min(i + 1, suggestions.length - 1));
      return;
    }
    if (e.key === 'ArrowUp' || isCtrlK) {
      e.preventDefault();
      setSuggestionIndex((i) => Math.max(i - 1, 0));
      return;
    }
  };

  const segments = currentPath.split('/').filter(Boolean);

  return (
    <div className="path-bar">
      {editing ? (
        <div className="path-edit-container">
          <input
            ref={inputRef}
            className="path-input"
            value={inputValue}
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              setTimeout(() => {
                setEditing(false);
                setSuggestions([]);
                setVimMode('NORMAL');
              }, 150);
            }}
          />
          {suggestions.length > 0 && (
            <div className="path-suggestions">
              {suggestions.map((s, i) => (
                <div
                  key={s}
                  className={`path-suggestion${i === suggestionIndex ? ' active' : ''}`}
                  onMouseDown={() => commitEdit(s)}
                >
                  {s}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="path-breadcrumb" onClick={() => startEdit(currentPath)}>
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
