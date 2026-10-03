import { useMemo } from 'react';
import { useActiveCollection } from '@/store/collectionStore';
import { useUiStore } from '@/store/uiStore';
import { findPath } from '@/lib/tree';
import type { NodePath } from '@/types/collection';

/** Caminho (raiz → nó) do item selecionado. Se nada estiver selecionado, aponta para a collection. */
export function useSelectedPath(): NodePath | null {
  const collection = useActiveCollection();
  const selectedId = useUiStore((s) => s.selectedId);
  return useMemo(() => {
    if (!collection) return null;
    return (selectedId && findPath(collection, selectedId)) || [{ kind: 'collection', node: collection }];
  }, [collection, selectedId]);
}
