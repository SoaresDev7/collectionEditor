import {
  CHILD_KIND,
  type AnyNode,
  type Collection,
  type NodeKind,
  type NodePath,
  type NodeRef,
} from '@/types/collection';

/** Filhos diretos de um nó, já tipados como NodeRef. */
export function childrenOf(ref: NodeRef): NodeRef[] {
  switch (ref.kind) {
    case 'collection':
      return ref.node.folders.map((node) => ({ kind: 'folder', node }));
    case 'folder':
      return ref.node.scenarios.map((node) => ({ kind: 'scenario', node }));
    case 'scenario':
      return ref.node.testIds.map((node) => ({ kind: 'testId', node }));
    case 'testId':
      return ref.node.requests.map((node) => ({ kind: 'request', node }));
    case 'request':
      return [];
  }
}

/** Array mutável de filhos (útil dentro de producers do immer). */
export function childArray(ref: NodeRef): AnyNode[] | null {
  switch (ref.kind) {
    case 'collection':
      return ref.node.folders;
    case 'folder':
      return ref.node.scenarios;
    case 'scenario':
      return ref.node.testIds;
    case 'testId':
      return ref.node.requests;
    case 'request':
      return null;
  }
}

/** Caminho da collection até o nó com `id` (inclusive). `null` se não encontrado. */
export function findPath(collection: Collection, id: string): NodePath | null {
  const root: NodeRef = { kind: 'collection', node: collection };
  if (collection.id === id) return [root];

  const stack: NodePath = [root];
  const visit = (ref: NodeRef): boolean => {
    for (const child of childrenOf(ref)) {
      stack.push(child);
      if (child.node.id === id || visit(child)) return true;
      stack.pop();
    }
    return false;
  };
  return visit(root) ? [...stack] : null;
}

export function findNode(collection: Collection, id: string): NodeRef | null {
  const path = findPath(collection, id);
  return path ? path[path.length - 1] : null;
}

/** Percorre todos os nós em pré-ordem. */
export function walk(ref: NodeRef, fn: (ref: NodeRef, depth: number) => void, depth = 0): void {
  fn(ref, depth);
  for (const child of childrenOf(ref)) walk(child, fn, depth + 1);
}

export const childKindOf = (kind: NodeKind): NodeKind | null => CHILD_KIND[kind];

/** Ancestral mais próximo de um tipo específico dentro de um caminho. */
export function nearest<K extends NodeKind>(path: NodePath, kind: K): Extract<NodeRef, { kind: K }> | undefined {
  for (let i = path.length - 1; i >= 0; i--) {
    if (path[i].kind === kind) return path[i] as Extract<NodeRef, { kind: K }>;
  }
  return undefined;
}
