import { useTabStore } from '../../store/tabStore';
import path from 'path-browserify';

export function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab, openTab } = useTabStore();

  return (
    <div className="tab-bar">
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
