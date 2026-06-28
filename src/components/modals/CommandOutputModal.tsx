import { useEffect, useRef } from 'react';
import { useCustomCommandStore } from '../../store/customCommandStore';

const SCROLL_STEP = 60;

export function CommandOutputModal() {
  const { output, clearOutput } = useCustomCommandStore();
  const bodyRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (!output) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        clearOutput();
        return;
      }
      if (e.key === 'j') {
        e.preventDefault();
        bodyRef.current?.scrollBy({ top: SCROLL_STEP });
      }
      if (e.key === 'k') {
        e.preventDefault();
        bodyRef.current?.scrollBy({ top: -SCROLL_STEP });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [output, clearOutput]);

  if (!output) return null;

  const isError = output.exit_code !== 0;
  const body = [output.stdout, output.stderr].filter(Boolean).join('\n');

  return (
    <div className="modal-overlay" onClick={clearOutput}>
      <div className="modal command-output-modal" onClick={(e) => e.stopPropagation()}>
        <div className="command-output-header">
          <span className="command-output-label">{output.command}</span>
          <span className={`command-output-badge ${isError ? 'error' : 'ok'}`}>
            exit {output.exit_code}
          </span>
          <span className="command-output-hint">j/k scroll · Enter/Esc close</span>
          <button className="command-output-close" onClick={clearOutput}>✕</button>
        </div>
        <pre ref={bodyRef} className={`command-output-body${isError ? ' command-output-stderr' : ''}`}>
          {body}
        </pre>
      </div>
    </div>
  );
}
