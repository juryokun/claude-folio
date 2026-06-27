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

  // Exposed for Ctrl+L from vim keys
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      if (e.type === 'mac-filer:focus-path-bar') startEdit();
    };
    window.addEventListener('mac-filer:focus-path-bar', handler as EventListener);
    return () => window.removeEventListener('mac-filer:focus-path-bar', handler as EventListener);
  }, [currentPath]);

  const startEdit = () => {
    setInputValue(currentPath);
    setEditing(true);
    setSuggestions([]);
    setTimeout(() => inputRef.current?.select(), 0);
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
    setSuggestionIndex(-1);

    if (!value) {
      setSuggestions([]);
      return;
    }

    // Absolute path: show filesystem completions (simplified: just use zoxide)
    if (value.startsWith('/') || value.startsWith('~')) {
      setSuggestions([]);
      return;
    }

    // Zoxide query
    if (hasZoxide) {
      try {
        const results = await tauriApi.zoxideQuery(value);
        setSuggestions(results.slice(0, 8));
      } catch {
        setSuggestions([]);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setEditing(false);
      setSuggestions([]);
      setVimMode('NORMAL');
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = suggestionIndex >= 0 ? suggestions[suggestionIndex] : inputValue;
      commitEdit(val);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSuggestionIndex((i) => Math.min(i + 1, suggestions.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSuggestionIndex((i) => Math.max(i - 1, -1));
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
        <div className="path-breadcrumb" onClick={startEdit}>
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
                <span className="path-sep">/</span>
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
