import path from 'path-browserify';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useImeAwareEnter } from '../../hooks/useImeAwareEnter';
import { tauriApi } from '../../lib/tauri';
import { useUiStore } from '../../store/uiStore';

export function OpenWithModal() {
  const { t } = useTranslation();
  const { showOpenWith, openWithTarget, setShowOpenWith, showStatusMessage } = useUiStore();
  const [input, setInput] = useState('');
  const [apps, setApps] = useState<string[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const ime = useImeAwareEnter(() => handleOpen());

  useEffect(() => {
    if (showOpenWith) {
      setInput('');
      setSelectedIdx(-1);
      tauriApi
        .listApplications()
        .then(setApps)
        .catch(() => setApps([]));
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [showOpenWith]);

  const candidates = useMemo(() => {
    if (!input) return apps.slice(0, 8);
    const lower = input.toLowerCase();
    return apps.filter((a) => a.toLowerCase().includes(lower)).slice(0, 8);
  }, [input, apps]);

  if (!showOpenWith || !openWithTarget) return null;

  const fileName = path.basename(openWithTarget);
  const trimmed = input.trim();
  const isValidApp = apps.some((a) => a.toLowerCase() === trimmed.toLowerCase());

  const applyCandidate = (name: string) => {
    setInput(name);
    setSelectedIdx(-1);
    inputRef.current?.focus();
  };

  const handleOpen = async () => {
    if (!trimmed) {
      setShowOpenWith(false);
      return;
    }
    try {
      await tauriApi.openWithApp(openWithTarget, trimmed);
      showStatusMessage(t('openWithModal.openSuccess', { file: fileName, app: trimmed }));
    } catch (e) {
      showStatusMessage(t('openWithModal.error', { error: e }));
    }
    setShowOpenWith(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    ime.handlers.onKeyDown(e);
    if (e.key === 'Escape') {
      setShowOpenWith(false);
      return;
    }
    if (candidates.length === 0) return;
    if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'j')) {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, candidates.length - 1));
    } else if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'k')) {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Tab') {
      e.preventDefault();
      applyCandidate(candidates[selectedIdx >= 0 ? selectedIdx : 0]);
    } else if (e.key === 'Enter' && selectedIdx >= 0) {
      e.preventDefault();
      applyCandidate(candidates[selectedIdx]);
    }
  };

  return (
    <div className="modal-overlay" onClick={() => setShowOpenWith(false)}>
      <div className="modal open-with-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{t('openWithModal.title')}</div>
        <div className="modal-subtitle">{fileName}</div>

        <div className="open-with-input-wrap">
          <input
            ref={inputRef}
            className="modal-input"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setSelectedIdx(-1);
            }}
            placeholder={t('openWithModal.placeholder')}
            {...ime.handlers}
            onKeyDown={handleKeyDown}
          />
          {candidates.length > 0 && (
            <ul className="open-with-candidates" ref={listRef}>
              {candidates.map((name, i) => (
                <li
                  key={name}
                  className={i === selectedIdx ? 'selected' : ''}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    applyCandidate(name);
                  }}
                >
                  {name}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="modal-actions">
          <button onClick={() => setShowOpenWith(false)}>{t('openWithModal.cancel')}</button>
          <button className="primary" onClick={handleOpen} disabled={!trimmed || !isValidApp}>
            {t('openWithModal.open')}
          </button>
        </div>
      </div>
    </div>
  );
}
