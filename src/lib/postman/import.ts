import type { Collection, Folder, Header, HttpMethod, Request, Scenario, Scripted, Variable, VariableScope } from '@/types/collection';
import { HTTP_METHODS } from '@/types/collection';
import { createCollection, createFolder, createHeader, createRequest, createScenario, createTestId, createVariable } from '../factories';
import { nextTestIdName, parseTestIdNumber, sanitizeIdCode, sortTestIds, suggestIdCode, uniqueName } from '../nomenclature';
import { GENERATED_END, GENERATED_START } from './export';
import type { PostmanCollection, PostmanEvent, PostmanItem, PostmanRequest, PostmanUrl, PostmanVariable } from './schema';

/**
 * Importa uma collection Postman (v2.0/v2.1) mapeando a profundidade das
 * pastas para a hierarquia padrão:
 *
 *   nível 1 → Folder, nível 2 → Cenário, nível 3 → ID de Teste.
 *
 * Requisições soltas em níveis acima recebem um contêiner "Geral"; requisições
 * diretamente num cenário viram um ID cada. Pastas mais profundas que o nível 3
 * são achatadas dentro do ID (o nome da requisição recebe o caminho da pasta).
 */

export type ImportOptions = {
  /** Renomeia os IDs para TC-<código>-NNN (o nome original vai para a descrição). */
  normalizeIds: boolean;
};

export type ImportResult = {
  collection: Collection;
  warnings: string[];
  stats: { folders: number; scenarios: number; testIds: number; requests: number };
};

export class ImportError extends Error {}

const isFolder = (item: PostmanItem) => Array.isArray(item.item);

const descriptionText = (d: unknown): string =>
  typeof d === 'string' ? d : d && typeof d === 'object' && 'content' in d ? String((d as { content: unknown }).content ?? '') : '';

const scriptText = (s: PostmanEvent['script'] | undefined) =>
  Array.isArray(s?.exec) ? s.exec.join('\n') : typeof s?.exec === 'string' ? s.exec : '';

const VAR_LINE_RE = /^pm\.variables\.set\(\s*("(?:[^"\\]|\\.)*")\s*,\s*(.*)\);\s*$/;

/** Separa o bloco de variáveis gerado pela exportação do restante do script. */
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
      /* linha alterada manualmente: fica fora */
    }
  }
  const rest = (code.slice(0, start) + code.slice(end + GENERATED_END.length)).replace(/^\s+/, '');
  return { code: rest, variables };
}

function scriptsOf(events: PostmanEvent[] | undefined, scope: VariableScope | null): Scripted & { variables: Variable[] } {
  const pre = (events ?? []).filter((e) => e.listen === 'prerequest').map((e) => scriptText(e.script)).join('\n');
  const post = (events ?? []).filter((e) => e.listen === 'test').map((e) => scriptText(e.script)).join('\n');
  if (!scope) return { preRequestScripts: pre, postRequestScripts: post, variables: [] };
  const extracted = extractGeneratedVariables(pre, scope);
  return { preRequestScripts: extracted.code, postRequestScripts: post, variables: extracted.variables };
}

function convertVariables(vars: PostmanVariable[] | undefined, scope: VariableScope): Variable[] {
  return (vars ?? [])
    .filter((v) => v.key)
    .map((v) =>
      createVariable(scope, {
        key: v.key,
        value: v.value === undefined || v.value === null ? '' : typeof v.value === 'string' ? v.value : JSON.stringify(v.value),
        type: v.type === 'number' || v.type === 'boolean' ? v.type : 'string',
        description: descriptionText(v.description),
      }),
    );
}

function urlText(url: PostmanUrl | undefined): string {
  if (!url) return '';
  if (typeof url === 'string') return url;
  if (typeof url.raw === 'string') return url.raw;
  const u = url as { protocol?: string; host?: string | string[]; path?: string | string[] };
  const host = Array.isArray(u.host) ? u.host.join('.') : (u.host ?? '');
  const path = Array.isArray(u.path) ? u.path.join('/') : (u.path ?? '');
  return `${u.protocol ? `${u.protocol}://` : ''}${host}${path ? `/${path}` : ''}`;
}

type RawBody = { mode?: string; raw?: string; urlencoded?: { key: string; value?: string; disabled?: boolean }[]; formdata?: { key: string; value?: string; type?: string; disabled?: boolean }[]; graphql?: { query?: string; variables?: string } };

function convertRequest(item: PostmanItem, name: string, extraPre: string[], extraPost: string[], warnings: string[]): Request {
  const req: PostmanRequest = typeof item.request === 'string' ? { url: item.request, method: 'GET' } : (item.request ?? {});
  const method = (req.method ?? 'GET').toUpperCase();
  const headers: Header[] = (req.header ?? []).map((h) => createHeader({ key: h.key, value: h.value ?? '', enabled: !h.disabled }));

  const raw = req.body as RawBody | undefined;
  let body = '';
  if (raw?.mode === 'raw') body = raw.raw ?? '';
  else if (raw?.mode === 'urlencoded' || raw?.mode === 'formdata') {
    const pairs = (raw.mode === 'urlencoded' ? raw.urlencoded : raw.formdata) ?? [];
    body = JSON.stringify(Object.fromEntries(pairs.filter((p) => !p.disabled).map((p) => [p.key, p.value ?? ''])), null, 2);
    warnings.push(`"${name}": body ${raw.mode} convertido para JSON (revise o header Content-Type).`);
  } else if (raw?.mode === 'graphql') {
    body = JSON.stringify({ query: raw.graphql?.query ?? '', variables: raw.graphql?.variables ?? '' }, null, 2);
    warnings.push(`"${name}": body GraphQL convertido para JSON.`);
  } else if (raw?.mode) warnings.push(`"${name}": body do tipo ${raw.mode} não é suportado e foi ignorado.`);

  const auth = (req as { auth?: { type?: string; bearer?: { key: string; value: string }[] } }).auth;
  if (auth?.type === 'bearer') {
    const token = auth.bearer?.find((b) => b.key === 'token')?.value ?? '';
    if (!headers.some((h) => h.key.toLowerCase() === 'authorization')) headers.push(createHeader({ key: 'Authorization', value: `Bearer ${token}` }));
  } else if (auth?.type && auth.type !== 'noauth') warnings.push(`"${name}": autenticação ${auth.type} não é suportada e foi ignorada.`);

  const own = scriptsOf(item.event, null);
  if (!HTTP_METHODS.includes(method as HttpMethod)) warnings.push(`"${name}": método ${method} trocado por GET.`);
  return createRequest({
    name,
    method: HTTP_METHODS.includes(method as HttpMethod) ? (method as HttpMethod) : 'GET',
    url: urlText(req.url),
    headers,
    body,
    preRequestScripts: [...extraPre, own.preRequestScripts].filter((s) => s.trim()).join('\n\n'),
    postRequestScripts: [...extraPost, own.postRequestScripts].filter((s) => s.trim()).join('\n\n'),
  });
}

/** Requisições de uma pasta profunda (nível 4+), achatadas com o caminho no nome. */
function flattenRequests(items: PostmanItem[], prefix: string[], pre: string[], post: string[], warnings: string[]): Request[] {
  const out: Request[] = [];
  for (const item of items) {
    if (isFolder(item)) {
      const s = scriptsOf(item.event, null);
      const tag = (code: string) => (code.trim() ? [`// ${[...prefix, item.name].join(' › ')}\n${code}`] : []);
      out.push(...flattenRequests(item.item!, [...prefix, item.name], [...pre, ...tag(s.preRequestScripts)], [...post, ...tag(s.postRequestScripts)], warnings));
    } else out.push(convertRequest(item, [...prefix, item.name].join(' › '), pre, post, warnings));
  }
  return out;
}

export function importPostman(json: unknown, options: ImportOptions): ImportResult {
  const data = json as PostmanCollection;
  if (!data || typeof data !== 'object' || !data.info || !Array.isArray(data.item))
    throw new ImportError('Arquivo não parece uma Postman Collection (faltam "info" ou "item").');
  if (data.info.schema && !/v2\.[01]/.test(data.info.schema))
    throw new ImportError('Apenas collections no formato Postman v2.0 ou v2.1 são suportadas.');

  const warnings: string[] = [];
  const rootScripts = scriptsOf(data.event, null);
  const collection = createCollection({
    name: data.info.name || 'Collection importada',
    description: descriptionText(data.info.description),
    variables: convertVariables(data.variable, 'global'),
    preRequestScripts: rootScripts.preRequestScripts,
    postRequestScripts: rootScripts.postRequestScripts,
  });

  /** Renomeia para o padrão os IDs que ainda não o seguem (o nome original vai para a descrição). */
  const normalize = (scenario: Scenario) => {
    for (const t of scenario.testIds) {
      if (parseTestIdNumber(scenario.idCode, t.name) !== null) continue;
      if (!t.description) t.description = t.name;
      t.name = nextTestIdName(scenario);
    }
    scenario.testIds = sortTestIds(scenario.idCode, scenario.testIds);
  };

  const buildScenario = (item: PostmanItem | null, folder: Folder): Scenario => {
    const name = item?.name ?? 'Geral';
    // Código: do padrão TC-XXX-NNN dos filhos, se houver; senão sugerido pelo nome.
    const codeFromChildren = item?.item?.map((c) => /^TC-([A-Z]{1,3})-\d+$/.exec(c.name.trim())?.[1]).find(Boolean);
    const s = scriptsOf(item?.event, 'scenario');
    const scenario = createScenario({
      name: uniqueName(name, folder.scenarios.map((x) => x.name)),
      description: descriptionText(item?.description),
      idCode: sanitizeIdCode(codeFromChildren ?? suggestIdCode(name)),
      variables: [...convertVariables(item?.variable, 'scenario'), ...s.variables],
      preRequestScripts: s.preRequestScripts,
      postRequestScripts: s.postRequestScripts,
    });
    for (const child of item?.item ?? []) {
      if (isFolder(child)) {
        const ts = scriptsOf(child.event, 'testId');
        scenario.testIds.push(
          createTestId({
            name: child.name,
            description: descriptionText(child.description),
            variables: [...convertVariables(child.variable, 'testId'), ...ts.variables],
            preRequestScripts: ts.preRequestScripts,
            postRequestScripts: ts.postRequestScripts,
            requests: flattenRequests(child.item!, [], [], [], warnings),
          }),
        );
      } else {
        // Requisição direto no cenário: vira um ID com essa requisição.
        scenario.testIds.push(createTestId({ name: child.name, requests: [convertRequest(child, child.name, [], [], warnings)] }));
      }
    }
    if (options.normalizeIds) normalize(scenario);
    return scenario;
  };

  const buildFolder = (item: PostmanItem | null, looseRequests: PostmanItem[] = []): Folder => {
    const s = scriptsOf(item?.event, 'folder');
    const folder = createFolder({
      name: uniqueName(item?.name ?? 'Geral', collection.folders.map((f) => f.name)),
      description: descriptionText(item?.description),
      variables: [...convertVariables(item?.variable, 'folder'), ...s.variables],
      preRequestScripts: s.preRequestScripts,
      postRequestScripts: s.postRequestScripts,
    });
    const children = item?.item ?? looseRequests;
    const loose = children.filter((c) => !isFolder(c));
    if (loose.length) folder.scenarios.push(buildScenario({ name: 'Geral', item: loose }, folder));
    for (const child of children.filter(isFolder)) folder.scenarios.push(buildScenario(child, folder));
    return folder;
  };

  const rootLoose = data.item.filter((i) => !isFolder(i));
  if (rootLoose.length) {
    collection.folders.push(buildFolder(null, rootLoose));
    warnings.push(`${rootLoose.length} requisição(ões) fora de pastas foram colocadas no folder "Geral".`);
  }
  for (const item of data.item.filter(isFolder)) collection.folders.push(buildFolder(item));

  const stats = { folders: collection.folders.length, scenarios: 0, testIds: 0, requests: 0 };
  for (const f of collection.folders)
    for (const s of f.scenarios) {
      stats.scenarios++;
      for (const t of s.testIds) {
        stats.testIds++;
        stats.requests += t.requests.length;
      }
    }
  return { collection, warnings, stats };
}
