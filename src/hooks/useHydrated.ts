import { useEffect, useState } from 'react';
import { useCollectionStore } from '@/store/collectionStore';
import { useBaselineStore } from '@/store/baselineStore';

const stores = [useCollectionStore, useBaselineStore];

/** true quando os dados salvos (IndexedDB, leitura assíncrona) já foram carregados. */
export function useHydrated(): boolean {
  const [ready, setReady] = useState(() => stores.every((s) => s.persist.hasHydrated()));
  useEffect(() => {
    if (ready) return;
    const check = () => stores.every((s) => s.persist.hasHydrated()) && setReady(true);
    const unsubs = stores.map((s) => s.persist.onFinishHydration(check));
    check();
    return () => unsubs.forEach((u) => u());
  }, [ready]);
  return ready;
}
