import { useMemo } from 'react';
import { useCollectionStore } from '@/store/collectionStore';
import { useUiStore } from '@/store/uiStore';
import { confirmDialog, notify, promptDialog } from '@/store/feedbackStore';
import { downloadJson, exportFileName, toPostman } from '@/lib/postman/export';

const state = () => useCollectionStore.getState();
const active = () => state().collections.find((c) => c.id === state().activeCollectionId);

/** Ações de nível collection (criar, duplicar, excluir, exportar). */
export function useCollectionActions() {
  return useMemo(
    () => ({
      async create() {
        const name = await promptDialog({
          title: 'Nova collection',
          label: 'Nome',
          defaultValue: 'Nova collection',
          validate: (v) => (v.trim() ? null : 'Nome obrigatório.'),
        });
        if (name === null) return;
        const id = state().newCollection({ name: name.trim() });
        useUiStore.getState().select(id);
        notify('success', 'Collection criada.');
      },

      duplicate() {
        const c = active();
        if (!c) return;
        const id = state().duplicateCollection(c.id);
        if (id) {
          useUiStore.getState().select(id);
          notify('success', 'Collection duplicada.');
        }
      },

      async remove() {
        const c = active();
        if (!c) return;
        const ok = await confirmDialog({
          title: 'Excluir collection',
          message: `Excluir "${c.name}" com todos os seus itens? Exporte antes se quiser manter uma cópia.`,
          confirmLabel: 'Excluir',
          danger: true,
        });
        if (!ok) return;
        state().deleteCollection(c.id);
        useUiStore.getState().select(null);
        notify('success', 'Collection excluída.');
      },

      exportActive() {
        const c = active();
        if (!c) return;
        downloadJson(toPostman(c), exportFileName(c));
        notify('success', 'Collection exportada no formato Postman v2.1.');
      },
    }),
    [],
  );
}
