import { Copy, CopyPlus, PencilRuler, Plus, Trash2 } from 'lucide-react';
import { CHILD_KIND, KIND_LABEL, type NodeRef } from '@/types/collection';
import { useNodeActions } from '@/hooks/useNodeActions';
import { useDialogStore } from '@/store/dialogStore';
import { walk } from '@/lib/tree';
import { Button } from '@/components/ui/primitives';
import { NodeIcon } from '@/components/ui/NodeIcon';

/** Título do item selecionado com as ações contextuais do nível. */
export function EditorHeader({ refNode }: { refNode: NodeRef }) {
  const actions = useNodeActions();
  const id = refNode.node.id;
  const childKind = CHILD_KIND[refNode.kind];
  const isRoot = refNode.kind === 'collection';

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <NodeIcon refNode={refNode} />
        <div className="min-w-0">
          <div className="text-[11px] font-medium tracking-wider text-muted uppercase">{KIND_LABEL[refNode.kind]}</div>
          <h1 className="truncate text-lg font-semibold">{refNode.node.name || 'sem nome'}</h1>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {childKind && (
          <Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => actions.add(id)}>
            {KIND_LABEL[childKind]}
          </Button>
        )}
        {refNode.kind === 'testId' && (
          <Button size="sm" icon={<CopyPlus size={14} />} onClick={() => actions.duplicateTestIdN(id)}>
            Duplicar N vezes
          </Button>
        )}
        {refNode.kind !== 'request' && (
          <Button
            size="sm"
            icon={<PencilRuler size={14} />}
            title="Editar campos do body nas requisições dos IDs selecionados"
            onClick={() => {
              const ids: string[] = [];
              walk(refNode, (r) => r.kind === 'testId' && ids.push(r.node.id));
              useDialogStore.getState().openBulkEdit(refNode.kind === 'collection' ? [] : ids);
            }}
          >
            Editar body em massa
          </Button>
        )}
        {!isRoot && (
          <Button size="sm" icon={<Copy size={14} />} onClick={() => actions.duplicate(id)} title="Ctrl+D">
            {refNode.kind === 'request' ? 'Duplicar' : `Copiar ${KIND_LABEL[refNode.kind]}`}
          </Button>
        )}
        {!isRoot && (
          <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} className="hover:text-danger" onClick={() => actions.remove(id)}>
            Excluir
          </Button>
        )}
      </div>
    </div>
  );
}
