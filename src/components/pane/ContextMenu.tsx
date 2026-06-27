import { useEffect, useRef } from 'react';

interface MenuItem {
  label: string;
  icon: string;
  shortcut?: string;
  action: () => void;
  disabled?: boolean;
}

interface Separator {
  kind: 'sep';
}

type MenuEntry = MenuItem | Separator;

interface Props {
  x: number;
  y: number;
  items: MenuEntry[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  useEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (rect.right > vw) ref.current.style.left = `${x - rect.width}px`;
    if (rect.bottom > vh) ref.current.style.top = `${y - rect.height}px`;
  }, [x, y]);

  return (
    <div
      ref={ref}
      className="context-menu"
      style={{ left: x, top: y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) => {
        if ('kind' in item) return <div key={i} className="context-menu-sep" />;
        return (
          <button
            key={i}
            className="context-menu-item"
            disabled={item.disabled}
            onClick={() => { onClose(); item.action(); }}
          >
            <span className="context-menu-icon">{item.icon}</span>
            <span className="context-menu-label">{item.label}</span>
            {item.shortcut && <span className="context-menu-shortcut">{item.shortcut}</span>}
          </button>
        );
      })}
    </div>
  );
}
