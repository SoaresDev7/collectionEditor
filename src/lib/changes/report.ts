import { KIND_LABEL, type NodeKind } from '@/types/collection';
import type { AddedOrRemoved, BodyChange, CollectionDiff, NodeChange, Owner } from './diff';

/**
 * Relatório de alterações organizado pela identificação de cada item:
 * primeiro os IDs de teste (adicionados / modificados / excluídos, com o que
 * mudou em cada um), depois folders, cenários e a collection.
 */

export type ReportMeta = { collectionName: string; baselineAt: string; generatedAt: string };

export type TestIdStatus = 'adicionado' | 'modificado' | 'excluído';

export type TestIdEntry = {
  name: string;
  /** Nome anterior, se o ID foi renomeado. */
  previousName?: string;
  location: string;
  status: TestIdStatus;
  details: string[];
};

export type StructureEntry = {
  kind: NodeKind;
  name: string;
  location: string;
  status: TestIdStatus;
  details: string[];
  testIds: string[];
};

export type ReportModel = {
  testIds: TestIdEntry[];
  structure: StructureEntry[];
  /** Mesma alteração de body aplicada em várias requisições. */
  batches: { description: string; testIds: string[]; requests: number }[];
};

const NOUN: Record<NodeKind, [string, string]> = {
  collection: ['collection', 'collections'],
  folder: ['folder', 'folders'],
  scenario: ['cenário', 'cenários'],
  testId: ['ID', 'IDs'],
  request: ['requisição', 'requisições'],
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true });
const code = (s: string) => `\`${s}\``;

/** Agrupa as alterações por ID de teste e separa o que é estrutura (folder/cenário/collection). */
export function buildReportModel(diff: CollectionDiff): ReportModel {
  const ids = new Map<string, TestIdEntry>();
  const structure: StructureEntry[] = [];

  const entry = (owner: Owner, status: TestIdStatus): TestIdEntry => {
    let e = ids.get(owner.id);
    if (!e) {
      e = { name: owner.name, location: owner.location, status, details: [] };
      ids.set(owner.id, e);
    }
    return e;
  };

  const addOrRemove = (item: AddedOrRemoved, status: 'adicionado' | 'excluído') => {
    const verb = status === 'adicionado' ? 'adicionada' : 'excluída';
    if (item.kind === 'testId') {
      const e = entry(item.owner!, status);
      if (item.contents) e.details.push(capitalize(item.contents));
    } else if (item.kind === 'request' && item.owner) {
      entry(item.owner, 'modificado').details.push(`Requisição ${code(item.name)} ${verb}`);
    } else {
      structure.push({ kind: item.kind, name: item.name, location: item.location, status, details: [], testIds: item.testIds });
      // IDs dentro de um folder/cenário adicionado ou excluído também são listados.
      for (const name of item.testIds) {
        const key = `${status}:${item.nodeId}:${name}`;
        if (!ids.has(key))
          ids.set(key, {
            name,
            location: `${item.location} › ${item.name}`,
            status,
            details: [`${status === 'adicionado' ? 'Adicionado' : 'Excluído'} junto com o ${NOUN[item.kind][0]} ${code(item.name)}`],
          });
      }
    }
  };
  diff.added.forEach((i) => addOrRemove(i, 'adicionado'));
  diff.removed.forEach((i) => addOrRemove(i, 'excluído'));

  for (const m of diff.modified as NodeChange[]) {
    if (m.kind === 'testId' && m.owner) {
      const e = entry(m.owner, 'modificado');
      // O nome atual prevalece (uma requisição excluída registra o nome da base).
      e.name = m.owner.name;
      e.location = m.owner.location;
      const renamed = m.details.find((d) => d.startsWith('Renomeado:'));
      if (renamed) e.previousName = /`([^`]*)`/.exec(renamed)?.[1];
      e.details.push(...m.details);
    } else if (m.kind === 'request' && m.owner) {
      entry(m.owner, 'modificado').details.push(...m.details.map((d) => `Requisição ${code(m.name)}: ${d}`));
    } else {
      // A localização de um item modificado inclui o próprio nome; o relatório mostra só onde ele está.
      const parent = m.location.split(' › ').slice(0, -1).join(' › ');
      structure.push({ kind: m.kind, name: m.name, location: m.kind === 'collection' ? '' : parent, status: 'modificado', details: m.details, testIds: [] });
    }
  }

  for (const c of diff.bodyChanges as BodyChange[]) {
    if (!c.owner) continue;
    const requestName = c.label.split(' › ').pop() ?? c.label;
    entry(c.owner, 'modificado').details.push(`Requisição ${code(requestName)}: Body: ${c.description}`);
  }

  // Lotes: mesma alteração de body em mais de uma requisição.
  const groups = new Map<string, BodyChange[]>();
  for (const c of diff.bodyChanges) groups.set(c.groupDescription, [...(groups.get(c.groupDescription) ?? []), c]);
  const batches = [...groups.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([description, list]) => ({
      description,
      requests: list.length,
      testIds: [...new Set(list.map((c) => c.owner?.name ?? c.label))].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })),
    }));

  const order: Record<TestIdStatus, number> = { adicionado: 0, modificado: 1, excluído: 2 };
  return {
    testIds: [...ids.values()].sort((a, b) => order[a.status] - order[b.status] || byName(a, b)),
    structure: structure.sort((a, b) => order[a.status] - order[b.status] || byName(a, b)),
    batches,
  };
}

const namesOf = (list: TestIdEntry[]) => list.map((e) => code(e.name)).join(', ');

export function buildMarkdownReport(diff: CollectionDiff, meta: ReportMeta): string {
  const model = buildReportModel(diff);
  const out: string[] = [];
  out.push(`# Relatório de alterações — ${meta.collectionName}`, '');
  out.push(`_Base: ${new Date(meta.baselineAt).toLocaleString()} · Gerado em: ${new Date(meta.generatedAt).toLocaleString()}_`, '');

  if (!model.testIds.length && !model.structure.length) {
    out.push('Nenhuma alteração desde a base.');
    return out.join('\n');
  }

  const added = model.testIds.filter((e) => e.status === 'adicionado');
  const modified = model.testIds.filter((e) => e.status === 'modificado');
  const removed = model.testIds.filter((e) => e.status === 'excluído');

  out.push('## Resumo', '');
  if (added.length) out.push(`- **IDs adicionados (${added.length}):** ${namesOf(added)}`);
  if (modified.length) out.push(`- **IDs modificados (${modified.length}):** ${namesOf(modified)}`);
  if (removed.length) out.push(`- **IDs excluídos (${removed.length}):** ${namesOf(removed)}`);
  for (const status of ['adicionado', 'modificado', 'excluído'] as const) {
    const list = model.structure.filter((s) => s.status === status);
    if (list.length)
      out.push(`- **${capitalize(status === 'excluído' ? 'excluídos' : `${status}s`)} (estrutura):** ${list.map((s) => `${NOUN[s.kind][0]} ${code(s.name)}`).join(', ')}`);
  }
  out.push('');

  if (model.testIds.length) {
    out.push('## IDs de teste', '');
    for (const e of model.testIds) {
      out.push(`### ${e.name} — ${e.status}${e.previousName ? ` (antes: ${e.previousName})` : ''}`);
      if (e.location) out.push(`_${e.location}_`);
      out.push('');
      for (const d of e.details) out.push(`- ${d}`);
      out.push('');
    }
  }

  if (model.structure.length) {
    out.push('## Folders, cenários e collection', '');
    for (const s of model.structure) {
      out.push(`- **${KIND_LABEL[s.kind]}** ${code(s.name)} — ${s.status}${s.location ? ` em _${s.location}_` : ''}`);
      for (const d of s.details) out.push(`  - ${d}`);
      if (s.testIds.length) out.push(`  - IDs: ${s.testIds.map(code).join(', ')}`);
    }
    out.push('');
  }

  if (model.batches.length) {
    out.push('## Alterações em lote no body', '');
    for (const b of model.batches)
      out.push(`- ${capitalize(b.description)} — ${plural(b.requests, 'requisição', 'requisições')} em ${b.testIds.map(code).join(', ')}`);
    out.push('');
  }
  return out.join('\n');
}

/** Mensagem de commit: título curto + uma linha por ID/item alterado. */
export function buildCommitMessage(diff: CollectionDiff, meta: ReportMeta): string {
  const model = buildReportModel(diff);
  const count = (s: TestIdStatus) => model.testIds.filter((e) => e.status === s).length;
  const parts: string[] = [];
  if (count('adicionado')) parts.push(`+${count('adicionado')} ${count('adicionado') === 1 ? 'ID' : 'IDs'}`);
  if (count('modificado')) parts.push(`${count('modificado')} ${count('modificado') === 1 ? 'ID alterado' : 'IDs alterados'}`);
  if (count('excluído')) parts.push(`-${count('excluído')} ${count('excluído') === 1 ? 'ID' : 'IDs'}`);
  const title = `test(postman): atualiza ${meta.collectionName}${parts.length ? ` (${parts.join(', ')})` : ''}`;

  const shorten = (details: string[]) => {
    const text = details.join('; ');
    return text.length > 160 ? `${text.slice(0, 157)}…` : text;
  };
  const lines: string[] = [];
  for (const e of model.testIds) {
    const head = `${e.name}: ${e.status}${e.previousName ? ` (antes ${e.previousName})` : ''}`;
    lines.push(e.status === 'modificado' ? `- ${head} — ${shorten(e.details)}` : `- ${head}${e.location ? ` (${e.location})` : ''}`);
  }
  for (const s of model.structure)
    lines.push(`- ${capitalize(NOUN[s.kind][0])} ${s.name}: ${s.status}${s.details.length ? ` — ${shorten(s.details)}` : ''}`);

  return [title, '', ...(lines.length ? lines : ['- Sem alterações'])].join('\n').replace(/`/g, '');
}
