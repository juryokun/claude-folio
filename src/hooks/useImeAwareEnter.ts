import { useRef, useCallback } from 'react';

/**
 * Returns event handlers to attach to an <input> so that Enter during IME
 * composition (kanji conversion underline visible) is ignored.
 *
 * On macOS WKWebView, compositionend fires before the final keydown, so
 * e.nativeEvent.isComposing is already false by the time Enter is processed.
 * We track composition state ourselves to close that race window.
 *
 * Usage:
 *   const ime = useImeAwareEnter(() => handleSubmit());
 *   <input {...ime.handlers} ... />
 */
export function useImeAwareEnter(onEnter: () => void) {
  const composingRef = useRef(false);

  const handlers = {
    onCompositionStart: useCallback(() => { composingRef.current = true; }, []),
    // Delay by one tick: compositionend fires before keydown on macOS WKWebView,
    // so without the timeout composingRef would already be false when Enter's
    // keydown handler runs.
    onCompositionEnd: useCallback(() => { setTimeout(() => { composingRef.current = false; }, 0); }, []),
    onKeyDown: useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !composingRef.current) {
        onEnter();
      }
    }, [onEnter]),
  };

  return { handlers };
}
