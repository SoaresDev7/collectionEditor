import { useCallback, useMemo } from 'react';
import { useCollectionStore } from '@/store/collectionStore';
import { useUiStore } from '@/store/uiStore';
import { confirmDialog, notify, promptDialog } from '@/store/feedbackStore';
import { childrenOf, findPath } from '@/lib/tree';
import { KIND_LABEL, type NodeRef } from '@/types/collection';

const countDescendants = (ref: NodeRef): number =>
  childrenOf(ref).reduce((sum, child) => sum + 1 + countDescendants(child), 0);

const activeCollection = () => {
  const s = useCollectionStore.getState();
  return s.collections.find((c) => c.id === s.activeCollectionId);
};

/** Ações sobre nós da árvore com confirmação, notificação e ajuste de seleção/expansão. */
export function useNodeActions() {
  const store = useCollectionStore;
  const ui = useUiStore;

  const add = useCallback((parentId: string) => {
    const id = store.getState().addChild(parentId);
    if (id) {
      ui.getState().setExpanded([parentId], true);
      ui.getState().select(id);
    }
    return id;
  }, [store, ui]);

  const duplicate = useCallback((id: string) => {
    const newId = store.getState().duplicateNode(id);
    if (newId) {
      ui.getState().select(newId);
      notify('success', 'Item duplicado.');
    }
    return newId;
  }, [store, ui]);

  const duplicateTestIdN = useCallback(async (id: string) => {
    const raw = await promptDialog({
      title: 'Duplicar ID N vezes',
      label: 'Quantidade de cópias',
      defaultValue: '9',
      inputType: 'number',
      validate: (v) => (/^\d+$/.test(v) && +v >= 1 && +v <= 500 ? null : 'Informe um número entre 1 e 500.'),
    });
    if (raw === null) return;
    const ids = store.getState().duplicateTestIdN(id, Number(raw));
    if (ids.length) notify('success', `${ids.length} ID(s) gerado(s).`);
  }, [store]);

  const remove = useCallback(async (id: string) => {
    const collection = activeCollection();
    const path = collection && findPath(collection, id);
    if (!path || path.length < 2) return;
    const ref = path[path.length - 1];
    const children = countDescendants(ref);
    const ok = await confirmDialog({
      title: `Excluir ${KIND_LABEL[ref.kind]}`,
      message: `Excluir "${ref.node.name}"${children ? ` e ${children} item(ns) dentro dele` : ''}? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    store.getState().deleteNode(id);
    if (ui.getState().selectedId === id) ui.getState().select(path[path.length - 2].node.id);
    notify('success', `${KIND_LABEL[ref.kind]} excluído.`);
  }, [store, ui]);

  return useMemo(() => ({ add, duplicate, duplicateTestIdN, remove }), [add, duplicate, duplicateTestIdN, remove]);
}
