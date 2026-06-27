import { useState, useRef, useEffect, useMemo } from 'react';
import { useImeAwareEnter } from '../../hooks/useImeAwareEnter';
import path from 'path-browserify';
import { useUiStore } from '../../store/uiStore';
import { useTabStore } from '../../store/tabStore';
import { useFileStore } from '../../store/fileStore';
import { useBookmarkStore } from '../../store/bookmarkStore';
import { useConfigStore } from '../../store/configStore';
import { tauriApi } from '../../lib/tauri';

interface CommandDef {
  name: string;
  args?: string;
  desc: string;
}

const COMMANDS: CommandDef[] = [
  { name: 'q',             desc: 'タブを閉じる' },
  { name: 'tabnew',        args: '[path]',    desc: '新規タブを開く' },
  { name: 'cd',            args: '<path|keyword>', desc: 'ディレクトリを移動 (zoxide 対応)' },
  { name: 'bm',            args: '[label]',   desc: '現在のディレクトリをブックマーク' },
  { name: 'filter',        args: '<ext>',     desc: 'ファイルを拡張子でフィルタ' },
  { name: 'zip',           args: '[name]',    desc: '選択ファイルを ZIP 圧縮 (7zip)' },
  { name: 'unzip',         desc: '選択アーカイブを展開 (7zip)' },
  { name: 'init-config',   desc: '設定ファイルを初期作成' },
  { name: 'reload-config', desc: '設定ファイルを再読み込み' },
];

export function CommandPalette() {
  const { showCommandPalette, setShowCommandPalette, setVimMode, has7zip } =
    useUiStore();
  const { activeTab, navigateTo, openTab, closeTab, activeTabId } = useTabStore();
  const { loadDir } = useFileStore();
  const { showHidden, showStatusMessage } = useUiStore();
  const { addBookmark } = useBookmarkStore();
  const loadConfig = useConfigStore((s) => s.load);

  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [cycleIndex, setCycleIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const ime = useImeAwareEnter(() => runCommand(input));

  useEffect(() => {
    if (showCommandPalette) {
      setInput(':');
      setError('');
      setCycleIndex(-1);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.setSelectionRange(1, 1);
      }, 0);
    }
  }, [showCommandPalette]);

  // Parse current typed command name (after the leading ':')
  const typedCommand = input.slice(1).split(/\s/)[0];
  const hasArgs = input.slice(1).includes(' ');

  // Candidates: commands that start with what's been typed (only when no args yet)
  const candidates = useMemo(() => {
    if (hasArgs || !typedCommand) return [];
    return COMMANDS.filter((c) => c.name.startsWith(typedCommand) && c.name !== typedCommand);
  }, [typedCommand, hasArgs]);

  if (!showCommandPalette) return null;

  const close = () => {
    setShowCommandPalette(false);
    setVimMode('NORMAL');
    setInput('');
    setCycleIndex(-1);
  };

  const handleTab = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    e.preventDefault();

    // Exact match already typed — nothing to complete
    const exact = COMMANDS.find((c) => c.name === typedCommand);

    // Only one candidate → complete it directly
    if (candidates.length === 1) {
      const completed = ':' + candidates[0].name + ' ';
      setInput(completed);
      setCycleIndex(-1);
      return;
    }

    if (candidates.length === 0) {
      // If exact match, add a trailing space (ready for args)
      if (exact) setInput(':' + exact.name + ' ');
      return;
    }

    // Multiple candidates → cycle through them
    const next = (cycleIndex + 1) % candidates.length;
    setCycleIndex(next);
    setInput(':' + candidates[next].name);
  };

  const runCommand = async (cmd: string) => {
    const tab = activeTab();
    const parts = cmd.slice(1).trim().split(/\s+/);
    const command = parts[0];
    const args = parts.slice(1);

    try {
      switch (command) {
        case 'q':
          closeTab(activeTabId);
          break;
        case 'tabnew':
          openTab(args[0] || tab.path);
          break;
        case 'cd': {
          const target = args.join(' ');
          if (!target) break;
          if (target.startsWith('/') || target.startsWith('~')) {
            navigateTo(target);
          } else {
            const results = await tauriApi.zoxideQuery(target);
            if (results.length > 0) navigateTo(results[0]);
            else setError(`見つかりません: ${target}`);
          }
          break;
        }
        case 'bm': {
          const label = args.join(' ') || path.basename(tab.path);
          await addBookmark(label, tab.path);
          break;
        }
        case 'sort':
          break;
        case 'filter':
          useFileStore.getState().setFilter(tab.id, args[0] ?? '');
          break;
        case 'open':
          if (has7zip && args[0] === 'zip') {
            const name = args[1] ?? 'archive.zip';
            const selected = Array.from(useFileStore.getState().getPane(tab.id).selected);
            const paths = selected.length > 0 ? selected : [];
            if (paths.length > 0) {
              await tauriApi.compress7zip(paths, path.join(tab.path, name), true);
              loadDir(tab.id, tab.path, showHidden);
            }
          }
          break;
        case 'zip': {
          if (!has7zip) { setError('7zipがインストールされていません'); return; }
          const zipName = (args[0] ?? 'archive') + (args[0]?.endsWith('.zip') ? '' : '.zip');
          const pane = useFileStore.getState().getPane(tab.id);
          const targets = pane.selected.size > 0
            ? Array.from(pane.selected)
            : pane.entries.map((e) => e.path);
          await tauriApi.compress7zip(targets, path.join(tab.path, zipName), true);
          loadDir(tab.id, tab.path, showHidden);
          break;
        }
        case 'unzip': {
          if (!has7zip) { setError('7zipがインストールされていません'); return; }
          const pane = useFileStore.getState().getPane(tab.id);
          const entry = pane.entries[pane.cursor];
          if (entry) {
            await tauriApi.extract7zip(entry.path, tab.path);
            loadDir(tab.id, tab.path, showHidden);
          }
          break;
        }
        case 'reload-config': {
          try {
            await loadConfig();
            close();
            showStatusMessage('✅ 設定ファイルを再読み込みしました');
          } catch (e) {
            setError(String(e));
          }
          return;
        }
        case 'init-config': {
          try {
            const configPath = await tauriApi.initConfig();
            close();
            showStatusMessage(`✅ 設定ファイルを作成しました: ${configPath}`);
          } catch (e) {
            if (String(e) === 'exists') {
              close();
              showStatusMessage('ℹ️ 設定ファイルはすでに存在します: ~/.config/folio/config.toml', 4000);
            } else {
              setError(String(e));
            }
          }
          return;
        }
        default:
          setError(`不明なコマンド: ${command}`);
          return;
      }
      close();
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="modal-overlay" onClick={close}>
      <div className="modal command-palette" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="command-input"
          value={input}
          onChange={(e) => { setInput(e.target.value); setError(''); setCycleIndex(-1); }}
          {...ime.handlers}
          onKeyDown={(e) => {
            handleTab(e);
            ime.handlers.onKeyDown(e);
            if (e.key === 'Escape') close();
          }}
          placeholder=":コマンド  (Tab で補完)"
        />
        {candidates.length > 0 && (
          <div className="command-completions">
            {candidates.map((c, i) => (
              <span
                key={c.name}
                className={`command-completion-item${i === cycleIndex ? ' active' : ''}`}
              >
                {c.name}
                {c.args && <span className="command-completion-args"> {c.args}</span>}
                <span className="command-completion-desc"> — {c.desc}</span>
              </span>
            ))}
          </div>
        )}
        {error && <div className="command-error">{error}</div>}
        <div className="command-help">
          :q :tabnew :cd :bm :filter :zip :unzip :init-config :reload-config
        </div>
      </div>
    </div>
  );
}
