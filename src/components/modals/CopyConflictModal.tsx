import { useUiStore } from '../../store/uiStore';

export function CopyConflictModal() {
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
        <div className="modal-title">競合するファイルがあります</div>
        <div className="modal-body">
          <p style={{ marginBottom: 8, color: 'var(--text-dim)', fontSize: 12 }}>
            以下の {conflicts.length} 件がコピー先に既に存在します：
          </p>
          <ul className="conflict-list">
            {conflicts.slice(0, 8).map((name) => (
              <li key={name} className="conflict-item">{name}</li>
            ))}
            {conflicts.length > 8 && (
              <li className="conflict-item conflict-more">… 他 {conflicts.length - 8} 件</li>
            )}
          </ul>
        </div>
        <div className="modal-actions">
          <button className="modal-btn" onClick={closeCopyConflict}>キャンセル</button>
          <button className="modal-btn" onClick={() => handle('rename')}>連番を付けて保存</button>
          <button className="modal-btn modal-btn--danger" onClick={() => handle('overwrite')}>上書き</button>
        </div>
      </div>
    </div>
  );
}
