import { useCustomCommandStore } from '../../store/customCommandStore';

export function CommandOutputModal() {
  const { output, clearOutput } = useCustomCommandStore();
  if (!output) return null;

  const isError = output.exit_code !== 0;

  return (
    <div className="modal-overlay" onClick={clearOutput}>
      <div className="modal command-output-modal" onClick={(e) => e.stopPropagation()}>
        <div className="command-output-header">
          <span className="command-output-label">{output.command}</span>
          <span className={`command-output-badge ${isError ? 'error' : 'ok'}`}>
            exit {output.exit_code}
          </span>
          <button className="command-output-close" onClick={clearOutput}>✕</button>
        </div>
        {output.stdout && (
          <pre className="command-output-body">{output.stdout}</pre>
        )}
        {output.stderr && (
          <pre className="command-output-body command-output-stderr">{output.stderr}</pre>
        )}
      </div>
    </div>
  );
}
