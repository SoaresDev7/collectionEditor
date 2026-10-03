import type { Collection, Folder, Header, PostmanRaw, Request, Scenario, Scripted, TestId, Variable } from '@/types/collection';
import {
  POSTMAN_SCHEMA_V21,
  type PostmanCollection,
  type PostmanEvent,
  type PostmanItem,
  type PostmanRequest,
  type PostmanVariable,
} from './schema';

/**
 * Converte a collection para o formato Postman v2.1.
 *
 * Mapeamento:
 *   Folder / Cenário / ID de Teste → item-group (pastas aninhadas)
 *   Requisição                     → item com `request`
 *   Pré-request / Pós-request      → event "prerequest" / "test"
 *
 * Itens importados partem do JSON original e só os campos editados são
 * sobrescritos: o que não mudou (inclusive formatação de scripts, objetos de
 * URL/descrição, auth, exemplos) volta exatamente como estava.
 *
 * Variáveis criadas na ferramenta em Folder/Cenário/ID viram
 * `pm.variables.set(...)` no pré-request do nível (o Postman só aplica
 * variáveis da collection), entre marcadores que a importação reconhece.
 * Variáveis que vieram do campo `variable` de um item voltam para ele.
 */

export const GENERATED_START = '// @collection-editor:variables:start';
export const GENERATED_END = '// @collection-editor:variables:end';

const toLines = (code: string): string[] => code.replace(/\r\n/g, '\n').split('\n');

const scriptText = (s: PostmanEvent['script'] | undefined) =>
  Array.isArray(s?.exec) ? s.exec.join('\n') : typeof s?.exec === 'string' ? s.exec : '';

const literal = (v: Variable): string => {
  if (v.type === 'number' && v.value.trim() !== '' && !Number.isNaN(Number(v.value))) return String(Number(v.value));
  if (v.type === 'boolean' && (v.value === 'true' || v.value === 'false')) return v.value;
  return JSON.stringify(v.value);
};

function variablesScript(vars: Variable[]): string {
  const valid = vars.filter((v) => v.key && v.storage !== 'postman');
  if (!valid.length) return '';
  return [GENERATED_START, ...valid.map((v) => `pm.variables.set(${JSON.stringify(v.key)}, ${literal(v)});`), GENERATED_END].join('\n');
}

/** Eventos, reaproveitando os originais quando o texto do script não mudou. */
function events(node: Scripted, vars: Variable[], original: PostmanEvent[] | undefined): PostmanEvent[] | undefined {
  const pre = [variablesScript(vars), node.preRequestScripts].filter((s) => s.trim()).join('\n\n');
  const out: PostmanEvent[] = [];
  for (const [listen, code] of [
    ['prerequest', pre],
    ['test', node.postRequestScripts],
  ] as const) {
    const orig = (original ?? []).filter((e) => e.listen === listen);
    if (orig.length && orig.map((e) => scriptText(e.script)).join('\n') === code) out.push(...orig);
    else if (orig.length) out.push({ ...orig[0], script: { ...orig[0].script, type: orig[0].script?.type ?? 'text/javascript', exec: toLines(code) } });
    else if (code.trim()) out.push({ listen, script: { type: 'text/javascript', exec: toLines(code) } });
  }
  // Mantém eventos de outros tipos que o Postman venha a ter.
  for (const e of original ?? []) if (e.listen !== 'prerequest' && e.listen !== 'test') out.push(e);
  if (out.length) return out;
  return original ? [] : undefined;
}

/** Descrição: mantém o objeto original ({content, type}) se o texto não mudou. */
function description(text: string, original: unknown): unknown {
  if (original && typeof original === 'object' && (original as { content?: unknown }).content === text) return original;
  if (typeof original === 'string' && original === text) return original;
  if (original === undefined && !text) return undefined;
  return text;
}

function exportVariable(v: Variable): PostmanVariable {
  const orig = v.extra as PostmanVariable | undefined;
  if (orig) {
    const origValue = orig.value === undefined || orig.value === null ? '' : typeof orig.value === 'string' ? orig.value : JSON.stringify(orig.value);
    const origType = orig.type === 'number' || orig.type === 'boolean' ? orig.type : 'string';
    const sameDesc = (typeof orig.description === 'string' ? orig.description : '') === v.description || (!orig.description && !v.description);
    if (orig.key === v.key && origValue === v.value && origType === v.type && sameDesc) return orig;
    return { ...orig, key: v.key, value: v.value, ...(orig.type || v.type !== 'string' ? { type: v.type } : {}), ...(v.description ? { description: v.description } : {}) };
  }
  return { key: v.key, value: v.value, type: v.type, ...(v.description ? { description: v.description } : {}) };
}

/** Variáveis que vão no campo `variable` do item/collection. */
function variableField(vars: Variable[], original: unknown, all = false): PostmanVariable[] | undefined {
  const list = vars.filter((v) => (v.key || v.extra) && (all || v.storage === 'postman')).map(exportVariable);
  if (list.length) return list;
  return original === undefined ? undefined : [];
}

function exportHeaders(headers: Header[], original: unknown): unknown {
  const list = headers
    .filter((h) => h.key || h.extra)
    .map((h) => {
      const orig = h.extra as { key: string; value?: string; disabled?: boolean } | undefined;
      if (orig && orig.key === h.key && (orig.value ?? '') === h.value && !orig.disabled === h.enabled) return orig;
      return { ...(orig ?? {}), key: h.key, value: h.value, ...(h.enabled ? {} : { disabled: true }) };
    });
  if (!list.length && original === undefined) return undefined;
  return list;
}

/** Remove chaves com valor undefined (evita campos novos que o original não tinha). */
function clean<T extends object>(obj: T): T {
  for (const k of Object.keys(obj) as (keyof T)[]) if (obj[k] === undefined) delete obj[k];
  return obj;
}

function requestItem(r: Request): PostmanItem {
  const orig = (r.postman ?? {}) as PostmanItem & PostmanRaw;
  const origReq: PostmanRequest = typeof orig.request === 'object' && orig.request ? orig.request : typeof orig.request === 'string' ? { url: orig.request } : {};
  const origUrlText =
    typeof origReq.url === 'string' ? origReq.url : typeof origReq.url?.raw === 'string' ? origReq.url.raw : undefined;
  const origBody = origReq.body as { mode?: string; raw?: string; options?: unknown } | undefined;

  let body: unknown = origBody;
  if (origBody?.mode === 'raw') body = (origBody.raw ?? '') === r.body ? origBody : { ...origBody, raw: r.body };
  else if (r.body.trim()) body = { mode: 'raw', raw: r.body, options: { raw: { language: 'json' } } };

  const sameMethod = (origReq.method ?? 'GET').toUpperCase() === r.method;
  const request = clean({
    ...origReq,
    method: sameMethod && origReq.method ? origReq.method : r.method,
    header: exportHeaders(r.headers, origReq.header),
    url: origUrlText === r.url ? origReq.url : r.url,
    body,
  } as PostmanRequest);
  // Requisição originalmente em formato "string" (só URL) e que não mudou.
  const unchangedStringRequest = typeof orig.request === 'string' && orig.request === r.url && r.method === 'GET' && !r.headers.length && !r.body;

  return clean({
    ...orig,
    name: r.name,
    event: events(r, [], orig.event),
    request: unchangedStringRequest ? orig.request : request,
  });
}

/** Requisições do ID, recriando as pastas originais abaixo dele (folderPath). */
function testIdChildren(t: TestId): PostmanItem[] {
  const root: PostmanItem[] = [];
  const openGroups: { key: string; item: PostmanItem }[] = [];
  for (const r of t.requests) {
    const path = r.folderPath ?? [];
    // Fecha grupos que não fazem parte do caminho desta requisição.
    let depth = 0;
    while (depth < openGroups.length && depth < path.length && openGroups[depth].key === path[depth]) depth++;
    openGroups.length = depth;
    for (let i = depth; i < path.length; i++) {
      const raw = t.subfolders?.[path[i]] ?? { name: 'Pasta' };
      const group = { ...(raw as unknown as PostmanItem), item: [] as PostmanItem[] };
      (i === 0 ? root : openGroups[i - 1].item.item!).push(group);
      openGroups.push({ key: path[i], item: group });
    }
    (path.length ? openGroups[path.length - 1].item.item! : root).push(requestItem(r));
  }
  return root;
}

type Group = (Folder | Scenario | TestId) & Scripted;

/** Contêiner sintético sem conteúdo próprio: os filhos vão direto para o pai. */
const transparent = (g: Group) =>
  !!g.synthetic && !g.description && !g.preRequestScripts.trim() && !g.postRequestScripts.trim() && !g.variables.length;

function groupItems(g: Group, children: PostmanItem[]): PostmanItem[] {
  if (transparent(g)) return children;
  const orig = (g.postman ?? {}) as PostmanItem & PostmanRaw;
  return [
    clean({
      ...orig,
      name: g.name,
      description: description(g.description, orig.description) as PostmanItem['description'],
      variable: variableField(g.variables, orig.variable),
      event: events(g, g.variables, orig.event),
      item: children,
    }),
  ];
}

export function toPostman(collection: Collection): PostmanCollection {
  const orig = (collection.postman ?? {}) as Partial<PostmanCollection> & PostmanRaw;
  const info = (orig.info ?? {}) as PostmanCollection['info'];
  return clean({
    ...orig,
    info: clean({
      ...info,
      _postman_id: info._postman_id ?? collection.id,
      name: collection.name,
      description: description(collection.description, info.description) as string | undefined,
      schema: info.schema ?? POSTMAN_SCHEMA_V21,
    }),
    item: collection.folders.flatMap((folder) =>
      groupItems(
        folder,
        folder.scenarios.flatMap((scenario) =>
          groupItems(
            scenario,
            scenario.testIds.flatMap((testId) => groupItems(testId, testIdChildren(testId))),
          ),
        ),
      ),
    ),
    event: events(collection, [], orig.event),
    variable: variableField(collection.variables, orig.variable, true),
  }) as PostmanCollection;
}

export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const exportFileName = (c: Collection) =>
  `${c.name.trim().replace(/[^\w.-]+/g, '_') || 'collection'}.postman_collection.json`;
