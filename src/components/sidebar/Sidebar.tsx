import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTabStore } from '../../store/tabStore';
import { useBookmarkStore } from '../../store/bookmarkStore';
import { useUiStore } from '../../store/uiStore';
import { tauriApi } from '../../lib/tauri';

const FAVORITES = [
  { key: 'sidebar.home' as const, path: () => `/Users/${getUsername()}` },
  { key: 'sidebar.desktop' as const, path: () => `/Users/${getUsername()}/Desktop` },
  { key: 'sidebar.documents' as const, path: () => `/Users/${getUsername()}/Documents` },
  { key: 'sidebar.downloads' as const, path: () => `/Users/${getUsername()}/Downloads` },
  { key: 'sidebar.applications' as const, path: () => '/Applications' },
];

function getUsername(): string {
  // Best effort: parse HOME env or use a placeholder
  return (window as any).__macFilerUsername ?? 'user';
}

export function Sidebar() {
  const { t } = useTranslation();
  const { navigateTo, activeTab } = useTabStore();
  const { bookmarks, addBookmark, removeBookmark } = useBookmarkStore();
  const { googleDrivePaths, setGoogleDrivePaths, sidebarWidth, setSidebarWidth } = useUiStore();

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    const onMove = (ev: MouseEvent) => {
      setSidebarWidth(Math.max(140, Math.min(480, startWidth + ev.clientX - startX)));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const currentPath = activeTab().path;

  useEffect(() => {
    // Fetch home dir from system
    fetch('').catch(() => {});
    tauriApi.detectGoogleDrive().then(setGoogleDrivePaths).catch(() => {});
  }, []);

  const handleDropOnBookmarks = (e: React.DragEvent) => {
    e.preventDefault();
    const dataPath = e.dataTransfer.getData('application/x-mac-filer-paths');
    if (dataPath) {
      const paths: string[] = JSON.parse(dataPath);
      paths.forEach((p) => {
        const label = p.split('/').pop() ?? p;
        addBookmark(label, p);
      });
    }
  };

  return (
    <div className="sidebar" style={{ width: sidebarWidth }}>
      <div className="sidebar-resizer" onMouseDown={startResize} />
      <section className="sidebar-section">
        <div className="sidebar-section-title">{t('sidebar.favorites')}</div>
        {FAVORITES.map((fav) => {
          const p = fav.path();
          return (
            <div
              key={p}
              className={`sidebar-item${currentPath === p ? ' active' : ''}`}
              onClick={() => navigateTo(p)}
            >
              {t(fav.key)}
            </div>
          );
        })}
      </section>

      {googleDrivePaths.length > 0 && (
        <section className="sidebar-section">
          <div className="sidebar-section-title">{t('sidebar.cloud')}</div>
          {googleDrivePaths.map((p, i) => (
            <div
              key={p}
              className={`sidebar-item${currentPath === p ? ' active' : ''}`}
              onClick={() => navigateTo(p)}
            >
              ☁️ Google Drive{googleDrivePaths.length > 1 ? ` (${i + 1})` : ''}
            </div>
          ))}
        </section>
      )}

      <section
        className="sidebar-section"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDropOnBookmarks}
      >
        <div className="sidebar-section-title">{t('sidebar.bookmarks')}</div>
        {bookmarks.map((bm) => (
          <div key={bm.id} className="sidebar-item bookmark">
            <span
              className={currentPath === bm.path ? 'active' : ''}
              onClick={() => navigateTo(bm.path)}
            >
              🔖 {bm.label}
            </span>
            <button
              className="bookmark-remove"
              onClick={() => removeBookmark(bm.id)}
              title={t('sidebar.deleteBookmark')}
            >
              ×
            </button>
          </div>
        ))}
        {bookmarks.length === 0 && (
          <div className="sidebar-hint">{t('sidebar.addBookmarkHint')}</div>
        )}
      </section>
    </div>
  );
}
