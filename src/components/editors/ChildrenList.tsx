import { Plus } from 'lucide-react';
import { CHILD_KIND, KIND_LABEL, type NodeRef } from '@/types/collection';
import { childrenOf } from '@/lib/tree';
import { useUiStore } from '@/store/uiStore';
import { useNodeActions } from '@/hooks/useNodeActions';
import { Button } from '@/components/ui/primitives';
import { NodeIcon } from '@/components/ui/NodeIcon';

const subtitle = (ref: NodeRef): string => {
  if (ref.kind === 'request') return ref.node.url;
  return ref.node.description;
};

/** Lista navegável dos filhos diretos do nó selecionado. */
export function ChildrenList({ refNode }: { refNode: NodeRef }) {
  const select = useUiStore((s) => s.select);
  const { add } = useNodeActions();
  const childKind = CHILD_KIND[refNode.kind];
  const children = childrenOf(refNode);
  if (!childKind) return null;

  return (
    <div className="flex flex-col gap-2">
      {children.length === 0 ? (
        <p className="py-3 text-sm text-muted">Nenhum(a) {KIND_LABEL[childKind].toLowerCase()} ainda.</p>
      ) : (
        <ul className="divide-y divide-line rounded-md border border-line">
          {children.map((child) => (
            <li key={child.node.id}>
              <button
                type="button"
                onClick={() => select(child.node.id)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-panel-2"
              >
                <NodeIcon refNode={child} />
                <span className="font-medium">{child.node.name}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted">{subtitle(child)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div>
        <Button size="sm" icon={<Plus size={14} />} onClick={() => add(refNode.node.id)}>
          Adicionar {KIND_LABEL[childKind]}
        </Button>
      </div>
    </div>
  );
}
