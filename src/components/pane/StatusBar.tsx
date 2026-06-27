import { useTabStore } from '../../store/tabStore';
import { useFileStore } from '../../store/fileStore';
import { useUiStore } from '../../store/uiStore';

export function StatusBar() {
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
      <span className="status-mode">[{vimMode}]</span>
      <span className="status-count">
        {cursor}/{totalCount}
        {selectedCount > 0 && ` (${selectedCount}件選択)`}
      </span>
      {pane.filterQuery && (
        <span className="status-filter">🔍 {pane.filterQuery}</span>
      )}
      {clipboard && (
        <span className="status-clipboard">
          📋 {clipboard.mode === 'copy' ? 'コピー' : '切り取り'}: {clipboard.paths.length}件
        </span>
      )}
      {showHidden && (
        <span className="status-hidden">隠しファイル表示中</span>
      )}
      {statusMessage && (
        <span className="status-message">{statusMessage}</span>
      )}
    </div>
  );
}
