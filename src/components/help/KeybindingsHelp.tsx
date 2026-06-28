import { useTranslation } from 'react-i18next';
import { KEYBINDING_DOCS } from '../../lib/vim/keymap';
import { useUiStore } from '../../store/uiStore';

export function KeybindingsHelp() {
  const { t } = useTranslation();
  const { showHelp, setShowHelp } = useUiStore();

  if (!showHelp) return null;

  return (
    <div className="modal-overlay" onClick={() => setShowHelp(false)}>
      <div className="modal help-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{t('keybindingsHelp.title')}</div>
        <table className="keybinding-table">
          <tbody>
            {KEYBINDING_DOCS.map(({ keys, description }) => (
              <tr key={keys}>
                <td className="keybinding-key">
                  <kbd>{keys}</kbd>
                </td>
                <td className="keybinding-desc">{description}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="modal-actions">
          <button className="primary" onClick={() => setShowHelp(false)}>
            {t('keybindingsHelp.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
