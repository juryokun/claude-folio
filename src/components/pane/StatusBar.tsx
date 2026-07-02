import { useTranslation } from 'react-i18next';
import { useFileStore } from '../../store/fileStore';
import { useTabStore } from '../../store/tabStore';
import { useUiStore } from '../../store/uiStore';

export function StatusBar() {
  const { t } = useTranslation();
  const { activeTab } = useTabStore();
  const { getPane, filteredEntries, clipboard } = useFileStore();
  const { vimMode, showHidden, statusMessage } = useUiStore();

  const tab = activeTab();
  const pane = getPane(tab.id);
  const entries = filteredEntries(tab.id);

  const selectedCount = pane.selected.size;
  const totalCount = entries.length;
  const cursor = pane.cursor + 1;

  return (
    <div className="status-bar">
      <span className="status-mode">[{pane.visualAnchor !== null ? 'VISUAL' : vimMode}]</span>
      <span className="status-count">
        {cursor}/{totalCount}
        {selectedCount > 0 && ` ${t('statusBar.selected', { count: selectedCount })}`}
      </span>
      {pane.filterQuery && <span className="status-filter">🔍 {pane.filterQuery}</span>}
      {clipboard && (
        <span className="status-clipboard">
          {t('statusBar.clipboardItems', {
            mode: clipboard.mode === 'copy' ? t('statusBar.modeCopy') : t('statusBar.modeCut'),
            count: clipboard.paths.length,
          })}
        </span>
      )}
      {showHidden && <span className="status-hidden">{t('statusBar.hiddenFiles')}</span>}
      {statusMessage && <span className="status-message">{statusMessage}</span>}
    </div>
  );
}
