import { useState, useRef, useEffect } from 'react';
import { useImeAwareEnter } from '../../hooks/useImeAwareEnter';
import path from 'path-browserify';
import { useUiStore } from '../../store/uiStore';
import { useTabStore } from '../../store/tabStore';
import { useFileStore } from '../../store/fileStore';
import { useBookmarkStore } from '../../store/bookmarkStore';
import { tauriApi } from '../../lib/tauri';

export function CommandPalette() {
  const { showCommandPalette, setShowCommandPalette, setVimMode, has7zip } =
    useUiStore();
  const { activeTab, navigateTo, openTab, closeTab, activeTabId } = useTabStore();
  const { loadDir } = useFileStore();
  const { showHidden } = useUiStore();
  const { addBookmark } = useBookmarkStore();

  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const ime = useImeAwareEnter(() => runCommand(input));

  useEffect(() => {
    if (showCommandPalette) {
      setInput(':');
      setError('');
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.setSelectionRange(1, 1);
      }, 0);
    }
  }, [showCommandPalette]);

  if (!showCommandPalette) return null;

  const close = () => {
    setShowCommandPalette(false);
    setVimMode('NORMAL');
    setInput('');
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
            // Use zoxide
            const results = await tauriApi.zoxideQuery(target);
            if (results.length > 0) navigateTo(results[0]);
            else setError(`見つかりません: ${target}`);
          }
          break;
        }
        case 'bm': {
          const label = args.join(' ') || path.basename(tab.path);
          addBookmark(label, tab.path);
          break;
        }
        case 'sort':
          // TODO: implement sort in fileStore
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
          onChange={(e) => { setInput(e.target.value); setError(''); }}
          {...ime.handlers}
          onKeyDown={(e) => {
            ime.handlers.onKeyDown(e);
            if (e.key === 'Escape') close();
          }}
          placeholder=":コマンド (例: cd, bm, zip, tabnew, q)"
        />
        {error && <div className="command-error">{error}</div>}
        <div className="command-help">
          :q :tabnew [path] :cd [path/keyword] :bm [label] :zip [name] :unzip
        </div>
      </div>
    </div>
  );
}
