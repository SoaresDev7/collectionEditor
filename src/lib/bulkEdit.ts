import type { Collection, HttpMethod, Request } from '@/types/collection';
import { isPlainObject, parseLoose, RAW_MARKER, stringifyLoose, type JsonValue } from './json/loose';
import { parsePath, type PathSegment } from './json/path';
import { walk } from './tree';

/**
 * Edição em massa de campos do body JSON das requisições de vários IDs.
 */

export type BodyOperation = 'remove' | 'set' | 'rename' | 'add';

export const OPERATION_LABEL: Record<BodyOperation, string> = {
  remove: 'Remover campo',
  set: 'Editar valor',
  rename: 'Renomear campo',
  add: 'Adicionar campo (se não existir)',
};

export type ValueType = 'string' | 'number' | 'boolean' | 'null' | 'json' | 'variable';

export const VALUE_TYPE_LABEL: Record<ValueType, string> = {
  string: 'Texto',
  number: 'Número',
  boolean: 'Booleano',
  null: 'null',
  json: 'JSON (objeto/array)',
  variable: 'Variável sem aspas {{var}}',
};

export type BodyEditSpec = {
  operation: BodyOperation;
  path: string;
  /** Novo nome da chave (apenas para "rename"). */
  newKey?: string;
  valueType?: ValueType;
  value?: string;
};

export type RequestTarget = {
  request: Request;
  /** Nome do ID dono da requisição. */
  testIdName: string;
  scenarioName: string;
};

export type EditOutcome =
  | { status: 'changed'; target: RequestTarget; before: string; after: string }
  | { status: 'skipped'; target: RequestTarget; reason: string }
  | { status: 'error'; target: RequestTarget; reason: string };

/** Converte o texto digitado para o valor JSON conforme o tipo escolhido. */
export function parseValue(type: ValueType, raw: string): { ok: true; value: JsonValue } | { ok: false; error: string } {
  switch (type) {
    case 'string':
      return { ok: true, value: raw };
    case 'number':
      return raw.trim() !== '' && !Number.isNaN(Number(raw)) ? { ok: true, value: Number(raw) } : { ok: false, error: 'Número inválido.' };
    case 'boolean':
      return raw === 'true' || raw === 'false' ? { ok: true, value: raw === 'true' } : { ok: false, error: 'Use true ou false.' };
    case 'null':
      return { ok: true, value: null };
    case 'json': {
      const parsed = parseLoose(raw);
      return parsed.ok ? { ok: true, value: parsed.value } : { ok: false, error: parsed.error };
    }
    case 'variable': {
      const name = raw.trim().replace(/^\{\{|\}\}$/g, '');
      return /^[^{}\s]+$/.test(name) ? { ok: true, value: `${RAW_MARKER}{{${name}}}` } : { ok: false, error: 'Nome de variável inválido.' };
    }
  }
}

type Container = JsonValue[] | { [key: string]: JsonValue };

/** Localiza o contêiner pai do último segmento. `create` cria objetos intermediários ausentes. */
function locateParent(root: JsonValue, segs: PathSegment[], create: boolean): Container | null {
  let cur: JsonValue = root;
  for (let i = 0; i < segs.length - 1; i++) {
    const seg = segs[i];
    if (typeof seg === 'number') {
      if (!Array.isArray(cur) || seg >= cur.length) return null;
      cur = cur[seg];
    } else {
      if (!isPlainObject(cur)) return null;
      if (!(seg in cur)) {
        if (!create) return null;
        cur[seg] = typeof segs[i + 1] === 'number' ? [] : {};
      }
      cur = cur[seg];
    }
  }
  return Array.isArray(cur) || isPlainObject(cur) ? cur : null;
}

const has = (c: Container, key: PathSegment) =>
  Array.isArray(c) ? typeof key === 'number' && key < c.length : typeof key === 'string' && key in c;

/** Aplica a operação a um body. Retorna o novo texto ou o motivo de não alterar. */
export function applyToBody(
  body: string,
  spec: BodyEditSpec,
  value?: JsonValue,
): { ok: true; body: string } | { ok: false; skipped: boolean; reason: string } {
  const segs = parsePath(spec.path);
  if (!segs) return { ok: false, skipped: false, reason: 'Caminho do campo inválido.' };

  let root: JsonValue;
  if (!body.trim()) {
    if (spec.operation !== 'add') return { ok: false, skipped: true, reason: 'Body vazio.' };
    root = typeof segs[0] === 'number' ? [] : {};
  } else {
    const parsed = parseLoose(body);
    if (!parsed.ok) return { ok: false, skipped: false, reason: `Body não é JSON válido: ${parsed.error}` };
    root = parsed.value;
  }

  const key = segs[segs.length - 1];
  const parent = locateParent(root, segs, spec.operation === 'add');
  if (!parent) return { ok: false, skipped: true, reason: 'Caminho não existe neste body.' };
  const exists = has(parent, key);

  switch (spec.operation) {
    case 'remove':
      if (!exists) return { ok: false, skipped: true, reason: 'Campo não existe.' };
      if (Array.isArray(parent)) parent.splice(key as number, 1);
      else delete parent[key as string];
      break;

    case 'set':
      if (!exists) return { ok: false, skipped: true, reason: 'Campo não existe.' };
      (parent as Record<string | number, JsonValue>)[key] = value!;
      break;

    case 'add':
      if (exists) return { ok: false, skipped: true, reason: 'Campo já existe.' };
      if (Array.isArray(parent)) {
        if (typeof key !== 'number' || key !== parent.length) return { ok: false, skipped: true, reason: 'Índice fora do fim do array.' };
        parent.push(value!);
      } else if (typeof key === 'string') parent[key] = value!;
      else return { ok: false, skipped: true, reason: 'Pai não é array.' };
      break;

    case 'rename': {
      const newKey = spec.newKey?.trim();
      if (!newKey) return { ok: false, skipped: false, reason: 'Informe o novo nome.' };
      if (Array.isArray(parent) || typeof key !== 'string') return { ok: false, skipped: true, reason: 'Só é possível renomear chaves de objeto.' };
      if (!exists) return { ok: false, skipped: true, reason: 'Campo não existe.' };
      if (newKey in parent) return { ok: false, skipped: true, reason: `Já existe um campo "${newKey}".` };
      // Recria o objeto para manter a posição da chave.
      const entries = Object.entries(parent).map(([k, v]) => [k === key ? newKey : k, v] as const);
      for (const k of Object.keys(parent)) delete parent[k];
      for (const [k, v] of entries) parent[k] = v;
      break;
    }
  }
  return { ok: true, body: stringifyLoose(root) };
}

export type TargetFilter = { method: HttpMethod | 'ALL'; text: string };

/** Requisições dos IDs selecionados que passam no filtro. */
export function collectTargets(collection: Collection, testIdIds: Set<string>, filter: TargetFilter): RequestTarget[] {
  const out: RequestTarget[] = [];
  const text = filter.text.trim().toLowerCase();
  walk({ kind: 'collection', node: collection }, (ref) => {
    if (ref.kind !== 'scenario') return;
    for (const t of ref.node.testIds) {
      if (!testIdIds.has(t.id)) continue;
      for (const r of t.requests) {
        if (filter.method !== 'ALL' && r.method !== filter.method) continue;
        if (text && !`${r.name} ${r.url}`.toLowerCase().includes(text)) continue;
        out.push({ request: r, testIdName: t.name, scenarioName: ref.node.name });
      }
    }
  });
  return out;
}

/** Body reformatado como a edição faria, para não contar mudança só de formatação. */
function normalized(body: string): string {
  const parsed = parseLoose(body);
  return parsed.ok ? stringifyLoose(parsed.value) : body;
}

export function previewBulkEdit(targets: RequestTarget[], spec: BodyEditSpec, value?: JsonValue): EditOutcome[] {
  return targets.map((target) => {
    // Cada body recebe sua própria cópia do valor.
    const result = applyToBody(target.request.body, spec, value === undefined ? undefined : structuredClone(value));
    if (result.ok) {
      return result.body === normalized(target.request.body)
        ? { status: 'skipped', target, reason: 'Sem alteração.' }
        : { status: 'changed', target, before: target.request.body, after: result.body };
    }
    return result.skipped
      ? { status: 'skipped', target, reason: result.reason }
      : { status: 'error', target, reason: result.reason };
  });
}
