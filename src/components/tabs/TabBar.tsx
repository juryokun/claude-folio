import { useTabStore } from '../../store/tabStore';
import { useFileOps } from '../../hooks/useFileOps';
import path from 'path-browserify';

export function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab, openTab, goBack, activeTab } = useTabStore();
  const fileOps = useFileOps();

  const tab = activeTab();
  const canGoBack = tab.historyIndex > 0;
  const isRoot = tab.path === '/' || path.dirname(tab.path) === tab.path;

  return (
    <div className="tab-bar">
      <div className="tab-nav-buttons">
        <button
          className="tab-nav-btn"
          onClick={() => goBack()}
          disabled={!canGoBack}
          title="戻る (H)"
          aria-label="戻る"
        >
          ‹
        </button>
        <button
          className="tab-nav-btn"
          onClick={fileOps.handleNavigateUp}
          disabled={isRoot}
          title="上の階層へ (h)"
          aria-label="上の階層へ"
        >
          ↑
        </button>
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`tab-item${tab.id === activeTabId ? ' active' : ''}`}
          onClick={() => setActiveTab(tab.id)}
        >
          <span className="tab-label">{path.basename(tab.path) || '/'}</span>
          {tabs.length > 1 && (
            <button
              className="tab-close"
              onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
              aria-label="タブを閉じる"
            >
              ×
            </button>
          )}
        </div>
      ))}
      <button className="tab-new" onClick={() => openTab()} aria-label="新規タブ">
        +
      </button>
    </div>
  );
}
