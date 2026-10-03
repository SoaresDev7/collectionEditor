import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button, cx } from './primitives';

export type MenuItem = { label: string; icon?: ReactNode; hint?: string; onSelect: () => void; disabled?: boolean };

/** Botão com lista suspensa de ações. */
export function Menu({ label, icon, items, align = 'right' }: { label: ReactNode; icon?: ReactNode; items: MenuItem[]; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Button size="sm" variant="ghost" icon={icon} onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open}>
        {label}
        <ChevronDown size={12} />
      </Button>
      {open && (
        <div role="menu" className={cx('absolute top-8 z-30 min-w-56 rounded-md border border-line bg-panel py-1 shadow-lg', align === 'right' ? 'right-0' : 'left-0')}>
          {items.map((item) => (
            <button
              key={item.label}
              role="menuitem"
              type="button"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-panel-2 disabled:opacity-50"
            >
              <span className="text-muted">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.hint && <kbd className="font-mono text-[11px] text-muted">{item.hint}</kbd>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
