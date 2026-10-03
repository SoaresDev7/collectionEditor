import { memo, useEffect, useRef, useState } from 'react';
import { ChevronRight, Copy, CopyPlus, Plus, Trash2 } from 'lucide-react';
import { CHILD_KIND, KIND_LABEL } from '@/types/collection';
import { IconButton, cx } from '@/components/ui/primitives';
import { NodeIcon } from '@/components/ui/NodeIcon';
import type { TreeRow } from './flattenTree';

export const ROW_HEIGHT = 28;

export type TreeRowActions = {
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onAdd: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDuplicateN: (id: string) => void;
  onDelete: (id: string) => void;
  onRenameStart: (id: string) => void;
  onRenameCommit: (id: string, name: string | null) => void;
  onDragStart: (id: string) => void;
  /** Retorna true se a linha aceita o item arrastado nesta posição. */
  onDragOverRow: (row: TreeRow, offsetRatio: number) => boolean;
  onDrop: () => void;
  onDragEnd: () => void;
};

type Props = {
  row: TreeRow;
  selected: boolean;
  renaming: boolean;
  top: number;
  actions: TreeRowActions;
  /** Indicador de soltura sobre esta linha. */
  drop?: 'before' | 'after' | 'inside';
};

const childCount = (row: TreeRow): number | null => {
  const n = row.ref.node;
  if ('folders' in n) return n.folders.length;
  if ('scenarios' in n) return n.scenarios.length;
  if ('testIds' in n) return n.testIds.length;
  if ('requests' in n) return n.requests.length;
  return null;
};

function RenameInput({ initial, onDone }: { initial: string; onDone: (value: string | null) => void }) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.select(), []);
  return (
    <input
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') onDone(value);
        if (e.key === 'Escape') onDone(null);
      }}
      onBlur={() => onDone(value)}
      className="h-6 min-w-0 flex-1 rounded border border-accent bg-panel px-1 text-sm outline-none"
    />
  );
}

export const TreeRowItem = memo(function TreeRowItem({ row, selected, renaming, top, actions, drop }: Props) {
  const { ref, depth, hasChildren, expanded, match } = row;
  const id = ref.node.id;
  const childKind = CHILD_KIND[ref.kind];
  const count = childCount(row);
  const isRoot = ref.kind === 'collection';

  return (
    <div
      role="treeitem"
      aria-selected={selected}
      aria-expanded={hasChildren ? expanded : undefined}
      aria-level={depth + 1}
      data-id={id}
      onClick={() => actions.onSelect(id)}
      onDoubleClick={() => !isRoot && actions.onRenameStart(id)}
      draggable={!isRoot && !renaming}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id);
        actions.onDragStart(id);
      }}
      onDragOver={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        if (actions.onDragOverRow(row, (e.clientY - rect.top) / rect.height)) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        actions.onDrop();
      }}
      onDragEnd={actions.onDragEnd}
      style={{ top, height: ROW_HEIGHT, paddingLeft: 6 + depth * 14 }}
      className={cx(
        'group absolute right-0 left-0 flex cursor-pointer items-center gap-1 pr-1 text-sm select-none',
        selected ? 'bg-accent-soft text-fg' : 'hover:bg-panel-2',
        drop === 'inside' && 'ring-2 ring-accent ring-inset',
        drop === 'before' && 'shadow-[inset_0_2px_0_var(--accent)]',
        drop === 'after' && 'shadow-[inset_0_-2px_0_var(--accent)]',
      )}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label={expanded ? 'Recolher' : 'Expandir'}
        onClick={(e) => {
          e.stopPropagation();
          if (hasChildren && !isRoot) actions.onToggle(id);
        }}
        className={cx('flex h-5 w-4 shrink-0 items-center justify-center text-muted', (!hasChildren || isRoot) && 'invisible')}
      >
        <ChevronRight size={13} className={cx('transition-transform', expanded && 'rotate-90')} />
      </button>

      <NodeIcon refNode={ref} open={expanded} />

      {renaming ? (
        <RenameInput initial={ref.node.name} onDone={(v) => actions.onRenameCommit(id, v)} />
      ) : (
        <span
          title={'synthetic' in ref.node && ref.node.synthetic ? 'Contêiner sintético: não existe como pasta no Postman' : undefined}
          className={cx(
            'min-w-0 flex-1 truncate',
            isRoot && 'font-semibold',
            match && 'font-semibold text-accent',
            'synthetic' in ref.node && ref.node.synthetic && 'text-muted italic',
          )}
        >
          {ref.node.name || <em className="text-muted">sem nome</em>}
        </span>
      )}

      {!renaming && count !== null && count > 0 && (
        <span className="text-[11px] text-muted group-hover:hidden">{count}</span>
      )}

      {!renaming && (
        <div className="hidden items-center group-hover:flex">
          {childKind && (
            <IconButton
              label={`Adicionar ${KIND_LABEL[childKind]}`}
              onClick={(e) => {
                e.stopPropagation();
                actions.onAdd(id);
              }}
            >
              <Plus size={14} />
            </IconButton>
          )}
          {ref.kind === 'testId' && (
            <IconButton
              label="Duplicar N vezes"
              onClick={(e) => {
                e.stopPropagation();
                actions.onDuplicateN(id);
              }}
            >
              <CopyPlus size={14} />
            </IconButton>
          )}
          {!isRoot && (
            <IconButton
              label={`Duplicar ${KIND_LABEL[ref.kind]}`}
              onClick={(e) => {
                e.stopPropagation();
                actions.onDuplicate(id);
              }}
            >
              <Copy size={13} />
            </IconButton>
          )}
          {!isRoot && (
            <IconButton
              label={`Excluir ${KIND_LABEL[ref.kind]}`}
              className="hover:text-danger"
              onClick={(e) => {
                e.stopPropagation();
                actions.onDelete(id);
              }}
            >
              <Trash2 size={13} />
            </IconButton>
          )}
        </div>
      )}
    </div>
  );
});
