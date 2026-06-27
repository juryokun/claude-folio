import { useEffect, useRef, useCallback } from 'react';
import { type KeyBinding, type VimAction } from '../lib/vim/keymap';
import { useUiStore } from '../store/uiStore';

const SEQUENCE_TIMEOUT = 500;

export function useVimKeys(onAction: (action: VimAction) => void, keymap: KeyBinding[]) {
  const vimMode = useUiStore((s) => s.vimMode);
  const bufferRef = useRef<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearBuffer = useCallback(() => {
    bufferRef.current = [];
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const tryMatch = useCallback(
    (buffer: string[]) => {
      const exact = keymap.find(
        (kb) => kb.keys.length === buffer.length && kb.keys.every((k, i) => k === buffer[i])
      );
      if (exact) {
        onAction(exact.action);
        clearBuffer();
        return;
      }

      const hasPrefix = keymap.some(
        (kb) => kb.keys.length > buffer.length && kb.keys.every((k, i) => i >= buffer.length || k === buffer[i])
      );

      if (!hasPrefix) {
        clearBuffer();
      } else {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(clearBuffer, SEQUENCE_TIMEOUT);
      }
    },
    [onAction, clearBuffer, keymap]
  );

  useEffect(() => {
    if (vimMode !== 'NORMAL') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      // Ctrl+L → focus path bar (modifier combo, handled outside keymap)
      if (e.key === 'l' && e.ctrlKey) {
        e.preventDefault();
        onAction('focus_path_bar');
        clearBuffer();
        return;
      }

      // Cmd+C / Cmd+X / Cmd+V / Cmd+Delete — macOS-style shortcuts
      if (e.metaKey && !e.ctrlKey && !e.altKey) {
        if (e.key === 'c') { e.preventDefault(); onAction('yank_selected'); clearBuffer(); return; }
        if (e.key === 'x') { e.preventDefault(); onAction('cut_selected'); clearBuffer(); return; }
        if (e.key === 'v') { e.preventDefault(); onAction('paste'); clearBuffer(); return; }
        if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); onAction('delete_selected'); clearBuffer(); return; }
        if (e.key === 'w') { e.preventDefault(); onAction('close_tab'); clearBuffer(); return; }
      }

      // ArrowLeft → navigate to parent
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onAction('navigate_up');
        clearBuffer();
        return;
      }

      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Dead'].includes(e.key)) return;

      if (e.key === 'Escape') {
        clearBuffer();
        return;
      }

      const key = e.key;
      const isHandled = keymap.some((kb) => kb.keys.includes(key));
      if (isHandled || bufferRef.current.length > 0) e.preventDefault();

      bufferRef.current = [...bufferRef.current, key];
      tryMatch([...bufferRef.current]);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [vimMode, onAction, clearBuffer, tryMatch]);
}
