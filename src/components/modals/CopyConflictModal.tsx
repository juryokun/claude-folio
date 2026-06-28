import { useTranslation } from 'react-i18next';
import { useUiStore } from '../../store/uiStore';

export function CopyConflictModal() {
  const { t } = useTranslation();
  const { copyConflict, closeCopyConflict } = useUiStore();
  if (!copyConflict) return null;

  const { conflicts, onResolve } = copyConflict;

  const handle = (strategy: 'overwrite' | 'rename') => {
    closeCopyConflict();
    onResolve(strategy);
  };

  return (
    <div className="modal-overlay" onClick={closeCopyConflict}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-title">{t('copyConflictModal.title')}</div>
        <div className="modal-body">
          <p style={{ marginBottom: 8, color: 'var(--text-dim)', fontSize: 12 }}>
            {t('copyConflictModal.description_other', { count: conflicts.length })}
          </p>
          <ul className="conflict-list">
            {conflicts.slice(0, 8).map((name) => (
              <li key={name} className="conflict-item">
                {name}
              </li>
            ))}
            {conflicts.length > 8 && (
              <li className="conflict-item conflict-more">
                {t('copyConflictModal.more', { count: conflicts.length - 8 })}
              </li>
            )}
          </ul>
        </div>
        <div className="modal-actions">
          <button className="modal-btn" onClick={closeCopyConflict}>
            {t('copyConflictModal.cancel')}
          </button>
          <button className="modal-btn" onClick={() => handle('rename')}>
            {t('copyConflictModal.rename')}
          </button>
          <button className="modal-btn modal-btn--danger" onClick={() => handle('overwrite')}>
            {t('copyConflictModal.overwrite')}
          </button>
        </div>
      </div>
    </div>
  );
}
