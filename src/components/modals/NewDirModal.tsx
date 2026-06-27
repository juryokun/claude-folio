import { useState, useEffect, useRef } from 'react';
import { tauriApi } from '../../lib/tauri';
import { useUiStore } from '../../store/uiStore';
import { useTabStore } from '../../store/tabStore';
import { useFileStore } from '../../store/fileStore';

export function NewDirModal() {
  const { showNewDir, setShowNewDir, showHidden } = useUiStore();
  const { activeTab } = useTabStore();
  const { loadDir } = useFileStore();

  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showNewDir) {
      setName('');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [showNewDir]);

  if (!showNewDir) return null;

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setShowNewDir(false); return; }
    const tab = activeTab();
    try {
      await tauriApi.createDir(`${tab.path}/${trimmed}`);
      loadDir(tab.id, tab.path, showHidden);
    } catch (e) {
      alert(`フォルダ作成に失敗しました: ${e}`);
    }
    setShowNewDir(false);
  };

  return (
    <div className="modal-overlay" onClick={() => setShowNewDir(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">新規フォルダ</div>
        <input
          ref={inputRef}
          className="modal-input"
          placeholder="フォルダ名"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCreate();
            if (e.key === 'Escape') setShowNewDir(false);
          }}
        />
        <div className="modal-actions">
          <button onClick={() => setShowNewDir(false)}>キャンセル</button>
          <button className="primary" onClick={handleCreate}>作成</button>
        </div>
      </div>
    </div>
  );
}
