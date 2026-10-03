import type { Collection, NodeKind, NodeRef } from '@/types/collection';
import { childrenOf } from '@/lib/tree';

export type TreeRow = {
  ref: NodeRef;
  depth: number;
  parentId: string | null;
  hasChildren: boolean;
  expanded: boolean;
  /** Corresponde ao filtro de busca (para destacar). */
  match: boolean;
};

const searchableText = (ref: NodeRef): string =>
  ref.kind === 'request' ? `${ref.node.name} ${ref.node.method} ${ref.node.url}` : ref.node.name;

/**
 * Achata a árvore nas linhas visíveis. Com filtro ativo, mostra apenas nós que
 * correspondem e seus ancestrais (expandidos automaticamente).
 */
export function flattenTree(collection: Collection, expanded: Record<string, boolean>, filter: string): TreeRow[] {
  const rows: TreeRow[] = [];
  const q = filter.trim().toLowerCase();
  const root: NodeRef = { kind: 'collection', node: collection };

  if (!q) {
    const visit = (ref: NodeRef, depth: number, parentId: string | null) => {
      const children = childrenOf(ref);
      const isOpen = ref.kind === 'collection' || !!expanded[ref.node.id];
      rows.push({ ref, depth, parentId, hasChildren: children.length > 0, expanded: isOpen, match: false });
      if (isOpen) for (const c of children) visit(c, depth + 1, ref.node.id);
    };
    visit(root, 0, null);
    return rows;
  }

  // Com filtro: primeiro decide quais nós ficam visíveis.
  const visible = new Set<string>();
  const matches = new Set<string>();
  const mark = (ref: NodeRef): boolean => {
    const self = searchableText(ref).toLowerCase().includes(q);
    let anyChild = false;
    for (const c of childrenOf(ref)) if (mark(c)) anyChild = true;
    if (self) matches.add(ref.node.id);
    if (self || anyChild) visible.add(ref.node.id);
    return self || anyChild;
  };
  mark(root);
  visible.add(collection.id);

  const visit = (ref: NodeRef, depth: number, parentId: string | null) => {
    const children = childrenOf(ref).filter((c) => visible.has(c.node.id));
    rows.push({
      ref,
      depth,
      parentId,
      hasChildren: children.length > 0,
      expanded: true,
      match: matches.has(ref.node.id),
    });
    for (const c of children) visit(c, depth + 1, ref.node.id);
  };
  visit(root, 0, null);
  return rows;
}

/** Todos os ids de nós que têm filhos (para "expandir tudo"). */
export function expandableIds(collection: Collection, upTo: NodeKind = 'testId'): string[] {
  const order: NodeKind[] = ['collection', 'folder', 'scenario', 'testId', 'request'];
  const limit = order.indexOf(upTo);
  const ids: string[] = [];
  const visit = (ref: NodeRef) => {
    if (order.indexOf(ref.kind) > limit) return;
    const children = childrenOf(ref);
    if (children.length) ids.push(ref.node.id);
    children.forEach(visit);
  };
  visit({ kind: 'collection', node: collection });
  return ids;
}
