import { useState, useEffect, useRef, useMemo } from 'react';
import path from 'path-browserify';
import { tauriApi } from '../../lib/tauri';
import { useUiStore } from '../../store/uiStore';
import { useImeAwareEnter } from '../../hooks/useImeAwareEnter';

// アプリモードの判定:
//   アプリ一覧に完全一致（大文字小文字無視）→ アプリモード (open -a)
//   それ以外 → コマンドモード (直接実行)
function resolveMode(input: string, apps: string[]): 'app' | 'command' {
  const lower = input.toLowerCase();
  if (apps.some((a) => a.toLowerCase() === lower)) return 'app';
  return 'command';
}

// 候補を表示するかどうか: / や ~ で始まる場合は補完しない
function showCandidates(input: string): boolean {
  return input.length > 0 && !input.startsWith('/') && !input.startsWith('~');
}

export function OpenWithModal() {
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
      tauriApi.listApplications().then(setApps).catch(() => setApps([]));
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [showOpenWith]);

  const candidates = useMemo(() => {
    if (!showCandidates(input)) return [];
    const lower = input.toLowerCase();
    return apps.filter((a) => a.toLowerCase().includes(lower)).slice(0, 8);
  }, [input, apps]);

  useEffect(() => { setSelectedIdx(-1); }, [candidates]);

  if (!showOpenWith || !openWithTarget) return null;

  const fileName = path.basename(openWithTarget);
  const trimmed = input.trim();
  const mode = resolveMode(trimmed, apps);

  const applyCandidate = (name: string) => {
    setInput(name);
    setSelectedIdx(-1);
    inputRef.current?.focus();
  };

  const handleOpen = async () => {
    if (!trimmed) { setShowOpenWith(false); return; }
    try {
      if (resolveMode(trimmed, apps) === 'app') {
        await tauriApi.openWithApp(openWithTarget, trimmed);
        showStatusMessage(`${fileName} を ${trimmed} で開きました`);
      } else {
        await tauriApi.openWithCommand(openWithTarget, trimmed);
        showStatusMessage(`${fileName} を実行しました`);
      }
    } catch (e) {
      showStatusMessage(`エラー: ${e}`);
    }
    setShowOpenWith(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    ime.handlers.onKeyDown(e);
    if (e.key === 'Escape') { setShowOpenWith(false); return; }
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

  const modeHint = !trimmed
    ? 'アプリ名またはコマンドを入力してください'
    : mode === 'app'
      ? `アプリモード — open -a "${trimmed}" ${fileName}`
      : `コマンドモード — ${trimmed} <ファイル> として実行`;

  return (
    <div className="modal-overlay" onClick={() => setShowOpenWith(false)}>
      <div className="modal open-with-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">アプリを指定して開く</div>
        <div className="modal-subtitle">{fileName}</div>

        <div className="open-with-input-wrap">
          <input
            ref={inputRef}
            className="modal-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Preview / zip -r / /usr/bin/tool --flag"
            {...ime.handlers}
            onKeyDown={handleKeyDown}
          />
          {candidates.length > 0 && (
            <ul className="open-with-candidates" ref={listRef}>
              {candidates.map((name, i) => (
                <li
                  key={name}
                  className={i === selectedIdx ? 'selected' : ''}
                  onMouseDown={(e) => { e.preventDefault(); applyCandidate(name); }}
                >
                  {name}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="open-with-mode-hint">{modeHint}</div>

        <div className="modal-actions">
          <button onClick={() => setShowOpenWith(false)}>キャンセル</button>
          <button className="primary" onClick={handleOpen} disabled={!trimmed}>開く</button>
        </div>
      </div>
    </div>
  );
}
