import type { Collection, Folder, Header, HttpMethod, PostmanRaw, Request, Scenario, Scripted, TestId, Variable, VariableScope } from '@/types/collection';
import { HTTP_METHODS } from '@/types/collection';
import { createCollection, createFolder, createHeader, createRequest, createScenario, createTestId, createVariable } from '../factories';
import { sanitizeIdCode, suggestIdCode } from '../nomenclature';
import { uid } from '../ids';
import { GENERATED_END, GENERATED_START } from './export';
import type { PostmanCollection, PostmanEvent, PostmanItem, PostmanRequest, PostmanUrl, PostmanVariable } from './schema';

/**
 * Importa uma collection Postman (v2.0/v2.1) SEM alterá-la.
 *
 * - Nomes, ordem, scripts, variáveis, auth, exemplos de resposta e qualquer
 *   campo que a ferramenta não edita são preservados e voltam iguais na
 *   exportação (os objetos originais ficam em `postman`/`extra`).
 * - A profundidade das pastas é mapeada para a hierarquia: 1º nível → Folder,
 *   2º → Cenário, 3º → ID. Onde faltam níveis (requisições soltas), entram
 *   contêineres "sintéticos", que não viram pastas na exportação.
 * - Pastas abaixo do 3º nível continuam existindo: as requisições guardam o
 *   caminho (`folderPath`) e a exportação recria as pastas.
 *
 * Padronizações (renomear IDs, reorganizar etc.) ficam a cargo do usuário,
 * pelas ações da ferramenta.
 */

export type ImportResult = {
  collection: Collection;
  /** Itens preservados mas não editáveis na ferramenta (informativo). */
  notes: string[];
  stats: { folders: number; scenarios: number; testIds: number; requests: number; synthetic: number };
};

export class ImportError extends Error {}

const isFolder = (item: PostmanItem) => Array.isArray(item.item);

export const descriptionText = (d: unknown): string =>
  typeof d === 'string' ? d : d && typeof d === 'object' && 'content' in d ? String((d as { content: unknown }).content ?? '') : '';

export const scriptText = (s: PostmanEvent['script'] | undefined) =>
  Array.isArray(s?.exec) ? s.exec.join('\n') : typeof s?.exec === 'string' ? s.exec : '';

export const eventsText = (events: PostmanEvent[] | undefined, listen: PostmanEvent['listen']) =>
  (events ?? []).filter((e) => e.listen === listen).map((e) => scriptText(e.script)).join('\n');

const VAR_LINE_RE = /^pm\.variables\.set\(\s*("(?:[^"\\]|\\.)*")\s*,\s*(.*)\);\s*$/;

/** Separa o bloco de variáveis gerado por esta ferramenta (se houver) do restante do script. */
function extractGeneratedVariables(code: string, scope: VariableScope): { code: string; variables: Variable[] } {
  const start = code.indexOf(GENERATED_START);
  const end = code.indexOf(GENERATED_END);
  if (start < 0 || end < start) return { code, variables: [] };
  const variables: Variable[] = [];
  for (const line of code.slice(start + GENERATED_START.length, end).split('\n')) {
    const m = VAR_LINE_RE.exec(line.trim());
    if (!m) continue;
    try {
      const key = JSON.parse(m[1]) as string;
      const value = JSON.parse(m[2]) as unknown;
      const type = typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'string';
      variables.push(createVariable(scope, { key, value: String(value), type }));
    } catch {
      /* linha alterada manualmente: fica no script */
    }
  }
  const rest = (code.slice(0, start) + code.slice(end + GENERATED_END.length)).replace(/^\s+/, '');
  return { code: rest, variables };
}

function scriptsOf(events: PostmanEvent[] | undefined, scope: VariableScope | null): Scripted & { variables: Variable[] } {
  const pre = eventsText(events, 'prerequest');
  const post = eventsText(events, 'test');
  if (!scope) return { preRequestScripts: pre, postRequestScripts: post, variables: [] };
  const extracted = extractGeneratedVariables(pre, scope);
  return { preRequestScripts: extracted.code, postRequestScripts: post, variables: extracted.variables };
}

export function convertVariables(vars: PostmanVariable[] | undefined, scope: VariableScope): Variable[] {
  return (vars ?? []).map((v) =>
    createVariable(scope, {
      key: v.key ?? '',
      value: v.value === undefined || v.value === null ? '' : typeof v.value === 'string' ? v.value : JSON.stringify(v.value),
      type: v.type === 'number' || v.type === 'boolean' ? v.type : 'string',
      description: descriptionText(v.description),
      storage: 'postman',
      // Original inteiro: volta exatamente igual se nada for editado.
      extra: { ...v },
    }),
  );
}

export function urlText(url: PostmanUrl | undefined): string {
  if (!url) return '';
  if (typeof url === 'string') return url;
  if (typeof url.raw === 'string') return url.raw;
  const u = url as { protocol?: string; host?: string | string[]; path?: string | string[] };
  const host = Array.isArray(u.host) ? u.host.join('.') : (u.host ?? '');
  const path = Array.isArray(u.path) ? u.path.join('/') : (u.path ?? '');
  return `${u.protocol ? `${u.protocol}://` : ''}${host}${path ? `/${path}` : ''}`;
}

/** Remove os campos que a ferramenta modela, deixando só o que deve ser preservado. */
const rest = (obj: object, ...keys: string[]): PostmanRaw => {
  const copy: PostmanRaw = { ...(obj as PostmanRaw) };
  for (const k of keys) delete copy[k];
  return copy;
};

function convertRequest(item: PostmanItem, folderPath: string[] | undefined, notes: string[]): Request {
  const req: PostmanRequest = typeof item.request === 'string' ? { url: item.request } : (item.request ?? {});
  const method = (req.method ?? 'GET').toUpperCase();
  const headers: Header[] = (req.header ?? []).map((h) =>
    createHeader({ key: h.key, value: h.value ?? '', enabled: !h.disabled, extra: { ...h } }),
  );

  const body = req.body as { mode?: string; raw?: string } | undefined;
  if (body?.mode && body.mode !== 'raw')
    notes.push(`"${item.name}": body do tipo ${body.mode} preservado (edição disponível só para body raw).`);
  const auth = (req as { auth?: { type?: string } }).auth;
  if (auth?.type) notes.push(`"${item.name}": autenticação ${auth.type} preservada.`);
  if (!HTTP_METHODS.includes(method as HttpMethod)) notes.push(`"${item.name}": método ${method} preservado.`);

  const s = scriptsOf(item.event, null);
  return createRequest({
    name: item.name,
    method: method as HttpMethod,
    url: urlText(req.url),
    headers,
    body: body?.mode === 'raw' ? (body.raw ?? '') : '',
    preRequestScripts: s.preRequestScripts,
    postRequestScripts: s.postRequestScripts,
    folderPath: folderPath?.length ? folderPath : undefined,
    postman: rest(item, 'name'),
  });
}

export function importPostman(json: unknown): ImportResult {
  const data = json as PostmanCollection;
  if (!data || typeof data !== 'object' || !data.info || !Array.isArray(data.item))
    throw new ImportError('Arquivo não parece uma Postman Collection (faltam "info" ou "item").');
  if (data.info.schema && !/v2\.[01]/.test(data.info.schema))
    throw new ImportError('Apenas collections no formato Postman v2.0 ou v2.1 são suportadas.');

  const notes: string[] = [];
  let synthetic = 0;
  const root = scriptsOf(data.event, null);
  const collection = createCollection({
    name: data.info.name ?? '',
    description: descriptionText(data.info.description),
    variables: convertVariables(data.variable, 'global'),
    preRequestScripts: root.preRequestScripts,
    postRequestScripts: root.postRequestScripts,
    postman: rest(data, 'item'),
  });

  /** Agrupa itens consecutivos do mesmo tipo (pastas x requisições), preservando a ordem. */
  const runs = (items: PostmanItem[]) => {
    const out: { folder: boolean; items: PostmanItem[] }[] = [];
    for (const item of items) {
      const f = isFolder(item);
      if (out.length && out[out.length - 1].folder === f && !f) out[out.length - 1].items.push(item);
      else out.push({ folder: f, items: [item] });
    }
    return out;
  };

  const groupFields = (item: PostmanItem, scope: VariableScope) => {
    const s = scriptsOf(item.event, scope);
    return {
      name: item.name,
      description: descriptionText(item.description),
      variables: [...convertVariables(item.variable, scope), ...s.variables],
      preRequestScripts: s.preRequestScripts,
      postRequestScripts: s.postRequestScripts,
      postman: rest(item, 'item', 'name'),
    };
  };

  /** Requisições (e pastas abaixo do 3º nível) de um ID, sem achatar a estrutura. */
  const collectRequests = (items: PostmanItem[], path: string[], testId: TestId) => {
    for (const item of items) {
      if (isFolder(item)) {
        const key = uid();
        testId.subfolders = { ...(testId.subfolders ?? {}), [key]: rest(item, 'item') };
        collectRequests(item.item!, [...path, key], testId);
      } else testId.requests.push(convertRequest(item, path, notes));
    }
  };

  const syntheticTestId = (request: PostmanItem): TestId => {
    synthetic++;
    return createTestId({ name: request.name, synthetic: true, requests: [convertRequest(request, undefined, notes)] });
  };

  const buildScenario = (item: PostmanItem): Scenario => {
    const scenario = createScenario({ ...groupFields(item, 'scenario'), idCode: sanitizeIdCode(suggestIdCode(item.name)) });
    for (const child of item.item ?? []) {
      if (isFolder(child)) {
        const t = createTestId(groupFields(child, 'testId'));
        collectRequests(child.item!, [], t);
        scenario.testIds.push(t);
      } else scenario.testIds.push(syntheticTestId(child));
    }
    return scenario;
  };

  const syntheticScenario = (requests: PostmanItem[]): Scenario => {
    synthetic++;
    return createScenario({ name: '(requisições sem pasta)', idCode: 'REQ', synthetic: true, testIds: requests.map(syntheticTestId) });
  };

  const buildFolder = (item: PostmanItem): Folder => {
    const folder = createFolder(groupFields(item, 'folder'));
    for (const run of runs(item.item ?? []))
      if (run.folder) folder.scenarios.push(...run.items.map(buildScenario));
      else folder.scenarios.push(syntheticScenario(run.items));
    return folder;
  };

  for (const run of runs(data.item)) {
    if (run.folder) collection.folders.push(...run.items.map(buildFolder));
    else {
      synthetic++;
      collection.folders.push(createFolder({ name: '(requisições na raiz)', synthetic: true, scenarios: [syntheticScenario(run.items)] }));
    }
  }

  const stats = { folders: 0, scenarios: 0, testIds: 0, requests: 0, synthetic };
  for (const f of collection.folders) {
    if (!f.synthetic) stats.folders++;
    for (const s of f.scenarios) {
      if (!s.synthetic) stats.scenarios++;
      for (const t of s.testIds) {
        if (!t.synthetic) stats.testIds++;
        stats.requests += t.requests.length;
      }
    }
  }
  return { collection, notes, stats };
}
