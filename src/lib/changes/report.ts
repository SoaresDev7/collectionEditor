import { KIND_LABEL, type NodeKind } from '@/types/collection';
import type { BodyChange, CollectionDiff, NodeChange } from './diff';

/** Agrupa alterações de body idênticas em várias requisições (típico de edição em massa). */
export function groupBodyChanges(changes: BodyChange[]) {
  const groups = new Map<string, BodyChange[]>();
  for (const c of changes) groups.set(c.groupDescription, [...(groups.get(c.groupDescription) ?? []), c]);
  const batch = [...groups.entries()].filter(([, list]) => list.length > 1).map(([description, list]) => ({ description, list }));
  const batched = new Set(batch.flatMap((g) => g.list));
  const single = new Map<string, BodyChange[]>();
  for (const c of changes) if (!batched.has(c)) single.set(c.requestId, [...(single.get(c.requestId) ?? []), c]);
  return { batch, single };
}

/** Lista de "modificados" incluindo as alterações de body que não entraram em lote. */
function modifiedWithBody(diff: CollectionDiff, single: Map<string, BodyChange[]>): NodeChange[] {
  const list = diff.modified.map((m) => ({ ...m, details: [...m.details] }));
  for (const [requestId, changes] of single) {
    const lines = changes.map((c) => `Body: ${c.description}`);
    const existing = list.find((m) => m.nodeId === requestId);
    if (existing) existing.details.push(...lines);
    else list.push({ nodeId: requestId, kind: 'request', name: changes[0].label, location: changes[0].location, details: lines });
  }
  return list;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const NOUN: Record<NodeKind, [string, string]> = {
  collection: ['collection', 'collections'],
  folder: ['folder', 'folders'],
  scenario: ['cenário', 'cenários'],
  testId: ['ID', 'IDs'],
  request: ['requisição', 'requisições'],
};

function countByKind(items: { kind: NodeKind }[]): string {
  const counts = new Map<NodeKind, number>();
  for (const i of items) counts.set(i.kind, (counts.get(i.kind) ?? 0) + 1);
  return [...counts].map(([k, n]) => plural(n, ...NOUN[k])).join(', ');
}

export type ReportMeta = { collectionName: string; baselineAt: string; generatedAt: string };

export function buildMarkdownReport(diff: CollectionDiff, meta: ReportMeta): string {
  const { batch, single } = groupBodyChanges(diff.bodyChanges);
  const modified = modifiedWithBody(diff, single);
  const changedRequests = new Set(diff.bodyChanges.map((c) => c.requestId));
  const out: string[] = [];

  out.push(`# Relatório de alterações — ${meta.collectionName}`, '');
  out.push(`_Base: ${new Date(meta.baselineAt).toLocaleString()} · Gerado em: ${new Date(meta.generatedAt).toLocaleString()}_`, '');

  if (!diff.added.length && !diff.removed.length && !modified.length && !batch.length) {
    out.push('Nenhuma alteração desde a base.');
    return out.join('\n');
  }

  out.push('## Resumo', '');
  if (diff.added.length) out.push(`- **Adicionados:** ${countByKind(diff.added)}`);
  if (diff.removed.length) out.push(`- **Removidos:** ${countByKind(diff.removed)}`);
  if (modified.length) out.push(`- **Modificados:** ${countByKind(modified)}`);
  if (batch.length)
    out.push(`- **Edições em lote no body:** ${plural(batch.length, 'alteração', 'alterações')} em ${plural(changedRequests.size, 'requisição', 'requisições')}`);
  out.push('');

  const addedOrRemoved = (title: string, list: CollectionDiff['added']) => {
    if (!list.length) return;
    out.push(`## ${title}`, '');
    for (const i of list)
      out.push(`- **${KIND_LABEL[i.kind]}** \`${i.name}\` em _${i.location}_${i.contents ? ` (${i.contents})` : ''}`);
    out.push('');
  };
  addedOrRemoved('Adicionados', diff.added);
  addedOrRemoved('Removidos', diff.removed);

  if (batch.length) {
    out.push('## Alterações em lote no body', '');
    for (const g of batch) {
      out.push(`- ${capitalize(g.description)} — ${plural(g.list.length, 'requisição', 'requisições')}:`);
      for (const c of g.list) out.push(`  - ${c.label}${c.groupDetail ? ` (${c.groupDetail})` : ''}`);
    }
    out.push('');
  }

  if (modified.length) {
    out.push('## Modificados', '');
    for (const m of modified) {
      out.push(`- **${KIND_LABEL[m.kind]}** _${m.location}_`);
      for (const d of m.details) out.push(`  - ${d}`);
    }
    out.push('');
  }
  return out.join('\n');
}

/** Mensagem de commit: título curto + lista objetiva. */
export function buildCommitMessage(diff: CollectionDiff, meta: ReportMeta): string {
  const { batch, single } = groupBodyChanges(diff.bodyChanges);
  const modified = modifiedWithBody(diff, single);
  const changedRequests = new Set([...diff.bodyChanges.map((c) => c.requestId), ...modified.filter((m) => m.kind === 'request').map((m) => m.nodeId)]);

  const parts: string[] = [];
  const addedIds = diff.added.filter((a) => a.kind === 'testId').length;
  if (addedIds) parts.push(`+${addedIds} ${addedIds === 1 ? 'ID' : 'IDs'}`);
  const removedIds = diff.removed.filter((a) => a.kind === 'testId').length;
  if (removedIds) parts.push(`-${removedIds} ${removedIds === 1 ? 'ID' : 'IDs'}`);
  if (changedRequests.size) parts.push(`${plural(changedRequests.size, 'requisição alterada', 'requisições alteradas')}`);
  const title = `test(postman): atualiza ${meta.collectionName}${parts.length ? ` (${parts.join(', ')})` : ''}`;

  const lines: string[] = [];
  for (const a of diff.added) lines.push(`- Adiciona ${NOUN[a.kind][0]} ${a.name} em ${a.location}`);
  for (const r of diff.removed) lines.push(`- Remove ${NOUN[r.kind][0]} ${r.name} de ${r.location}`);
  for (const g of batch) lines.push(`- Body: ${g.description} (${plural(g.list.length, 'requisição', 'requisições')})`);
  for (const m of modified) lines.push(`- ${m.location}: ${m.details.join('; ')}`);

  return [title, '', ...(lines.length ? lines : ['- Sem alterações estruturais'])].join('\n').replace(/`/g, '');
}
