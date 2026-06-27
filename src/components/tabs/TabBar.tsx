import { useTranslation } from 'react-i18next';
import { useTabStore } from '../../store/tabStore';
import { useFileOps } from '../../hooks/useFileOps';
import path from 'path-browserify';

export function TabBar() {
  const { t } = useTranslation();
  const { tabs, activeTabId, setActiveTab, closeTab, openTab, goBack, goForward, activeTab } = useTabStore();
  const fileOps = useFileOps();

  const tab = activeTab();
  const canGoBack = tab.historyIndex > 0;
  const canGoForward = tab.historyIndex < tab.history.length - 1;
  const isRoot = tab.path === '/' || path.dirname(tab.path) === tab.path;

  return (
    <div className="tab-bar">
      <div className="tab-nav-buttons">
        <button
          className="tab-nav-btn"
          onClick={() => goBack()}
          disabled={!canGoBack}
          title={t('tabBar.goBack')}
          aria-label={t('tabBar.goBack')}
        >
          ‹
        </button>
        <button
          className="tab-nav-btn"
          onClick={() => goForward()}
          disabled={!canGoForward}
          title={t('tabBar.goForward')}
          aria-label={t('tabBar.goForward')}
        >
          ›
        </button>
        <button
          className="tab-nav-btn"
          onClick={fileOps.handleNavigateUp}
          disabled={isRoot}
          title={t('tabBar.navigateUp')}
          aria-label={t('tabBar.navigateUp')}
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
