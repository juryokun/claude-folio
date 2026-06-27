import { useEffect } from 'react';
import { useTabStore } from '../../store/tabStore';
import { useBookmarkStore } from '../../store/bookmarkStore';
import { useUiStore } from '../../store/uiStore';
import { tauriApi } from '../../lib/tauri';

const FAVORITES = [
  { label: 'ホーム', path: () => `/Users/${getUsername()}` },
  { label: 'デスクトップ', path: () => `/Users/${getUsername()}/Desktop` },
  { label: '書類', path: () => `/Users/${getUsername()}/Documents` },
  { label: 'ダウンロード', path: () => `/Users/${getUsername()}/Downloads` },
  { label: 'アプリケーション', path: () => '/Applications' },
];

function getUsername(): string {
  // Best effort: parse HOME env or use a placeholder
  return (window as any).__macFilerUsername ?? 'user';
}

export function Sidebar() {
  const { navigateTo, activeTab } = useTabStore();
  const { bookmarks, addBookmark, removeBookmark } = useBookmarkStore();
  const { googleDrivePaths, setGoogleDrivePaths } = useUiStore();

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
    <div className="sidebar">
      <section className="sidebar-section">
        <div className="sidebar-section-title">よく使う場所</div>
        {FAVORITES.map((fav) => {
          const p = fav.path();
          return (
            <div
              key={p}
              className={`sidebar-item${currentPath === p ? ' active' : ''}`}
              onClick={() => navigateTo(p)}
            >
              {fav.label}
            </div>
          );
        })}
      </section>

      {googleDrivePaths.length > 0 && (
        <section className="sidebar-section">
          <div className="sidebar-section-title">クラウド</div>
          {googleDrivePaths.map((p) => (
            <div
              key={p}
              className={`sidebar-item${currentPath === p ? ' active' : ''}`}
              onClick={() => navigateTo(p)}
            >
              ☁️ Google Drive
            </div>
          ))}
        </section>
      )}

      <section
        className="sidebar-section"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDropOnBookmarks}
      >
        <div className="sidebar-section-title">ブックマーク</div>
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
              title="削除"
            >
              ×
            </button>
          </div>
        ))}
        {bookmarks.length === 0 && (
          <div className="sidebar-hint">フォルダをドロップして追加</div>
        )}
      </section>
    </div>
  );
}
