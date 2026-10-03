import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { cx } from '@/components/ui/primitives';

export const SIDEBAR_MIN = 200;
export const SIDEBAR_MAX = 800;
export const SIDEBAR_DEFAULT = 288;

export const clampSidebar = (w: number) =>
  Math.round(Math.min(Math.max(w, SIDEBAR_MIN), Math.min(SIDEBAR_MAX, window.innerWidth - 320)));

/**
 * Alça vertical para redimensionar a barra lateral: arrastar com o mouse,
 * setas do teclado (Shift = passos maiores) e duplo clique para o tamanho padrão.
 */
export function ResizeHandle({ width, onChange }: { width: number; onChange: (w: number) => void }) {
  const start = useRef<{ x: number; w: number } | null>(null);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, w: width };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (start.current) onChange(clampSidebar(start.current.w + e.clientX - start.current.x));
  };
  const onPointerUp = () => {
    start.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 64 : 16;
    if (e.key === 'ArrowLeft') onChange(clampSidebar(width - step));
    else if (e.key === 'ArrowRight') onChange(clampSidebar(width + step));
    else if (e.key === 'Home') onChange(SIDEBAR_MIN);
    else if (e.key === 'End') onChange(clampSidebar(SIDEBAR_MAX));
    else return;
    e.preventDefault();
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Redimensionar barra lateral"
      aria-valuenow={width}
      aria-valuemin={SIDEBAR_MIN}
      aria-valuemax={SIDEBAR_MAX}
      tabIndex={0}
      title="Arraste para redimensionar · duplo clique: tamanho padrão"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={() => onChange(SIDEBAR_DEFAULT)}
      onKeyDown={onKeyDown}
      className={cx(
        'group absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize touch-none',
        'focus-visible:outline-none',
      )}
    >
      <div className="mx-auto h-full w-0.5 bg-transparent transition-colors group-hover:bg-accent group-focus-visible:bg-accent group-active:bg-accent" />
    </div>
  );
}
