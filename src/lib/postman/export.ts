import type { Collection, Request, Scripted, Variable } from '@/types/collection';
import {
  POSTMAN_SCHEMA_V21,
  type PostmanCollection,
  type PostmanEvent,
  type PostmanItem,
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
 * O Postman só honra variáveis no nível da collection. Variáveis de Folder,
 * Cenário e ID são exportadas como `pm.variables.set(...)` no pré-request do
 * respectivo nível, dentro de um bloco marcado para que a importação possa
 * reconhecê-lo e convertê-lo de volta em variáveis.
 */

export const GENERATED_START = '// @collection-editor:variables:start';
export const GENERATED_END = '// @collection-editor:variables:end';

const toLines = (code: string): string[] => code.replace(/\r\n/g, '\n').split('\n');

const literal = (v: Variable): string => {
  if (v.type === 'number' && v.value.trim() !== '' && !Number.isNaN(Number(v.value))) return String(Number(v.value));
  if (v.type === 'boolean' && (v.value === 'true' || v.value === 'false')) return v.value;
  return JSON.stringify(v.value);
};

function variablesScript(vars: Variable[]): string {
  const valid = vars.filter((v) => v.key);
  if (!valid.length) return '';
  return [GENERATED_START, ...valid.map((v) => `pm.variables.set(${JSON.stringify(v.key)}, ${literal(v)});`), GENERATED_END].join('\n');
}

function events(node: Scripted, vars: Variable[] = []): PostmanEvent[] | undefined {
  const pre = [variablesScript(vars), node.preRequestScripts].filter((s) => s.trim()).join('\n\n');
  const out: PostmanEvent[] = [];
  if (pre.trim()) out.push({ listen: 'prerequest', script: { type: 'text/javascript', exec: toLines(pre) } });
  if (node.postRequestScripts.trim())
    out.push({ listen: 'test', script: { type: 'text/javascript', exec: toLines(node.postRequestScripts) } });
  return out.length ? out : undefined;
}

function requestItem(r: Request): PostmanItem {
  const hasBody = r.body.trim() !== '' && !['GET', 'HEAD'].includes(r.method);
  return {
    name: r.name,
    event: events(r),
    request: {
      method: r.method,
      header: r.headers
        .filter((h) => h.key)
        .map((h) => ({ key: h.key, value: h.value, ...(h.enabled ? {} : { disabled: true }) })),
      url: r.url,
      ...(hasBody ? { body: { mode: 'raw', raw: r.body, options: { raw: { language: 'json' } } } } : {}),
    },
  };
}

const globalVariable = (v: Variable): PostmanVariable => ({
  key: v.key,
  value: v.value,
  type: v.type,
  ...(v.description ? { description: v.description } : {}),
});

export function toPostman(collection: Collection): PostmanCollection {
  return {
    info: {
      _postman_id: collection.id,
      name: collection.name,
      description: collection.description,
      schema: POSTMAN_SCHEMA_V21,
    },
    event: events(collection),
    variable: collection.variables.filter((v) => v.key).map(globalVariable),
    item: collection.folders.map((folder) => ({
      name: folder.name,
      description: folder.description,
      event: events(folder, folder.variables),
      item: folder.scenarios.map((scenario) => ({
        name: scenario.name,
        description: scenario.description,
        event: events(scenario, scenario.variables),
        item: scenario.testIds.map((testId) => ({
          name: testId.name,
          description: testId.description,
          event: events(testId, testId.variables),
          item: testId.requests.map(requestItem),
        })),
      })),
    })),
  };
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
