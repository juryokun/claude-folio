import { useCallback, useRef } from 'react';

/**
 * Returns event handlers to attach to an <input> so that Enter during IME
 * composition (kanji conversion underline visible) is ignored.
 *
 * On macOS WKWebView the event order when confirming with Enter is:
 *   compositionend → keydown(Enter)
 * so e.nativeEvent.isComposing is already false by the time keydown fires.
 * We track both an active-composition flag AND the timestamp of compositionend,
 * then ignore Enter if composition ended within the last 50 ms.
 *
 * Usage:
 *   const ime = useImeAwareEnter(() => handleSubmit());
 *   <input {...ime.handlers} ... />
 */
export function useImeAwareEnter(onEnter: () => void) {
  const composingRef = useRef(false);
  const endedAtRef = useRef(0);

  const handlers = {
    onCompositionStart: useCallback(() => {
      composingRef.current = true;
    }, []),
    onCompositionEnd: useCallback(() => {
      composingRef.current = false;
      endedAtRef.current = Date.now();
    }, []),
    onKeyDown: useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
          const justFinishedIme = composingRef.current || Date.now() - endedAtRef.current < 50;
          if (!justFinishedIme) onEnter();
        }
      },
      [onEnter],
    ),
  };

  return { handlers };
}
