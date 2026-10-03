import { del, get, set } from 'idb-keyval';
import type { PersistStorage, StorageValue } from 'zustand/middleware';
import { notify } from '@/store/feedbackStore';

/**
 * Armazenamento das collections no IndexedDB do navegador.
 *
 * - Capacidade de centenas de MB (o localStorage aceita ~5 MB).
 * - Grava objetos diretamente (sem JSON.stringify) e com atraso: várias
 *   edições seguidas viram uma gravação só; a gravação pendente é feita ao
 *   esconder/fechar a aba.
 * - Na primeira leitura, migra dados antigos que estavam no localStorage.
 */

const DELAY_MS = 600;
const pending = new Map<string, { value: unknown; timer: ReturnType<typeof setTimeout> }>();

async function write(name: string, value: unknown) {
  try {
    await set(name, value);
  } catch (e) {
    console.error(e);
    notify('error', 'Não foi possível salvar no navegador (armazenamento cheio ou bloqueado). Exporte a collection para não perder alterações.');
  }
}

function flush() {
  for (const [name, { value, timer }] of pending) {
    clearTimeout(timer);
    void write(name, value);
  }
  pending.clear();
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
}

export function indexedDbStorage<S>(): PersistStorage<S> {
  return {
    async getItem(name) {
      const stored = await get<StorageValue<S>>(name);
      if (stored !== undefined) return stored;
      // Migração: versões anteriores salvavam no localStorage.
      const legacy = localStorage.getItem(name);
      if (!legacy) return null;
      const value = JSON.parse(legacy) as StorageValue<S>;
      await set(name, value);
      localStorage.removeItem(name);
      return value;
    },
    setItem(name, value) {
      const prev = pending.get(name);
      if (prev) clearTimeout(prev.timer);
      const timer = setTimeout(() => {
        pending.delete(name);
        void write(name, value);
      }, DELAY_MS);
      pending.set(name, { value, timer });
    },
    async removeItem(name) {
      pending.delete(name);
      await del(name);
    },
  };
}

/** Uso aproximado/disponível do armazenamento do navegador (quando suportado). */
export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usage, quota };
}
