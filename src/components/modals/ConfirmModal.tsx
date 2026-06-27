import { useEffect, useRef } from 'react';
import { useUiStore } from '../../store/uiStore';

export function ConfirmModal() {
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
      <div className="modal" onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleConfirm();
          if (e.key === 'Escape') closeConfirm();
        }}
      >
        <div className="modal-title">確認</div>
        <p style={{ color: 'var(--text)', marginBottom: 8 }}>{confirmMessage}</p>
        <div className="modal-actions">
          <button onClick={closeConfirm}>キャンセル</button>
          <button ref={confirmBtnRef} className="primary" onClick={handleConfirm}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
