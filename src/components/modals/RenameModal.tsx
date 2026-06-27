import { useState, useEffect, useRef } from 'react';
import path from 'path-browserify';
import { tauriApi } from '../../lib/tauri';
import { useUiStore } from '../../store/uiStore';
import { useTabStore } from '../../store/tabStore';
import { useFileStore } from '../../store/fileStore';

export function RenameModal() {
  const { showRename, renameTarget, setShowRename } = useUiStore();
  const { activeTab } = useTabStore();
  const { loadDir } = useFileStore();
  const { showHidden } = useUiStore();

  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showRename && renameTarget) {
      setName(path.basename(renameTarget));
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [showRename, renameTarget]);

  if (!showRename || !renameTarget) return null;

  const handleRename = async () => {
    if (!name || name === path.basename(renameTarget)) {
      setShowRename(false);
      return;
    }
    const newPath = path.join(path.dirname(renameTarget), name);
    try {
      await tauriApi.renameFile(renameTarget, newPath);
      const tab = activeTab();
      loadDir(tab.id, tab.path, showHidden);
    } catch (e) {
      console.error('リネームに失敗しました:', e);
    }
    setShowRename(false);
  };

  return (
    <div className="modal-overlay" onClick={() => setShowRename(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">リネーム</div>
        <input
          ref={inputRef}
          className="modal-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleRename();
            if (e.key === 'Escape') setShowRename(false);
          }}
        />
        <div className="modal-actions">
          <button onClick={() => setShowRename(false)}>キャンセル</button>
          <button className="primary" onClick={handleRename}>リネーム</button>
        </div>
      </div>
    </div>
  );
}
