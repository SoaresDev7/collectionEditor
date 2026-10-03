import { create } from 'zustand';
import type { Collection } from '@/types/collection';

/**
 * Histórico de desfazer/refazer das collections (em memória, por sessão).
 *
 * Cada entrada guarda o estado anterior à ação. Graças ao compartilhamento
 * estrutural do immer, um snapshot só custa as partes que mudaram.
 * Edições seguidas do mesmo campo (digitação) viram uma entrada só.
 */

export type Snapshot = { collections: Collection[]; activeCollectionId: string | null };

type Entry = { label: string; state: Snapshot; key?: string; at: number };

const LIMIT = 200;
/** Edições do mesmo campo com intervalo menor que isto são agrupadas. */
const COALESCE_MS = 1500;

type HistoryState = {
  past: Entry[];
  future: Entry[];
  /** Registra o estado anterior a uma ação. */
  record: (label: string, before: Snapshot, key?: string) => void;
  /** Volta ao estado anterior; recebe o estado atual para permitir refazer. */
  undo: (current: Snapshot) => Entry | null;
  redo: (current: Snapshot) => Entry | null;
  clear: () => void;
};

export const useHistoryStore = create<HistoryState>()((set, get) => ({
  past: [],
  future: [],

  record: (label, before, key) => {
    const now = Date.now();
    const last = get().past.at(-1);
    if (key && last?.key === key && now - last.at < COALESCE_MS) {
      // Mesma edição em andamento: mantém o estado anterior ao início dela.
      set((s) => ({ past: [...s.past.slice(0, -1), { ...last, at: now }], future: [] }));
      return;
    }
    set((s) => ({ past: [...s.past, { label, state: before, key, at: now }].slice(-LIMIT), future: [] }));
  },

  undo: (current) => {
    const entry = get().past.at(-1);
    if (!entry) return null;
    set((s) => ({ past: s.past.slice(0, -1), future: [...s.future, { ...entry, state: current, key: undefined }] }));
    return entry;
  },

  redo: (current) => {
    const entry = get().future.at(-1);
    if (!entry) return null;
    set((s) => ({ future: s.future.slice(0, -1), past: [...s.past, { ...entry, state: current, key: undefined }] }));
    return entry;
  },

  clear: () => set({ past: [], future: [] }),
}));
