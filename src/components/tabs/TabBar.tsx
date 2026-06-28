import path from 'path-browserify';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFileOps } from '../../hooks/useFileOps';
import { useTabStore } from '../../store/tabStore';

export function TabBar() {
  const { t } = useTranslation();
  const {
    tabs,
    activeTabId,
    setActiveTab,
    closeTab,
    openTab,
    goBack,
    goForward,
    activeTab,
    reorderTabs,
  } = useTabStore();
  const fileOps = useFileOps();

  const tab = activeTab();
  const canGoBack = tab.historyIndex > 0;
  const canGoForward = tab.historyIndex < tab.history.length - 1;
  const isRoot = tab.path === '/' || path.dirname(tab.path) === tab.path;

  const dragFromRef = useRef<number>(-1);
  const tabBarRef = useRef<HTMLDivElement>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number>(-1);
  const isDraggingRef = useRef(false);

  const getTabIndexFromX = useCallback((clientX: number): number => {
    if (!tabBarRef.current) return -1;
    const tabEls = tabBarRef.current.querySelectorAll<HTMLElement>('.tab-item');
    for (let i = 0; i < tabEls.length; i++) {
      const rect = tabEls[i].getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right) return i;
    }
    return -1;
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, index: number) => {
      if ((e.target as HTMLElement).closest('.tab-close')) return;
      if (e.button !== 0) return;
      e.preventDefault();
      dragFromRef.current = index;
      isDraggingRef.current = false;

      const startX = e.clientX;

      const onMouseMove = (me: MouseEvent) => {
        if (!isDraggingRef.current && Math.abs(me.clientX - startX) > 4) {
          isDraggingRef.current = true;
        }
        if (isDraggingRef.current) {
          const over = getTabIndexFromX(me.clientX);
          setDragOverIndex(over);
        }
      };

      const onMouseUp = (me: MouseEvent) => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        if (isDraggingRef.current) {
          const to = getTabIndexFromX(me.clientX);
          const from = dragFromRef.current;
          if (from !== -1 && to !== -1 && from !== to) reorderTabs(from, to);
        }
        isDraggingRef.current = false;
        dragFromRef.current = -1;
        setDragOverIndex(-1);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [getTabIndexFromX, reorderTabs],
  );

  useEffect(() => {
    return () => {
      isDraggingRef.current = false;
      dragFromRef.current = -1;
    };
  }, []);

  return (
    <div className="tab-bar" ref={tabBarRef}>
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
      {tabs.map((tab, index) => (
        <div
          key={tab.id}
          className={`tab-item${tab.id === activeTabId ? ' active' : ''}${dragOverIndex === index ? ' drag-over' : ''}`}
          onClick={() => setActiveTab(tab.id)}
          onMouseDown={(e) => handleMouseDown(e, index)}
        >
          <span className="tab-label">{path.basename(tab.path) || '/'}</span>
          {tabs.length > 1 && (
            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
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
