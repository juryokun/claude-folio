import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '../../store/uiStore';

export function ConfirmModal() {
  const { t } = useTranslation();
  const { showConfirm, confirmMessage, confirmCallback, closeConfirm } = useUiStore();
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (showConfirm) {
      setTimeout(() => confirmBtnRef.current?.focus(), 0);
    }
  }, [showConfirm]);

  if (!showConfirm) return null;

  const handleConfirm = () => {
    closeConfirm();
    confirmCallback?.();
  };

  return (
    <div className="modal-overlay" onClick={closeConfirm}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleConfirm();
          if (e.key === 'Escape') closeConfirm();
        }}
      >
        <div className="modal-title">{t('confirmModal.title')}</div>
        <p style={{ color: 'var(--text)', marginBottom: 8 }}>{confirmMessage}</p>
        <div className="modal-actions">
          <button onClick={closeConfirm}>{t('confirmModal.cancel')}</button>
          <button ref={confirmBtnRef} className="primary" onClick={handleConfirm}>
            {t('confirmModal.ok')}
          </button>
        </div>
      </div>
    </div>
  );
}
