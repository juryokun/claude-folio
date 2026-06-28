import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useImeAwareEnter } from '../../hooks/useImeAwareEnter';
import path from 'path-browserify';
import { useUiStore } from '../../store/uiStore';
import { useTabStore } from '../../store/tabStore';
import { useFileStore } from '../../store/fileStore';
import { useBookmarkStore } from '../../store/bookmarkStore';
import { useConfigStore } from '../../store/configStore';
import { tauriApi } from '../../lib/tauri';
import { THEMES, isValidThemeId } from '../../lib/themes';

interface CommandDef {
  name: string;
  args?: string;
  desc: string;
  argValues?: string[];
}

export function CommandPalette() {
  const { t } = useTranslation();

  const COMMANDS: CommandDef[] = useMemo(() => [
    { name: 'q',             desc: t('commandPalette.cmd.q') },
    { name: 'tabnew',        args: '[path]',    desc: t('commandPalette.cmd.tabnew') },
    { name: 'cd',            args: '<path|keyword>', desc: t('commandPalette.cmd.cd') },
    { name: 'bm',            args: '[label]',   desc: t('commandPalette.cmd.bm') },
    { name: 'filter',        args: '<ext>',     desc: t('commandPalette.cmd.filter') },
    { name: 'zip',           args: '[name]',    desc: t('commandPalette.cmd.zip') },
    { name: 'unzip',         desc: t('commandPalette.cmd.unzip') },
    { name: 'init-config',    desc: t('commandPalette.cmd.initConfig') },
    { name: 'reload-config',  desc: t('commandPalette.cmd.reloadConfig') },
    { name: 'clear-storage',  desc: t('commandPalette.cmd.clearStorage') },
    { name: 'lang',           args: '<ja|en>',   desc: t('commandPalette.cmd.lang'), argValues: ['ja', 'en'] },
    { name: 'theme',
      args: `<${THEMES.map((th) => th.id).join('|')}>`,
      desc: t('commandPalette.cmd.theme'),
      argValues: THEMES.map((th) => th.id),
    },
    { name: 'install-cli',    desc: t('commandPalette.cmd.installCli') },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [t]);

  const { showCommandPalette, setShowCommandPalette, setVimMode, has7zip, setLanguage, setTheme } =
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

  const typedCommand = input.slice(1).split(/\s/)[0];
  const hasArgs = input.slice(1).includes(' ');
  const typedArg = hasArgs ? input.slice(1).split(/\s+/).slice(1).join(' ') : '';

  // Command-level candidates (before the first space)
  const cmdCandidates = useMemo((): CommandDef[] => {
    if (hasArgs) return [];
    if (!typedCommand) return COMMANDS;
    const exact = COMMANDS.find((c) => c.name === typedCommand);
    if (exact) return [];
    return COMMANDS.filter((c) => c.name.startsWith(typedCommand));
  }, [typedCommand, hasArgs, COMMANDS]);

  // Argument-level candidates (after the first space, for commands with known values)
  const argCandidates = useMemo((): string[] => {
    if (!hasArgs) return [];
    const cmd = COMMANDS.find((c) => c.name === typedCommand);
    if (!cmd?.argValues) return [];
    return cmd.argValues.filter((v) => v.startsWith(typedArg));
  }, [hasArgs, typedCommand, typedArg, COMMANDS]);

  const activeList = cmdCandidates.length > 0
    ? cmdCandidates
    : argCandidates.length > 0 ? argCandidates : [];

  const close = useCallback(() => {
    setShowCommandPalette(false);
    setVimMode('NORMAL');
    setInput('');
    setCycleIndex(-1);
  }, [setShowCommandPalette, setVimMode]);

  const runCommand = useCallback(async (cmd: string) => {
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
            else setError(t('commandPalette.err.notFound', { target }));
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
          if (!has7zip) { setError(t('commandPalette.err.no7zip')); return; }
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
          if (!has7zip) { setError(t('commandPalette.err.no7zip')); return; }
          const pane = useFileStore.getState().getPane(tab.id);
          const entry = pane.entries[pane.cursor];
          if (entry) {
            await tauriApi.extract7zip(entry.path, tab.path);
            loadDir(tab.id, tab.path, showHidden);
          }
          break;
        }
        case 'clear-storage': {
          localStorage.clear();
          location.reload();
          return;
        }
        case 'install-cli': {
          try {
            await tauriApi.installCli();
            close();
            showStatusMessage(t('commandPalette.msg.cliInstalled'));
          } catch (e) {
            setError(String(e));
          }
          return;
        }
        case 'lang': {
          const lang = args[0] as 'ja' | 'en';
          if (lang !== 'ja' && lang !== 'en') {
            setError(t('commandPalette.err.langUsage'));
            return;
          }
          setLanguage(lang);
          close();
          showStatusMessage(t('commandPalette.msg.langChanged', { lang }));
          return;
        }
        case 'theme': {
          const id = args[0];
          if (!id || !isValidThemeId(id)) {
            setError(t('commandPalette.err.themeUsage'));
            return;
          }
          setTheme(id);
          close();
          showStatusMessage(t('commandPalette.msg.themeChanged', { id }));
          return;
        }
        case 'reload-config': {
          try {
            await loadConfig();
            close();
            showStatusMessage(t('commandPalette.msg.configReloaded'));
          } catch (e) {
            setError(String(e));
          }
          return;
        }
        case 'init-config': {
          try {
            const configPath = await tauriApi.initConfig();
            close();
            showStatusMessage(t('commandPalette.msg.configCreated', { path: configPath }));
          } catch (e) {
            if (String(e) === 'exists') {
              close();
              showStatusMessage(t('commandPalette.msg.configExists'), 4000);
            } else {
              setError(String(e));
            }
          }
          return;
        }
        default:
          setError(t('commandPalette.err.unknown', { command }));
          return;
      }
      close();
    } catch (e) {
      setError(String(e));
    }
  }, [activeTab, closeTab, activeTabId, openTab, navigateTo, has7zip, loadDir, showHidden,
      addBookmark, setLanguage, setTheme, loadConfig, close, showStatusMessage, t]);

  const ime = useImeAwareEnter(() => runCommand(input));

  // Select a command candidate: fill input with command name (+ space if has args)
  const selectCmdCandidate = useCallback((cmd: CommandDef) => {
    const suffix = cmd.args ? ' ' : '';
    const newInput = ':' + cmd.name + suffix;
    setInput(newInput);
    setCycleIndex(-1);
    inputRef.current?.focus();
    if (!cmd.args) {
      runCommand(newInput);
    }
  }, [runCommand]);

  // Select an arg candidate: fill input with the selected arg value
  const selectArgCandidate = useCallback((val: string) => {
    const newInput = ':' + typedCommand + ' ' + val;
    setInput(newInput);
    setCycleIndex(-1);
    inputRef.current?.focus();
  }, [typedCommand]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      close();
      return;
    }

    const listLen = activeList.length;

    if (e.key === 'ArrowDown' && listLen > 0) {
      e.preventDefault();
      setCycleIndex((i) => (i + 1) % listLen);
      return;
    }
    if (e.key === 'ArrowUp' && listLen > 0) {
      e.preventDefault();
      setCycleIndex((i) => (i - 1 + listLen) % listLen);
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      if (cmdCandidates.length > 0) {
        if (cmdCandidates.length === 1) {
          selectCmdCandidate(cmdCandidates[0]);
        } else {
          const next = (cycleIndex + 1) % cmdCandidates.length;
          setCycleIndex(next);
          setInput(':' + cmdCandidates[next].name);
        }
      } else if (argCandidates.length > 0) {
        const next = (cycleIndex + 1) % argCandidates.length;
        setCycleIndex(next);
        selectArgCandidate(argCandidates[next]);
      } else {
        // Exact match — add trailing space for args
        const exact = COMMANDS.find((c) => c.name === typedCommand);
        if (exact?.args) setInput(':' + exact.name + ' ');
      }
      return;
    }

    if (e.key === 'Enter' && cycleIndex >= 0) {
      e.preventDefault();
      if (cmdCandidates.length > 0) {
        selectCmdCandidate(cmdCandidates[cycleIndex] as CommandDef);
      } else if (argCandidates.length > 0) {
        selectArgCandidate(argCandidates[cycleIndex] as string);
      }
      return;
    }

    ime.handlers.onKeyDown(e);
  };

  if (!showCommandPalette) return null;

  return (
    <div className="modal-overlay" onClick={close}>
      <div className="modal command-palette" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="command-input"
          value={input}
          onChange={(e) => { setInput(e.target.value); setError(''); setCycleIndex(-1); }}
          onKeyDown={handleKeyDown}
          onCompositionStart={ime.handlers.onCompositionStart}
          onCompositionEnd={ime.handlers.onCompositionEnd}
          placeholder={t('commandPalette.placeholder')}
        />

        {cmdCandidates.length > 0 && (
          <div className="command-completions">
            {cmdCandidates.map((c, i) => (
              <span
                key={c.name}
                className={`command-completion-item${i === cycleIndex ? ' active' : ''}`}
                onMouseDown={(e) => { e.preventDefault(); selectCmdCandidate(c); }}
                onMouseEnter={() => setCycleIndex(i)}
              >
                <span className="command-completion-name">:{c.name}</span>
                {c.args && <span className="command-completion-args"> {c.args}</span>}
                <span className="command-completion-desc"> — {c.desc}</span>
              </span>
            ))}
          </div>
        )}

        {argCandidates.length > 0 && (
          <div className="command-arg-candidates">
            {argCandidates.map((val, i) => (
              <span
                key={val}
                className={`command-arg-item${i === cycleIndex ? ' active' : ''}`}
                onMouseDown={(e) => { e.preventDefault(); selectArgCandidate(val); }}
                onMouseEnter={() => setCycleIndex(i)}
              >
                {val}
              </span>
            ))}
          </div>
        )}

        {error && <div className="command-error">{error}</div>}
      </div>
    </div>
  );
}
