import type { TFunction } from 'i18next';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RenamePlanError, RenamePlanResult } from '../../lib/bulkRename';
import { planRegexRename, planSequenceRename } from '../../lib/bulkRename';
import { tauriApi } from '../../lib/tauri';
import { useFileStore } from '../../store/fileStore';
import { useTabStore } from '../../store/tabStore';
import { useUiStore } from '../../store/uiStore';

type Mode = 'sequence' | 'regex';

function errorKey(err: RenamePlanError): string {
  switch (err.code) {
    case 'empty_name':
    case 'invalid_name':
      return `${err.code}:${err.fromName}`;
    case 'duplicate_name':
      return `${err.code}:${err.name}`;
    case 'invalid_regex':
      return err.code;
  }
}

function errorMessage(t: TFunction, err: RenamePlanError): string {
  switch (err.code) {
    case 'empty_name':
      return t('bulkRenameModal.errorEmptyName', { name: err.fromName });
    case 'invalid_name':
      return t('bulkRenameModal.errorInvalidName', { name: err.fromName });
    case 'duplicate_name':
      return t('bulkRenameModal.errorDuplicateName', { name: err.name });
    case 'invalid_regex':
      return t('bulkRenameModal.errorInvalidRegex');
  }
}

export function BulkRenameModal() {
  const { t } = useTranslation();
  const { showBulkRename, setShowBulkRename, showHidden, showStatusMessage } = useUiStore();
  const { activeTab } = useTabStore();
  const { getPane, filteredEntries, loadDir, clearSelection } = useFileStore();

  const [mode, setMode] = useState<Mode>('sequence');
  const [prefix, setPrefix] = useState('');
  const [suffix, setSuffix] = useState('');
  const [start, setStart] = useState(1);
  const [digits, setDigits] = useState(3);
  const [preserveExt, setPreserveExt] = useState(true);
  const [pattern, setPattern] = useState('');
  const [replacement, setReplacement] = useState('');
  const [globalFlag, setGlobalFlag] = useState(true);
  const [caseInsensitive, setCaseInsensitive] = useState(false);
  const [targetExt, setTargetExt] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!showBulkRename) return;
    setMode('sequence');
    setPrefix('');
    setSuffix('');
    setStart(1);
    setDigits(3);
    setPreserveExt(true);
    setPattern('');
    setReplacement('');
    setGlobalFlag(true);
    setCaseInsensitive(false);
    setTargetExt(false);
  }, [showBulkRename]);

  const tab = activeTab();
  const pane = getPane(tab.id);
  const allEntries = filteredEntries(tab.id);
  const selectedEntries = useMemo(
    () => allEntries.filter((e) => pane.selected.has(e.path)),
    [allEntries, pane.selected],
  );

  const plan: RenamePlanResult = useMemo(() => {
    if (!showBulkRename) return { items: [], errors: [] };
    if (mode === 'sequence') {
      return planSequenceRename(selectedEntries, allEntries, {
        prefix,
        suffix,
        start,
        digits,
        preserveExt,
      });
    }
    if (!pattern) return { items: [], errors: [] };
    const flags = `${globalFlag ? 'g' : ''}${caseInsensitive ? 'i' : ''}`;
    return planRegexRename(selectedEntries, allEntries, { pattern, flags, replacement, targetExt });
  }, [
    showBulkRename,
    mode,
    selectedEntries,
    allEntries,
    prefix,
    suffix,
    start,
    digits,
    preserveExt,
    pattern,
    replacement,
    globalFlag,
    caseInsensitive,
    targetExt,
  ]);

  if (!showBulkRename) return null;

  const canExecute = plan.items.length > 0 && plan.errors.length === 0 && !running;
  const handleClose = () => setShowBulkRename(false);

  const handleExecute = async () => {
    if (!canExecute) return;
    setRunning(true);
    let success = 0;
    const failures: string[] = [];
    for (const item of plan.items) {
      try {
        await tauriApi.renameFile(item.from, item.to);
        success++;
      } catch {
        failures.push(item.fromName);
      }
    }
    setRunning(false);
    setShowBulkRename(false);
    clearSelection(tab.id);
    loadDir(tab.id, tab.path, showHidden);
    showStatusMessage(
      failures.length === 0
        ? t('bulkRenameModal.success', { count: success })
        : t('bulkRenameModal.partialFailure', { success, failed: failures.length }),
    );
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="modal bulk-rename-modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') handleClose();
        }}
      >
        <div className="modal-title">
          {t('bulkRenameModal.title', { count: selectedEntries.length })}
        </div>

        <div className="bulk-rename-tabs">
          <button
            className={mode === 'sequence' ? 'active' : ''}
            onClick={() => setMode('sequence')}
          >
            {t('bulkRenameModal.sequenceTab')}
          </button>
          <button className={mode === 'regex' ? 'active' : ''} onClick={() => setMode('regex')}>
            {t('bulkRenameModal.regexTab')}
          </button>
        </div>

        {mode === 'sequence' ? (
          <div className="bulk-rename-fields">
            <label>
              {t('bulkRenameModal.prefix')}
              <input
                className="modal-input"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
              />
            </label>
            <label>
              {t('bulkRenameModal.suffix')}
              <input
                className="modal-input"
                value={suffix}
                onChange={(e) => setSuffix(e.target.value)}
              />
            </label>
            <label>
              {t('bulkRenameModal.start')}
              <input
                type="number"
                className="modal-input"
                value={start}
                onChange={(e) => setStart(Number(e.target.value))}
              />
            </label>
            <label>
              {t('bulkRenameModal.digits')}
              <input
                type="number"
                min={0}
                className="modal-input"
                value={digits}
                onChange={(e) => setDigits(Math.max(0, Number(e.target.value)))}
              />
            </label>
            <label className="bulk-rename-checkbox">
              <input
                type="checkbox"
                checked={preserveExt}
                onChange={(e) => setPreserveExt(e.target.checked)}
              />
              {t('bulkRenameModal.preserveExt')}
            </label>
          </div>
        ) : (
          <div className="bulk-rename-fields">
            <label>
              {t('bulkRenameModal.pattern')}
              <input
                className="modal-input"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                placeholder={t('bulkRenameModal.patternPlaceholder')}
              />
            </label>
            <label>
              {t('bulkRenameModal.replacement')}
              <input
                className="modal-input"
                value={replacement}
                onChange={(e) => setReplacement(e.target.value)}
              />
            </label>
            <label className="bulk-rename-checkbox">
              <input
                type="checkbox"
                checked={globalFlag}
                onChange={(e) => setGlobalFlag(e.target.checked)}
              />
              {t('bulkRenameModal.globalFlag')}
            </label>
            <label className="bulk-rename-checkbox">
              <input
                type="checkbox"
                checked={caseInsensitive}
                onChange={(e) => setCaseInsensitive(e.target.checked)}
              />
              {t('bulkRenameModal.caseInsensitive')}
            </label>
            <label className="bulk-rename-checkbox">
              <input
                type="checkbox"
                checked={targetExt}
                onChange={(e) => setTargetExt(e.target.checked)}
              />
              {t('bulkRenameModal.targetExt')}
            </label>
          </div>
        )}

        {plan.errors.length > 0 && (
          <ul className="bulk-rename-errors">
            {plan.errors.map((err) => (
              <li key={errorKey(err)}>{errorMessage(t, err)}</li>
            ))}
          </ul>
        )}

        <ul className="bulk-rename-preview conflict-list">
          {plan.items.map((item) => (
            <li key={item.from} className="conflict-item bulk-rename-preview-item">
              <span className="bulk-rename-preview-from">{item.fromName}</span>
              <span className="bulk-rename-preview-arrow">→</span>
              <span className="bulk-rename-preview-to">{item.toName}</span>
            </li>
          ))}
          {plan.items.length === 0 && plan.errors.length === 0 && (
            <li className="conflict-item conflict-more">{t('bulkRenameModal.noPreview')}</li>
          )}
        </ul>

        <div className="modal-actions">
          <button onClick={handleClose}>{t('bulkRenameModal.cancel')}</button>
          <button className="primary" disabled={!canExecute} onClick={handleExecute}>
            {t('bulkRenameModal.rename')}
          </button>
        </div>
      </div>
    </div>
  );
}
