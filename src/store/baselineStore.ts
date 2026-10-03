import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Collection } from '@/types/collection';
import { nowIso } from '@/lib/ids';

export type Baseline = { snapshot: Collection; takenAt: string };

type BaselineState = {
  /** Estado de referência por collection; o relatório compara o estado atual com ele. */
  baselines: Record<string, Baseline>;
  setBaseline: (collection: Collection) => void;
  removeBaseline: (collectionId: string) => void;
};

export const useBaselineStore = create<BaselineState>()(
  persist(
    (set) => ({
      baselines: {},
      setBaseline: (collection) =>
        set((s) => ({
          baselines: { ...s.baselines, [collection.id]: { snapshot: structuredClone(collection), takenAt: nowIso() } },
        })),
      removeBaseline: (collectionId) =>
        set((s) => {
          const { [collectionId]: _removed, ...rest } = s.baselines;
          return { baselines: rest };
        }),
    }),
    { name: 'collection-editor:baselines', version: 1 },
  ),
);
