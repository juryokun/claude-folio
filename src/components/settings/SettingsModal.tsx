import { useUiStore } from '../../store/uiStore';
import type { TerminalEmulator } from '../../types';

export function SettingsModal() {
  const { showSettings, setShowSettings, terminalEmulator, setTerminalEmulator } = useUiStore();

  if (!showSettings) return null;

  return (
    <div className="modal-overlay" onClick={() => setShowSettings(false)}>
      <div className="modal settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">設定</div>

        <div className="setting-row">
          <label className="setting-label">ターミナルエミュレータ</label>
          <select
            value={terminalEmulator}
            onChange={(e) => setTerminalEmulator(e.target.value as TerminalEmulator)}
          >
            <option value="terminal">Terminal.app</option>
            <option value="iterm2">iTerm2</option>
            <option value="warp">Warp</option>
          </select>
        </div>

        <div className="modal-actions">
          <button className="primary" onClick={() => setShowSettings(false)}>閉じる</button>
        </div>
      </div>
    </div>
  );
}
