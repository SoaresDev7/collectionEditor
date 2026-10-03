import { create } from 'zustand';
import { uid } from '@/lib/ids';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';
export type Toast = { id: string; kind: ToastKind; message: string };

export type ConfirmRequest = {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
};

export type PromptRequest = {
  title: string;
  label: string;
  defaultValue: string;
  inputType?: 'text' | 'number';
  validate?: (value: string) => string | null;
  resolve: (value: string | null) => void;
};

type FeedbackState = {
  toasts: Toast[];
  confirmRequest: ConfirmRequest | null;
  promptRequest: PromptRequest | null;
  notify: (kind: ToastKind, message: string) => void;
  dismiss: (id: string) => void;
  /** Abre um diálogo de confirmação e resolve com a escolha do usuário. */
  confirm: (opts: Omit<ConfirmRequest, 'resolve'>) => Promise<boolean>;
  /** Abre um diálogo com campo de texto. Resolve `null` se cancelado. */
  prompt: (opts: Omit<PromptRequest, 'resolve'>) => Promise<string | null>;
  closeConfirm: (ok: boolean) => void;
  closePrompt: (value: string | null) => void;
};

export const useFeedbackStore = create<FeedbackState>()((set, get) => ({
  toasts: [],
  confirmRequest: null,
  promptRequest: null,

  notify: (kind, message) => {
    const id = uid();
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }));
    setTimeout(() => get().dismiss(id), 3500);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  confirm: (opts) => new Promise((resolve) => set({ confirmRequest: { ...opts, resolve } })),
  prompt: (opts) => new Promise((resolve) => set({ promptRequest: { ...opts, resolve } })),

  closeConfirm: (ok) => {
    get().confirmRequest?.resolve(ok);
    set({ confirmRequest: null });
  },
  closePrompt: (value) => {
    get().promptRequest?.resolve(value);
    set({ promptRequest: null });
  },
}));

export const notify = (kind: ToastKind, message: string) => useFeedbackStore.getState().notify(kind, message);
export const confirmDialog = (opts: Omit<ConfirmRequest, 'resolve'>) => useFeedbackStore.getState().confirm(opts);
export const promptDialog = (opts: Omit<PromptRequest, 'resolve'>) => useFeedbackStore.getState().prompt(opts);
