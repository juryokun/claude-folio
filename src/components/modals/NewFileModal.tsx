import { useState, useEffect, useRef } from 'react';
import { useImeAwareEnter } from '../../hooks/useImeAwareEnter';
import { tauriApi } from '../../lib/tauri';
import { useUiStore } from '../../store/uiStore';
import { useTabStore } from '../../store/tabStore';
import { useFileStore } from '../../store/fileStore';

export function NewFileModal() {
  const { showNewFile, setShowNewFile, showHidden, showStatusMessage } = useUiStore();
  const { activeTab } = useTabStore();
  const { loadDir, setPendingFocusName } = useFileStore();

  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const ime = useImeAwareEnter(() => handleCreate());

  useEffect(() => {
    if (showNewFile) {
      setName('');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [showNewFile]);

  if (!showNewFile) return null;

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setShowNewFile(false); return; }
    const tab = activeTab();
    try {
      await tauriApi.createFile(`${tab.path}/${trimmed}`);
      setPendingFocusName(tab.id, trimmed);
      loadDir(tab.id, tab.path, showHidden);
      showStatusMessage(`✅ ${trimmed} を作成しました`);
    } catch (e) {
      showStatusMessage(`❌ ファイル作成に失敗しました: ${e}`);
    }
    setShowNewFile(false);
  };

  return (
    <div className="modal-overlay" onClick={() => setShowNewFile(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">新規ファイル</div>
        <input
          ref={inputRef}
          className="modal-input"
          placeholder="ファイル名"
          value={name}
          onChange={(e) => setName(e.target.value)}
          {...ime.handlers}
          onKeyDown={(e) => {
            ime.handlers.onKeyDown(e);
            if (e.key === 'Escape') setShowNewFile(false);
          }}
        />
        <div className="modal-actions">
          <button onClick={() => setShowNewFile(false)}>キャンセル</button>
          <button className="primary" onClick={handleCreate}>作成</button>
        </div>
      </div>
    </div>
  );
}
