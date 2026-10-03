import { useEffect } from 'react';
import { useUiStore } from '@/store/uiStore';
import { useCollectionStore } from '@/store/collectionStore';
import { useDialogStore } from '@/store/dialogStore';
import { redo, undo } from '@/store/undo';
import { useNodeActions } from './useNodeActions';
import { useCollectionActions } from './useCollectionActions';

export const SHORTCUTS: { keys: string; description: string }[] = [
  { keys: 'Ctrl+Z', description: 'Desfazer' },
  { keys: 'Ctrl+Shift+Z / Ctrl+Y', description: 'Refazer' },
  { keys: 'Ctrl+K', description: 'Buscar na árvore' },
  { keys: 'Alt+N', description: 'Adicionar filho ao item selecionado' },
  { keys: 'Ctrl+D', description: 'Duplicar item selecionado' },
  { keys: 'Ctrl+E', description: 'Exportar collection' },
  { keys: 'Alt+R', description: 'Relatório de alterações' },
  { keys: 'Ctrl+Shift+F', description: 'Buscar usos (variáveis, funções, texto)' },
  { keys: 'Ctrl+O', description: 'Importar collection do Postman' },
  { keys: 'Alt+I', description: 'Renomear IDs em massa' },
  { keys: 'Alt+↑ / Alt+↓', description: 'Mover item na árvore' },
  { keys: 'Alt+M', description: 'Edição em massa do body' },
  { keys: 'Ctrl+B', description: 'Mostrar/ocultar painel de variáveis' },
  { keys: 'Ctrl+Shift+L', description: 'Alternar tema claro/escuro' },
];

/** Atalhos globais. Dentro do editor de código, só atalhos que não conflitam com o Monaco. */
export function useKeyboardShortcuts() {
  const nodeActions = useNodeActions();
  const collectionActions = useCollectionActions();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inCode = !!target?.closest('.monaco-editor');
      const inField = inCode || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '');
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const ui = useUiStore.getState();
      const selected = ui.selectedId ?? useCollectionStore.getState().activeCollectionId;

      const run = (fn: () => void) => {
        e.preventDefault();
        fn();
      };

      if (mod && e.shiftKey && key === 'f')
        return run(() => {
          ui.setSidebarTab('search');
          requestAnimationFrame(() => document.getElementById('usage-search')?.focus());
        });
      if (mod && key === 'k')
        return run(() => {
          ui.setSidebarTab('tree');
          requestAnimationFrame(() => document.getElementById('tree-search')?.focus());
        });
      if (mod && key === 'o') return run(() => useDialogStore.getState().setImporting(true));
      if (e.altKey && e.code === 'KeyI') return run(() => useDialogStore.getState().openRename());
      if (mod && key === 'e') return run(collectionActions.exportActive);
      if (mod && key === 'b') return run(ui.toggleVariablesPanel);
      if (e.altKey && e.code === 'KeyR') return run(() => useDialogStore.getState().setReport(true));
      if (e.altKey && e.code === 'KeyM') return run(() => useDialogStore.getState().openBulkEdit());
      if (mod && e.shiftKey && key === 'l') return run(ui.toggleTheme);
      if (inField) return; // campos e editor de código têm o próprio desfazer
      if (mod && key === 'z' && !e.shiftKey) return run(undo);
      if (mod && ((key === 'z' && e.shiftKey) || key === 'y')) return run(redo);
      if (mod && key === 'd' && selected) return run(() => nodeActions.duplicate(selected));
      if (e.altKey && e.code === 'KeyN' && selected) return run(() => nodeActions.add(selected));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nodeActions, collectionActions]);
}
