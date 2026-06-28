import path from 'path-browserify';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useImeAwareEnter } from '../../hooks/useImeAwareEnter';
import { tauriApi } from '../../lib/tauri';
import { useFileStore } from '../../store/fileStore';
import { useTabStore } from '../../store/tabStore';
import { useUiStore } from '../../store/uiStore';

export function RenameModal() {
  const { t } = useTranslation();
  const { showRename, renameTarget, setShowRename } = useUiStore();
  const { activeTab } = useTabStore();
  const { loadDir } = useFileStore();
  const { showHidden } = useUiStore();

  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const ime = useImeAwareEnter(() => handleRename());

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
      console.error(t('renameModal.error', { error: e }));
    }
    setShowRename(false);
  };

  return (
    <div className="modal-overlay" onClick={() => setShowRename(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{t('renameModal.title')}</div>
        <input
          ref={inputRef}
          className="modal-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          {...ime.handlers}
          onKeyDown={(e) => {
            ime.handlers.onKeyDown(e);
            if (e.key === 'Escape') setShowRename(false);
          }}
        />
        <div className="modal-actions">
          <button onClick={() => setShowRename(false)}>{t('renameModal.cancel')}</button>
          <button className="primary" onClick={handleRename}>
            {t('renameModal.rename')}
          </button>
        </div>
      </div>
    </div>
  );
}
