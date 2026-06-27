import { useEffect, useRef, useCallback } from 'react';
import { NORMAL_KEYMAP, type VimAction } from '../lib/vim/keymap';
import { useUiStore } from '../store/uiStore';

const SEQUENCE_TIMEOUT = 500; // ms to wait for multi-key sequence

export function useVimKeys(onAction: (action: VimAction) => void) {
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
      const exact = NORMAL_KEYMAP.find(
        (kb) => kb.keys.length === buffer.length && kb.keys.every((k, i) => k === buffer[i])
      );
      if (exact) {
        onAction(exact.action);
        clearBuffer();
        return;
      }

      // Check if any binding has our buffer as a prefix
      const hasPrefix = NORMAL_KEYMAP.some(
        (kb) => kb.keys.length > buffer.length && kb.keys.every((k, i) => i >= buffer.length || k === buffer[i])
      );

      if (!hasPrefix) {
        clearBuffer();
      } else {
        // Wait for more keys
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          clearBuffer();
        }, SEQUENCE_TIMEOUT);
      }
    },
    [onAction, clearBuffer]
  );

  useEffect(() => {
    if (vimMode !== 'NORMAL') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // Disable vim keys when user is typing in an input/textarea
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      // Ctrl+L → focus path bar
      if (e.key === 'l' && e.ctrlKey) {
        e.preventDefault();
        onAction('focus_path_bar');
        clearBuffer();
        return;
      }

      // Option+ArrowUp → navigate to parent
      if (e.key === 'ArrowUp' && e.altKey) {
        e.preventDefault();
        onAction('navigate_up');
        clearBuffer();
        return;
      }

      // Ignore modifier-only keys and browser shortcuts (except what we handle)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // Escape clears the key buffer but is handled by App.tsx
      if (e.key === 'Escape') {
        clearBuffer();
        return;
      }

      const key = e.key;

      // Prevent default for keys we handle
      const isHandled = NORMAL_KEYMAP.some((kb) => kb.keys.includes(key));
      if (isHandled || bufferRef.current.length > 0) {
        e.preventDefault();
      }

      bufferRef.current = [...bufferRef.current, key];
      tryMatch([...bufferRef.current]);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [vimMode, onAction, clearBuffer, tryMatch]);
}
