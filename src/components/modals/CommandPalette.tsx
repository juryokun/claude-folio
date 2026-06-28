import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useImeAwareEnter } from '../../hooks/useImeAwareEnter';
import path from 'path-browserify';
import { useUiStore } from '../../store/uiStore';
import { useTabStore } from '../../store/tabStore';
import { useFileStore } from '../../store/fileStore';
import { useBookmarkStore } from '../../store/bookmarkStore';
import { useConfigStore } from '../../store/configStore';
import { useCustomCommandStore } from '../../store/customCommandStore';
import { tauriApi } from '../../lib/tauri';
import { THEMES, isValidThemeId } from '../../lib/themes';
import { substitutePlaceholders, shouldShowOutputModal } from '../../lib/customCommands';

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

  const { showCommandPalette, setShowCommandPalette, setVimMode, has7zip, setLanguage, setTheme, showStatusMessage, showConfirmDialog } =
    useUiStore();
  const { activeTab, navigateTo, openTab, closeTab, activeTabId } = useTabStore();
  const { loadDir } = useFileStore();
  const { showHidden } = useUiStore();
  const { addBookmark } = useBookmarkStore();
  const loadConfig = useConfigStore((s) => s.load);
  const { commands: customCommands, runCommand, pushHistory, history } = useCustomCommandStore();

  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [cycleIndex, setCycleIndex] = useState(-1);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const isShellMode = input.startsWith(':!');
  const shellInput = isShellMode ? input.slice(2) : '';

  useEffect(() => {
    if (showCommandPalette) {
      setInput(':');
      setError('');
      setCycleIndex(-1);
      setHistoryIndex(-1);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.setSelectionRange(1, 1);
      }, 0);
    }
  }, [showCommandPalette]);

  const typedCommand = input.slice(1).split(/\s/)[0];
  const hasArgs = input.slice(1).includes(' ');
  const typedArg = hasArgs ? input.slice(1).split(/\s+/).slice(1).join(' ') : '';

  // Builtin command candidates
  const cmdCandidates = useMemo((): CommandDef[] => {
    if (isShellMode || hasArgs) return [];
    if (!typedCommand) return COMMANDS;
    const exact = COMMANDS.find((c) => c.name === typedCommand);
    if (exact) return [];
    return COMMANDS.filter((c) => c.name.startsWith(typedCommand));
  }, [typedCommand, hasArgs, isShellMode, COMMANDS]);

  // Custom command candidates (shown when no builtin candidates)
  const customCandidates = useMemo(() => {
    if (isShellMode || hasArgs || cmdCandidates.length > 0) return [];
    if (!typedCommand) return customCommands;
    return customCommands.filter((c) => c.name.startsWith(typedCommand) && c.name !== typedCommand);
  }, [typedCommand, hasArgs, isShellMode, cmdCandidates, customCommands]);

  // Arg candidates for builtin commands
  const argCandidates = useMemo((): string[] => {
    if (!hasArgs || isShellMode) return [];
    const cmd = COMMANDS.find((c) => c.name === typedCommand);
    if (!cmd?.argValues) return [];
    return cmd.argValues.filter((v) => v.startsWith(typedArg));
  }, [hasArgs, typedCommand, typedArg, isShellMode, COMMANDS]);

  const activeList = cmdCandidates.length > 0
    ? cmdCandidates
    : customCandidates.length > 0
    ? customCandidates
    : argCandidates.length > 0 ? argCandidates : [];

  const close = useCallback(() => {
    setShowCommandPalette(false);
    setVimMode('NORMAL');
    setInput('');
    setCycleIndex(-1);
    setHistoryIndex(-1);
  }, [setShowCommandPalette, setVimMode]);

  const getPlaceholderContext = useCallback(() => {
    const tab = activeTab();
    const pane = useFileStore.getState().getPane(tab.id);
    const entry = pane.entries[pane.cursor];
    const filePath = entry ? entry.path : tab.path;
    return {
      file: filePath,
      dir: tab.path,
      name: entry ? entry.name : '',
    };
  }, [activeTab]);

  const executeCustomCommand = useCallback(async (cmd: typeof customCommands[0]) => {
    const ctx = getPlaceholderContext();
    const resolved = substitutePlaceholders(cmd.command, ctx);
    const shell = cmd.shell || '';

    const doRun = async () => {
      const tab = activeTab();
      close();
      try {
        const result = await runCommand(resolved, shell, tab.path, `:${cmd.name}`);
        if (result.exit_code !== 0) {
          return;
        }
        const forceModal = cmd.output === 'modal';
        if (!forceModal && !shouldShowOutputModal(result.stdout)) {
          const brief = result.stdout.trim() || t('commandPalette.msg.customDone', { name: cmd.name });
          showStatusMessage(brief, 5000);
          useCustomCommandStore.getState().clearOutput();
        }
        if (cmd.reload) {
          loadDir(tab.id, tab.path, showHidden);
        }
      } catch (e) {
        showStatusMessage(String(e));
      }
    };

    if (cmd.confirm) {
      showConfirmDialog(
        t('commandPalette.msg.customConfirm', { name: cmd.name, command: resolved }),
        doRun,
      );
    } else {
      await doRun();
    }
  }, [activeTab, close, getPlaceholderContext, loadDir, runCommand, showConfirmDialog, showHidden, showStatusMessage, t]);

  const executeShellCommand = useCallback(async (rawCommand: string) => {
    const ctx = getPlaceholderContext();
    const resolved = substitutePlaceholders(rawCommand, ctx);
    pushHistory(rawCommand);
    const tab = activeTab();
    close();
    try {
      const result = await runCommand(resolved, '', tab.path, `:!${rawCommand}`);
      if (!shouldShowOutputModal(result.stdout) && result.exit_code === 0) {
        const brief = result.stdout.trim() || '✅ Done';
        showStatusMessage(brief, 5000);
        useCustomCommandStore.getState().clearOutput();
      }
    } catch (e) {
      showStatusMessage(String(e));
    }
  }, [activeTab, close, getPlaceholderContext, pushHistory, runCommand, showStatusMessage]);

  const runCommand_ = useCallback(async (cmd: string) => {
    if (isShellMode) {
      if (shellInput.trim()) await executeShellCommand(shellInput.trim());
      return;
    }

    const tab = activeTab();
    const parts = cmd.slice(1).trim().split(/\s+/);
    const command = parts[0];
    const args = parts.slice(1);

    // Check custom commands first
    const custom = customCommands.find((c) => c.name === command);
    if (custom) {
      await executeCustomCommand(custom);
      return;
    }

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
  }, [isShellMode, shellInput, activeTab, customCommands, executeCustomCommand, executeShellCommand,
      closeTab, activeTabId, openTab, navigateTo, has7zip, loadDir, showHidden, addBookmark,
      setLanguage, setTheme, loadConfig, close, showStatusMessage, t]);

  const ime = useImeAwareEnter(() => runCommand_(input));

  const selectCmdCandidate = useCallback((cmd: CommandDef) => {
    const suffix = cmd.args ? ' ' : '';
    const newInput = ':' + cmd.name + suffix;
    setInput(newInput);
    setCycleIndex(-1);
    inputRef.current?.focus();
    if (!cmd.args) runCommand_(newInput);
  }, [runCommand_]);

  const selectCustomCandidate = useCallback((cmd: typeof customCommands[0]) => {
    setInput(':' + cmd.name);
    setCycleIndex(-1);
    inputRef.current?.focus();
    executeCustomCommand(cmd);
  }, [executeCustomCommand]);

  const selectArgCandidate = useCallback((val: string) => {
    const newInput = ':' + typedCommand + ' ' + val;
    setInput(newInput);
    setCycleIndex(-1);
    inputRef.current?.focus();
  }, [typedCommand]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { close(); return; }

    // History navigation in shell mode
    if (isShellMode) {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const next = Math.min(historyIndex + 1, history.length - 1);
        setHistoryIndex(next);
        if (history[next]) setInput(':!' + history[next]);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = historyIndex - 1;
        setHistoryIndex(Math.max(next, -1));
        setInput(':!' + (next >= 0 ? history[next] : ''));
        return;
      }
    }

    const listLen = activeList.length;
    const isDown = e.key === 'ArrowDown' || (e.key === 'j' && e.ctrlKey);
    const isUp   = e.key === 'ArrowUp'   || (e.key === 'k' && e.ctrlKey);
    if (isDown && listLen > 0) {
      e.preventDefault();
      setCycleIndex((i) => (i + 1) % listLen);
      return;
    }
    if (isUp && listLen > 0) {
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
      } else if (customCandidates.length === 1) {
        selectCustomCandidate(customCandidates[0]);
      } else if (argCandidates.length > 0) {
        const next = (cycleIndex + 1) % argCandidates.length;
        setCycleIndex(next);
        selectArgCandidate(argCandidates[next]);
      } else {
        const exact = COMMANDS.find((c) => c.name === typedCommand);
        if (exact?.args) setInput(':' + exact.name + ' ');
      }
      return;
    }

    if (e.key === 'Enter' && cycleIndex >= 0 && !isShellMode) {
      e.preventDefault();
      if (cmdCandidates.length > 0) {
        selectCmdCandidate(cmdCandidates[cycleIndex] as CommandDef);
      } else if (customCandidates.length > 0) {
        selectCustomCandidate(customCandidates[cycleIndex]);
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
          onChange={(e) => {
            setInput(e.target.value);
            setError('');
            setCycleIndex(-1);
            setHistoryIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          onCompositionStart={ime.handlers.onCompositionStart}
          onCompositionEnd={ime.handlers.onCompositionEnd}
          placeholder={isShellMode ? 'shell command  ({file} {dir} {name})' : t('commandPalette.placeholder')}
        />

        {/* Shell mode: history list */}
        {isShellMode && history.length > 0 && shellInput === '' && (
          <div className="command-completions">
            {history.slice(0, 10).map((h, i) => (
              <span
                key={i}
                className={`command-completion-item${i === historyIndex ? ' active' : ''}`}
                onMouseDown={(e) => { e.preventDefault(); setInput(':!' + h); inputRef.current?.focus(); }}
              >
                <span className="command-completion-name">!</span>
                <span className="command-completion-args"> {h}</span>
              </span>
            ))}
          </div>
        )}

        {/* Builtin command candidates */}
        {!isShellMode && cmdCandidates.length > 0 && (
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

        {/* Custom command candidates */}
        {!isShellMode && customCandidates.length > 0 && (
          <div className="command-completions">
            {customCandidates.map((c, i) => (
              <span
                key={c.name}
                className={`command-completion-item custom${i === cycleIndex ? ' active' : ''}`}
                onMouseDown={(e) => { e.preventDefault(); selectCustomCandidate(c); }}
                onMouseEnter={() => setCycleIndex(i)}
              >
                <span className="command-completion-name">:{c.name}</span>
                <span className="command-completion-desc"> — {c.desc || c.command}</span>
                <span className="command-custom-badge">custom</span>
              </span>
            ))}
          </div>
        )}

        {/* Arg candidates */}
        {!isShellMode && argCandidates.length > 0 && (
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

        {isShellMode && (
          <div className="command-shell-hint">
            {t('commandPaletteHint.shellMode')} · ↑↓ {t('commandPaletteHint.history')}
          </div>
        )}
      </div>
    </div>
  );
}
