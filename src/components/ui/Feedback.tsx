import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useFeedbackStore, type ToastKind } from '@/store/feedbackStore';
import { Button, Field, IconButton, Input, cx } from './primitives';

const TOAST_ICON: Record<ToastKind, ReactNode> = {
  success: <CheckCircle2 size={16} className="text-ok" />,
  error: <XCircle size={16} className="text-danger" />,
  warning: <AlertTriangle size={16} className="text-warn" />,
  info: <Info size={16} className="text-accent" />,
};

export function Toasts() {
  const toasts = useFeedbackStore((s) => s.toasts);
  const dismiss = useFeedbackStore((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex max-w-sm items-center gap-2 rounded-md border border-line bg-panel px-3 py-2 text-sm shadow-lg"
        >
          {TOAST_ICON[t.kind]}
          <span className="flex-1">{t.message}</span>
          <IconButton label="Fechar" onClick={() => dismiss(t.id)}>
            <X size={14} />
          </IconButton>
        </div>
      ))}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md rounded-lg border border-line bg-panel p-5 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 text-base font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog() {
  const req = useFeedbackStore((s) => s.confirmRequest);
  const close = useFeedbackStore((s) => s.closeConfirm);
  if (!req) return null;
  return (
    <Modal title={req.title} onClose={() => close(false)}>
      <p className="text-sm text-muted">{req.message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={() => close(false)}>Cancelar</Button>
        <Button autoFocus variant={req.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
          {req.confirmLabel ?? 'Confirmar'}
        </Button>
      </div>
    </Modal>
  );
}

export function PromptDialog() {
  const req = useFeedbackStore((s) => s.promptRequest);
  const close = useFeedbackStore((s) => s.closePrompt);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (req) {
      setValue(req.defaultValue);
      requestAnimationFrame(() => inputRef.current?.select());
    }
  }, [req]);

  if (!req) return null;
  const error = req.validate?.(value) ?? null;
  const submit = () => !error && close(value);

  return (
    <Modal title={req.title} onClose={() => close(null)}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label={req.label} error={error}>
          <Input
            ref={inputRef}
            type={req.inputType ?? 'text'}
            value={value}
            invalid={!!error}
            onChange={(e) => setValue(e.target.value)}
          />
        </Field>
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={() => close(null)}>Cancelar</Button>
          <Button type="submit" variant="primary" disabled={!!error} className={cx(error && 'opacity-50')}>
            OK
          </Button>
        </div>
      </form>
    </Modal>
  );
}
