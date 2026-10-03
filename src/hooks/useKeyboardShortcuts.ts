import { useEffect } from 'react';
import { useUiStore } from '@/store/uiStore';
import { useCollectionStore } from '@/store/collectionStore';
import { useNodeActions } from './useNodeActions';
import { useCollectionActions } from './useCollectionActions';

export const SHORTCUTS: { keys: string; description: string }[] = [
  { keys: 'Ctrl+K', description: 'Buscar na árvore' },
  { keys: 'Alt+N', description: 'Adicionar filho ao item selecionado' },
  { keys: 'Ctrl+D', description: 'Duplicar item selecionado' },
  { keys: 'Ctrl+E', description: 'Exportar collection' },
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

      if (mod && key === 'k') return run(() => document.getElementById('tree-search')?.focus());
      if (mod && key === 'e') return run(collectionActions.exportActive);
      if (mod && key === 'b') return run(ui.toggleVariablesPanel);
      if (mod && e.shiftKey && key === 'l') return run(ui.toggleTheme);
      if (inField) return;
      if (mod && key === 'd' && selected) return run(() => nodeActions.duplicate(selected));
      if (e.altKey && key === 'n' && selected) return run(() => nodeActions.add(selected));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nodeActions, collectionActions]);
}
