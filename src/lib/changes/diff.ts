import { KIND_LABEL, type Collection, type Header, type NodeKind, type NodeRef, type Variable } from '@/types/collection';
import { childrenOf } from '@/lib/tree';
import { diffJson, type JsonChange } from '@/lib/json/diff';
import { displayValue, parseLoose } from '@/lib/json/loose';

/**
 * Compara duas versões da mesma collection (casando os nós pelo id) e
 * descreve o que foi adicionado, removido e modificado.
 */

/** ID de teste ao qual uma alteração pertence. */
export type Owner = { id: string; name: string; location: string };

export type NodeChange = {
  nodeId: string;
  kind: NodeKind;
  name: string;
  /** Caminho legível "Folder › Cenário › ID" (sem a collection). */
  location: string;
  details: string[];
  /** ID de teste dono do item (o próprio, se for um ID). */
  owner?: Owner;
};

export type AddedOrRemoved = NodeChange & {
  contents: string;
  /** Nomes dos IDs de teste contidos (inclui o próprio, se for um ID). */
  testIds: string[];
};

export type BodyChange = {
  requestId: string;
  label: string;
  location: string;
  /** Descrição completa (usada quando a alteração aparece isolada). */
  description: string;
  /** Descrição sem o valor anterior, usada para agrupar a mesma alteração em várias requisições. */
  groupDescription: string;
  /** Complemento por requisição dentro do grupo (ex.: valor anterior). */
  groupDetail?: string;
  owner?: Owner;
};

export type CollectionDiff = {
  added: AddedOrRemoved[];
  removed: AddedOrRemoved[];
  modified: NodeChange[];
  /** Alterações de campos do body, uma por requisição × campo. */
  bodyChanges: BodyChange[];
};

type Indexed = { ref: NodeRef; parentId: string | null; trail: string[]; owner?: Owner };

function index(collection: Collection): Map<string, Indexed> {
  const map = new Map<string, Indexed>();
  const visit = (ref: NodeRef, parentId: string | null, trail: string[], owner?: Owner) => {
    const own = ref.kind === 'collection' ? [] : [...trail, ref.node.name];
    const self = ref.kind === 'testId' ? { id: ref.node.id, name: ref.node.name, location: trail.join(' › ') } : owner;
    map.set(ref.node.id, { ref, parentId, trail: own, owner: self });
    for (const c of childrenOf(ref)) visit(c, ref.node.id, own, self);
  };
  visit({ kind: 'collection', node: collection }, null, []);
  return map;
}

function containedTestIds(ref: NodeRef): string[] {
  const out: string[] = [];
  const visit = (r: NodeRef) => {
    if (r.kind === 'testId') out.push(r.node.name);
    else childrenOf(r).forEach(visit);
  };
  visit(ref);
  return out;
}

const PLURAL: Record<NodeKind, string> = {
  collection: 'collections',
  folder: 'folders',
  scenario: 'cenários',
  testId: 'IDs',
  request: 'requisições',
};

function contentsSummary(ref: NodeRef): string {
  const count: Partial<Record<NodeKind, number>> = {};
  const visit = (r: NodeRef) =>
    childrenOf(r).forEach((c) => {
      count[c.kind] = (count[c.kind] ?? 0) + 1;
      visit(c);
    });
  visit(ref);
  return (Object.entries(count) as [NodeKind, number][]).map(([k, n]) => `${n} ${n === 1 ? KIND_LABEL[k].toLowerCase() : PLURAL[k]}`).join(', ');
}

const code = (s: string) => `\`${s.length > 80 ? `${s.slice(0, 79)}…` : s}\``;

function lineDelta(a: string, b: string): string {
  const count = (lines: string[]) => lines.reduce((m, l) => m.set(l, (m.get(l) ?? 0) + 1), new Map<string, number>());
  const ca = count(a.split('\n'));
  const cb = count(b.split('\n'));
  let added = 0;
  let removed = 0;
  for (const [l, n] of cb) added += Math.max(0, n - (ca.get(l) ?? 0));
  for (const [l, n] of ca) removed += Math.max(0, n - (cb.get(l) ?? 0));
  return `+${added} −${removed} linhas`;
}

function diffVariables(a: Variable[], b: Variable[]): string[] {
  const out: string[] = [];
  const ma = new Map(a.filter((v) => v.key).map((v) => [v.key, v]));
  const mb = new Map(b.filter((v) => v.key).map((v) => [v.key, v]));
  for (const [k, v] of mb) {
    const old = ma.get(k);
    if (!old) out.push(`Variável ${code(k)} adicionada (= ${code(v.value)})`);
    else if (old.value !== v.value) out.push(`Variável ${code(k)}: ${code(old.value)} → ${code(v.value)}`);
    else if (old.type !== v.type) out.push(`Variável ${code(k)}: tipo ${old.type} → ${v.type}`);
  }
  for (const k of ma.keys()) if (!mb.has(k)) out.push(`Variável ${code(k)} removida`);
  return out;
}

function diffHeaders(a: Header[], b: Header[]): string[] {
  const out: string[] = [];
  const key = (h: Header) => h.key.toLowerCase();
  const ma = new Map(a.filter((h) => h.key).map((h) => [key(h), h]));
  const mb = new Map(b.filter((h) => h.key).map((h) => [key(h), h]));
  for (const [k, h] of mb) {
    const old = ma.get(k);
    if (!old) out.push(`Header ${code(h.key)} adicionado (= ${code(h.value)})`);
    else {
      if (old.value !== h.value) out.push(`Header ${code(h.key)}: ${code(old.value)} → ${code(h.value)}`);
      if (old.enabled !== h.enabled) out.push(`Header ${code(h.key)} ${h.enabled ? 'ativado' : 'desativado'}`);
    }
  }
  for (const [k, h] of ma) if (!mb.has(k)) out.push(`Header ${code(h.key)} removido`);
  return out;
}

/** Versão agrupável: para "changed" omite o valor anterior, que vai em `detail`. */
export function groupableJsonChange(c: JsonChange): { description: string; detail?: string } {
  if (c.type === 'changed')
    return { description: `campo ${code(c.path)} alterado para ${code(displayValue(c.to))}`, detail: `antes: ${code(displayValue(c.from))}` };
  return { description: describeJsonChange(c) };
}

export function describeJsonChange(c: JsonChange): string {
  switch (c.type) {
    case 'added':
      return `campo ${code(c.path)} adicionado (= ${code(displayValue(c.value))})`;
    case 'removed':
      return `campo ${code(c.path)} removido`;
    case 'changed':
      return `campo ${code(c.path)}: ${code(displayValue(c.from))} → ${code(displayValue(c.to))}`;
    case 'renamed':
      return `campo ${code(c.path)} renomeado para ${code(c.to)}`;
  }
}

export function diffCollections(base: Collection, current: Collection): CollectionDiff {
  const a = index(base);
  const b = index(current);
  const result: CollectionDiff = { added: [], removed: [], modified: [], bodyChanges: [] };
  const where = (trail: string[]) => trail.join(' › ') || current.name;

  for (const [id, item] of b) {
    if (a.has(id) || (item.parentId && !a.has(item.parentId))) continue;
    result.added.push({
      nodeId: id,
      kind: item.ref.kind,
      name: item.ref.node.name,
      location: where(item.trail.slice(0, -1)),
      details: [],
      contents: contentsSummary(item.ref),
      testIds: containedTestIds(item.ref),
      owner: item.owner,
    });
  }
  for (const [id, item] of a) {
    if (b.has(id) || (item.parentId && !b.has(item.parentId))) continue;
    result.removed.push({
      nodeId: id,
      kind: item.ref.kind,
      name: item.ref.node.name,
      location: where(item.trail.slice(0, -1)),
      details: [],
      contents: contentsSummary(item.ref),
      testIds: containedTestIds(item.ref),
      owner: item.owner,
    });
  }

  for (const [id, now] of b) {
    const before = a.get(id);
    if (!before) continue;
    const x = before.ref;
    const y = now.ref;
    const details: string[] = [];

    if (x.node.name !== y.node.name) details.push(`Renomeado: ${code(x.node.name)} → ${code(y.node.name)}`);
    if (x.kind !== 'collection' && before.parentId !== now.parentId)
      details.push(`Movido de ${code(where(before.trail.slice(0, -1)))} para ${code(where(now.trail.slice(0, -1)))}`);
    if ('description' in x.node && 'description' in y.node && x.node.description !== y.node.description)
      details.push(x.node.description ? 'Descrição alterada' : 'Descrição adicionada');
    if (x.node.preRequestScripts !== y.node.preRequestScripts)
      details.push(`Script pré-request alterado (${lineDelta(x.node.preRequestScripts, y.node.preRequestScripts)})`);
    if (x.node.postRequestScripts !== y.node.postRequestScripts)
      details.push(`Script pós-request alterado (${lineDelta(x.node.postRequestScripts, y.node.postRequestScripts)})`);
    if ('variables' in x.node && 'variables' in y.node) details.push(...diffVariables(x.node.variables, y.node.variables));
    if (x.kind === 'scenario' && y.kind === 'scenario' && x.node.idCode !== y.node.idCode)
      details.push(`Código dos IDs: ${code(x.node.idCode)} → ${code(y.node.idCode)}`);

    if (x.kind === 'request' && y.kind === 'request') {
      if (x.node.method !== y.node.method) details.push(`Método: ${x.node.method} → ${y.node.method}`);
      if (x.node.url !== y.node.url) details.push(`URL: ${code(x.node.url)} → ${code(y.node.url)}`);
      details.push(...diffHeaders(x.node.headers, y.node.headers));
      if (x.node.body !== y.node.body) {
        const pa = x.node.body.trim() ? parseLoose(x.node.body) : { ok: true as const, value: null };
        const pb = y.node.body.trim() ? parseLoose(y.node.body) : { ok: true as const, value: null };
        if (pa.ok && pb.ok) {
          const changes = diffJson(pa.value, pb.value);
          const label = `${now.trail.at(-2) ?? ''} › ${y.node.name}`;
          for (const c of changes) {
            const g = groupableJsonChange(c);
            result.bodyChanges.push({
              requestId: id,
              label,
              location: where(now.trail),
              description: describeJsonChange(c),
              groupDescription: g.description,
              groupDetail: g.detail,
              owner: now.owner,
            });
          }
        } else details.push('Body alterado');
      }
    }

    if (details.length)
      result.modified.push({ nodeId: id, kind: y.kind, name: y.node.name, location: where(now.trail), details, owner: now.owner });
  }
  return result;
}

export const hasChanges = (d: CollectionDiff) =>
  d.added.length + d.removed.length + d.modified.length + d.bodyChanges.length > 0;
