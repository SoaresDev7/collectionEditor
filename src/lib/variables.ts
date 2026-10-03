import { SCOPE_BY_KIND, type Collection, type NodePath, type Variable, type VariableScope } from '@/types/collection';
import { walk } from './tree';

/** Nome válido para variável do Postman: começa com letra/_ e contém apenas letras, números, _, - e ponto. */
export const VARIABLE_NAME_RE = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

const REF_RE = /\{\{\s*([^{}\s]+)\s*\}\}/g;

/** Nomes referenciados como {{nome}} em um texto. */
export function extractVariableRefs(text: string): string[] {
  const names = new Set<string>();
  for (const m of text.matchAll(REF_RE)) names.add(m[1]);
  return [...names];
}

/** Variáveis dinâmicas do Postman ({{$guid}}, {{$timestamp}}...) sempre existem. */
export const isDynamicVariable = (name: string) => name.startsWith('$');

export type ResolvedVariable = {
  variable: Variable;
  scope: VariableScope;
  /** Nome do nó onde a variável foi declarada. */
  sourceName: string;
  sourceId: string;
  /** true quando um escopo mais interno redefine a mesma chave. */
  overridden: boolean;
};

/**
 * Variáveis visíveis num ponto da árvore, do escopo mais externo (global) ao
 * mais interno. Escopos internos sobrescrevem chaves de escopos externos.
 */
export function resolveVariables(path: NodePath): ResolvedVariable[] {
  const list: ResolvedVariable[] = [];
  for (const ref of path) {
    const scope = SCOPE_BY_KIND[ref.kind];
    if (!scope || !('variables' in ref.node)) continue;
    for (const variable of ref.node.variables) {
      if (!variable.key) continue;
      list.push({ variable, scope, sourceName: ref.node.name, sourceId: ref.node.id, overridden: false });
    }
  }
  const lastIndex = new Map<string, number>();
  list.forEach((r, i) => lastIndex.set(r.variable.key, i));
  return list.map((r, i) => ({ ...r, overridden: lastIndex.get(r.variable.key) !== i }));
}

/** Mapa chave → valor efetivo. */
export function variableMap(path: NodePath): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of resolveVariables(path)) map.set(r.variable.key, r.variable.value);
  return map;
}

/** Substitui {{var}} pelos valores conhecidos (recursivamente, até 5 níveis). Desconhecidas ficam intactas. */
export function interpolate(text: string, values: Map<string, string>): string {
  let out = text;
  for (let depth = 0; depth < 5; depth++) {
    const next = out.replace(REF_RE, (whole, name: string) => values.get(name) ?? whole);
    if (next === out) break;
    out = next;
  }
  return out;
}

const SCRIPT_SET_RE = /pm\.(?:environment|collectionVariables|variables|globals)\.set\(\s*['"`]([^'"`]+)['"`]/g;

/** Variáveis criadas em tempo de execução por qualquer script da collection (ex.: um token salvo no login). */
export function scriptDefinedVariables(collection: Collection): Set<string> {
  const names = new Set<string>();
  walk({ kind: 'collection', node: collection }, (ref) => {
    for (const code of [ref.node.preRequestScripts, ref.node.postRequestScripts]) {
      for (const m of code.matchAll(SCRIPT_SET_RE)) names.add(m[1]);
    }
  });
  return names;
}

/** Referências em `texts` que não estão declaradas no contexto nem criadas por script. */
export function undefinedVariables(texts: string[], path: NodePath, runtime: Set<string>): string[] {
  const known = variableMap(path);
  const missing = new Set<string>();
  for (const text of texts) {
    for (const name of extractVariableRefs(text)) {
      if (!known.has(name) && !runtime.has(name) && !isDynamicVariable(name)) missing.add(name);
    }
  }
  return [...missing];
}
