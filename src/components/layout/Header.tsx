import { Copy, Download, FileClock, FileText, Keyboard, Moon, PanelRight, PencilRuler, Plus, Sun, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useCollectionStore } from '@/store/collectionStore';
import { useUiStore } from '@/store/uiStore';
import { useDialogStore } from '@/store/dialogStore';
import { useCollectionActions } from '@/hooks/useCollectionActions';
import { SHORTCUTS } from '@/hooks/useKeyboardShortcuts';
import { Button, IconButton } from '@/components/ui/primitives';

export function Header() {
  const collections = useCollectionStore((s) => s.collections);
  const activeId = useCollectionStore((s) => s.activeCollectionId);
  const setActive = useCollectionStore((s) => s.setActiveCollection);
  const { theme, toggleTheme, toggleVariablesPanel, showVariablesPanel } = useUiStore();
  const actions = useCollectionActions();
  const [showKeys, setShowKeys] = useState(false);

  return (
    <header className="flex flex-wrap items-center gap-2 border-b border-line bg-panel px-3 py-2">
      <div className="mr-2 flex items-center gap-2 font-semibold">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-xs font-bold text-accent-fg">CE</span>
        <span className="hidden sm:inline">Collection Editor</span>
      </div>

      <select
        value={activeId ?? ''}
        onChange={(e) => {
          setActive(e.target.value);
          useUiStore.getState().select(null);
        }}
        aria-label="Collection ativa"
        className="h-8 max-w-64 min-w-40 rounded-md border border-line bg-panel px-2 text-sm"
      >
        {collections.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={actions.create}>
        Nova
      </Button>
      <Button size="sm" icon={<Copy size={14} />} onClick={actions.duplicate} disabled={!activeId}>
        Duplicar
      </Button>
      <IconButton label="Excluir collection" className="hover:text-danger" onClick={actions.remove}>
        <Trash2 size={15} />
      </IconButton>

      <div className="ml-auto flex flex-wrap items-center gap-1">
        <Button size="sm" variant="ghost" icon={<PencilRuler size={14} />} onClick={() => useDialogStore.getState().openBulkEdit()} title="Editar body em massa">
          <span className="hidden md:inline">Edição em massa</span>
        </Button>
        <Button size="sm" variant="ghost" icon={<FileText size={14} />} onClick={() => useDialogStore.getState().setTemplates(true)} title="Templates de documentação">
          <span className="hidden md:inline">Templates</span>
        </Button>
        <Button size="sm" icon={<FileClock size={14} />} onClick={() => useDialogStore.getState().setReport(true)} disabled={!activeId} title="Relatório de alterações (Alt+R)">
          Relatório
        </Button>
        <Button size="sm" icon={<Download size={14} />} onClick={actions.exportActive} disabled={!activeId} title="Ctrl+E">
          Exportar
        </Button>
        <div className="relative">
          <IconButton label="Atalhos de teclado" onClick={() => setShowKeys((v) => !v)}>
            <Keyboard size={16} />
          </IconButton>
          {showKeys && (
            <div
              className="absolute top-8 right-0 z-30 w-72 rounded-md border border-line bg-panel p-3 text-sm shadow-lg"
              onMouseLeave={() => setShowKeys(false)}
            >
              <h3 className="mb-2 font-semibold">Atalhos</h3>
              <ul className="flex flex-col gap-1">
                {SHORTCUTS.map((s) => (
                  <li key={s.keys} className="flex justify-between gap-3">
                    <span className="text-muted">{s.description}</span>
                    <kbd className="rounded border border-line bg-panel-2 px-1.5 font-mono text-xs">{s.keys}</kbd>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <IconButton label={theme === 'dark' ? 'Tema claro' : 'Tema escuro'} onClick={toggleTheme}>
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </IconButton>
        <IconButton
          label="Painel de variáveis (Ctrl+B)"
          onClick={toggleVariablesPanel}
          className={showVariablesPanel ? 'text-accent' : undefined}
        >
          <PanelRight size={16} />
        </IconButton>
      </div>
    </header>
  );
}
