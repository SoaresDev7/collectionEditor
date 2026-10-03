import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronsDownUp, ChevronsUpDown, FolderPlus, Search, X } from 'lucide-react';
import { useActiveCollection, useCollectionStore } from '@/store/collectionStore';
import { useUiStore } from '@/store/uiStore';
import { notify } from '@/store/feedbackStore';
import { useNodeActions } from '@/hooks/useNodeActions';
import { childArray, findPath } from '@/lib/tree';
import { isDuplicateName } from '@/lib/validation';
import { IconButton, Input } from '@/components/ui/primitives';
import { expandableIds, flattenTree } from './flattenTree';
import { ROW_HEIGHT, TreeRowItem, type TreeRowActions } from './TreeRowItem';

const OVERSCAN = 10;

export function Sidebar() {
  const collection = useActiveCollection();
  const { selectedId, expanded, treeFilter, sidebarScrollTop } = useUiStore();
  const { select, toggleExpanded, setExpanded, setTreeFilter, setSidebarScrollTop } = useUiStore.getState();
  const updateNode = useCollectionStore((s) => s.updateNode);
  const nodeActions = useNodeActions();
  const [renamingId, setRenamingId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(sidebarScrollTop);
  const [viewport, setViewport] = useState(600);

  const rows = useMemo(
    () => (collection ? flattenTree(collection, expanded, treeFilter) : []),
    [collection, expanded, treeFilter],
  );
  const selectedIndex = rows.findIndex((r) => r.ref.node.id === selectedId);

  /* Restaura a posição de scroll salva e acompanha o tamanho do painel. */
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = sidebarScrollTop;
    const ro = new ResizeObserver(() => setViewport(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setSidebarScrollTop(scrollTop), 300);
    return () => clearTimeout(t);
  }, [scrollTop, setSidebarScrollTop]);

  /* Garante que o item selecionado esteja visível (ex.: ao navegar pelo teclado). */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || selectedIndex < 0) return;
    const top = selectedIndex * ROW_HEIGHT;
    if (top < el.scrollTop) el.scrollTop = top;
    else if (top + ROW_HEIGHT > el.scrollTop + el.clientHeight) el.scrollTop = top + ROW_HEIGHT - el.clientHeight;
  }, [selectedIndex]);

  const commitRename = useCallback(
    (id: string, name: string | null) => {
      setRenamingId(null);
      const c = useCollectionStore.getState().collections.find((x) => x.id === collection?.id);
      if (name === null || !c) return;
      const trimmed = name.trim();
      const path = findPath(c, id);
      if (!path || !trimmed || trimmed === path[path.length - 1].node.name) return;
      const siblings = path.length > 1 ? childArray(path[path.length - 2]) ?? [] : [];
      if (isDuplicateName(trimmed, siblings, id)) {
        notify('error', `Já existe um item chamado "${trimmed}" neste nível.`);
        return;
      }
      updateNode(id, { name: trimmed });
    },
    [collection?.id, updateNode],
  );

  const actions: TreeRowActions = useMemo(
    () => ({
      onSelect: select,
      onToggle: toggleExpanded,
      onAdd: (id) => nodeActions.add(id),
      onDuplicate: (id) => nodeActions.duplicate(id),
      onDuplicateN: (id) => void nodeActions.duplicateTestIdN(id),
      onDelete: (id) => void nodeActions.remove(id),
      onRenameStart: setRenamingId,
      onRenameCommit: commitRename,
    }),
    [select, toggleExpanded, nodeActions, commitRename],
  );

  if (!collection) return null;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (renamingId) return;
    const row = rows[selectedIndex];
    const go = (i: number) => rows[i] && select(rows[i].ref.node.id);
    switch (e.key) {
      case 'ArrowDown':
        go(Math.min(rows.length - 1, selectedIndex + 1));
        break;
      case 'ArrowUp':
        go(Math.max(0, selectedIndex - 1));
        break;
      case 'ArrowRight':
        if (!row?.hasChildren) return;
        if (!row.expanded) toggleExpanded(row.ref.node.id);
        else go(selectedIndex + 1);
        break;
      case 'ArrowLeft':
        if (!row) return;
        if (row.hasChildren && row.expanded && row.ref.kind !== 'collection') toggleExpanded(row.ref.node.id);
        else if (row.parentId) select(row.parentId);
        break;
      case 'F2':
        if (row && row.ref.kind !== 'collection') setRenamingId(row.ref.node.id);
        break;
      case 'Delete':
        if (row) void nodeActions.remove(row.ref.node.id);
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const end = Math.min(rows.length, Math.ceil((scrollTop + viewport) / ROW_HEIGHT) + OVERSCAN);

  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-line bg-panel">
      <div className="flex items-center gap-1 border-b border-line p-2">
        <div className="relative flex-1">
          <Search size={14} className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-muted" />
          <Input
            id="tree-search"
            value={treeFilter}
            onChange={(e) => setTreeFilter(e.target.value)}
            placeholder="Buscar (Ctrl+K)"
            className="pr-7 pl-7"
          />
          {treeFilter && (
            <IconButton label="Limpar busca" className="absolute top-1/2 right-1 -translate-y-1/2" onClick={() => setTreeFilter('')}>
              <X size={13} />
            </IconButton>
          )}
        </div>
        <IconButton label="Expandir tudo" onClick={() => setExpanded(expandableIds(collection), true)}>
          <ChevronsUpDown size={15} />
        </IconButton>
        <IconButton label="Recolher tudo" onClick={() => setExpanded(expandableIds(collection), false)}>
          <ChevronsDownUp size={15} />
        </IconButton>
        <IconButton label="Adicionar folder" onClick={() => nodeActions.add(collection.id)}>
          <FolderPlus size={15} />
        </IconButton>
      </div>

      <div
        ref={scrollRef}
        role="tree"
        aria-label="Estrutura da collection"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        className="relative min-h-0 flex-1 overflow-y-auto py-1 focus:outline-none"
      >
        <div style={{ height: rows.length * ROW_HEIGHT, position: 'relative' }}>
          {rows.slice(start, end).map((row, i) => (
            <TreeRowItem
              key={row.ref.node.id}
              row={row}
              top={(start + i) * ROW_HEIGHT}
              selected={row.ref.node.id === selectedId || (!selectedId && row.ref.kind === 'collection')}
              renaming={renamingId === row.ref.node.id}
              actions={actions}
            />
          ))}
        </div>
        {treeFilter && rows.length <= 1 && <p className="px-3 py-4 text-sm text-muted">Nenhum item encontrado.</p>}
      </div>

      <div className="border-t border-line px-3 py-1.5 text-[11px] text-muted">
        ↑↓ navegar · ←→ recolher/expandir · F2 renomear · Del excluir
      </div>
    </aside>
  );
}
