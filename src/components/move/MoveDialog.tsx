import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { CHILD_KIND, KIND_LABEL, type NodeRef } from '@/types/collection';
import { useActiveCollection } from '@/store/collectionStore';
import { useDialogStore } from '@/store/dialogStore';
import { useNodeActions } from '@/hooks/useNodeActions';
import { childrenOf, findPath } from '@/lib/tree';
import { Input } from '@/components/ui/primitives';
import { NodeIcon } from '@/components/ui/NodeIcon';
import { LargeDialog } from '@/components/ui/LargeDialog';

/** Escolha do novo pai para o item (útil para distâncias longas ou sem mouse). */
export function MoveDialog() {
  const nodeId = useDialogStore((s) => s.move);
  if (!nodeId) return null;
  return <MoveContent nodeId={nodeId} />;
}

function MoveContent({ nodeId }: { nodeId: string }) {
  const collection = useActiveCollection();
  const close = () => useDialogStore.getState().setMove(null);
  const { move } = useNodeActions();
  const [query, setQuery] = useState('');

  const path = collection ? findPath(collection, nodeId) : null;
  const ref = path?.at(-1);
  const currentParentId = path?.at(-2)?.node.id;

  const destinations = useMemo(() => {
    if (!collection || !ref) return [];
    const out: { ref: NodeRef; trail: string }[] = [];
    const q = query.trim().toLowerCase();
    const recurse = (r: NodeRef, trail: string[]) => {
      const own = r.kind === 'collection' ? [] : [...trail, r.node.name];
      if (CHILD_KIND[r.kind] === ref.kind) {
        const text = own.join(' › ') || r.node.name;
        if (!q || text.toLowerCase().includes(q)) out.push({ ref: r, trail: text });
        return;
      }
      childrenOf(r).forEach((k) => recurse(k, own));
    };
    recurse({ kind: 'collection', node: collection }, []);
    return out;
  }, [collection, ref, query]);

  if (!collection || !ref) return null;

  return (
    <LargeDialog title={`Mover ${KIND_LABEL[ref.kind]} "${ref.node.name}"`} subtitle="Escolha o destino. O item vai para o fim da lista do destino." onClose={close}>
      <div className="flex flex-col gap-3 p-5">
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-muted" />
          <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filtrar destinos" className="pl-7" />
        </div>
        {ref.kind === 'testId' && (
          <p className="text-xs text-muted">Em outro cenário, o ID recebe o código e o próximo número livre do destino.</p>
        )}
        <ul className="divide-y divide-line rounded-md border border-line">
          {destinations.map((d) => {
            const isCurrent = d.ref.node.id === currentParentId;
            return (
              <li key={d.ref.node.id}>
                <button
                  type="button"
                  disabled={isCurrent}
                  onClick={() => move(nodeId, d.ref.node.id) && close()}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-panel-2 disabled:cursor-default disabled:opacity-50"
                >
                  <NodeIcon refNode={d.ref} />
                  <span className="min-w-0 flex-1 truncate">{d.trail}</span>
                  {isCurrent && <span className="text-xs text-muted">atual</span>}
                </button>
              </li>
            );
          })}
          {!destinations.length && <li className="px-3 py-3 text-sm text-muted">Nenhum destino encontrado.</li>}
        </ul>
      </div>
    </LargeDialog>
  );
}
