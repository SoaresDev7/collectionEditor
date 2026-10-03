import type { Collection, NodeKind, NodeRef } from '@/types/collection';
import { childrenOf } from './tree';

/**
 * Busca de usos na collection inteira: texto livre, variáveis ({{var}} e
 * pm.*.get/set) e funções declaradas nos scripts de pré/pós-request.
 */

export type SearchMode = 'text' | 'variable' | 'function';

export type SearchField = 'name' | 'description' | 'url' | 'header' | 'body' | 'pre' | 'post' | 'variable';

export const FIELD_LABEL: Record<SearchField, string> = {
  name: 'Nome',
  description: 'Descrição',
  url: 'URL',
  header: 'Header',
  body: 'Body',
  pre: 'Pré-request',
  post: 'Pós-request',
  variable: 'Variáveis',
};

export type SearchTag = 'declaração' | 'definição' | 'leitura' | 'escrita' | 'remoção' | 'uso';

export type SearchHit = {
  nodeId: string;
  kind: NodeKind;
  /** "Folder › Cenário › ID › Requisição" */
  trail: string;
  name: string;
  field: SearchField;
  /** Linha (1-based) em campos de várias linhas. */
  line?: number;
  snippet: string;
  tag?: SearchTag;
};

export type SearchOptions = { mode: SearchMode; query: string; caseSensitive?: boolean; limit?: number };

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

type FieldText = { field: SearchField; text: string };

function fieldsOf(ref: NodeRef): FieldText[] {
  const n = ref.node;
  const out: FieldText[] = [{ field: 'name', text: n.name }];
  if ('description' in n) out.push({ field: 'description', text: n.description });
  if (ref.kind === 'request') {
    out.push({ field: 'url', text: ref.node.url });
    for (const h of ref.node.headers) if (h.key) out.push({ field: 'header', text: `${h.key}: ${h.value}` });
    out.push({ field: 'body', text: ref.node.body });
  }
  if ('variables' in n) for (const v of n.variables) if (v.key) out.push({ field: 'variable', text: `${v.key} = ${v.value}` });
  out.push({ field: 'pre', text: n.preRequestScripts }, { field: 'post', text: n.postRequestScripts });
  return out;
}

const isScript = (f: SearchField) => f === 'pre' || f === 'post';

/** Classifica uma linha que contém a variável. */
function variableMatcher(name: string) {
  const v = escape(name);
  const ref = new RegExp(`\\{\\{\\s*${v}\\s*\\}\\}`);
  const pmCall = new RegExp(`pm\\.(?:variables|environment|collectionVariables|globals|iterationData)\\.(get|set|unset|has)\\(\\s*['"\`]${v}['"\`]`);
  return (field: SearchField, line: string): SearchTag | null => {
    if (field === 'variable') return line.startsWith(`${name} =`) ? 'declaração' : null;
    if (isScript(field)) {
      const m = pmCall.exec(line);
      if (m) return m[1] === 'set' ? 'escrita' : m[1] === 'unset' ? 'remoção' : 'leitura';
    }
    return ref.test(line) ? 'uso' : null;
  };
}

/** Classifica uma linha de script que contém o identificador. */
function functionMatcher(name: string) {
  const f = escape(name);
  const word = new RegExp(`(^|[^\\w$])${f}(?![\\w$])`);
  const definition = new RegExp(
    `(?:function\\s*\\*?\\s*${f}\\s*\\(|(?:const|let|var)\\s+${f}\\s*=|(?:^|[\\s,{])${f}\\s*:\\s*(?:async\\s*)?(?:function|\\(|[\\w$]+\\s*=>)|(?:^|\\s)(?:async\\s+)?${f}\\s*\\([^)]*\\)\\s*\\{)`,
  );
  return (field: SearchField, line: string): SearchTag | null => {
    if (!isScript(field) || !word.test(line)) return null;
    return definition.test(line) ? 'definição' : 'uso';
  };
}

export function searchCollection(collection: Collection, opts: SearchOptions): SearchHit[] {
  const query = opts.query.trim();
  if (!query) return [];
  const limit = opts.limit ?? 500;
  const name = query.replace(/^\{\{\s*|\s*\}\}$/g, '');
  const needle = opts.caseSensitive ? query : query.toLowerCase();

  const classify =
    opts.mode === 'variable'
      ? variableMatcher(name)
      : opts.mode === 'function'
        ? functionMatcher(name)
        : (_f: SearchField, line: string): SearchTag | null =>
            (opts.caseSensitive ? line : line.toLowerCase()).includes(needle) ? 'uso' : null;

  const hits: SearchHit[] = [];
  const visit = (ref: NodeRef, trail: string[]) => {
    if (hits.length >= limit) return;
    const own = ref.kind === 'collection' ? [ref.node.name] : [...trail, ref.node.name];
    for (const { field, text } of fieldsOf(ref)) {
      if (!text) continue;
      const lines = text.split('\n');
      lines.forEach((line, i) => {
        if (hits.length >= limit) return;
        const tag = classify(field, line);
        if (!tag) return;
        hits.push({
          nodeId: ref.node.id,
          kind: ref.kind,
          trail: own.join(' › '),
          name: ref.node.name,
          field,
          line: lines.length > 1 || isScript(field) || field === 'body' ? i + 1 : undefined,
          snippet: line.trim().slice(0, 160),
          tag: opts.mode === 'text' ? undefined : tag,
        });
      });
    }
    for (const c of childrenOf(ref)) visit(c, ref.kind === 'collection' ? [] : own);
  };
  visit({ kind: 'collection', node: collection }, []);
  return hits;
}

const FUNCTION_DEF_RE = /function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/g;

/** Nomes de funções declaradas em qualquer script (para autocompletar). */
export function declaredFunctions(collection: Collection): string[] {
  const names = new Set<string>();
  const visit = (ref: NodeRef) => {
    for (const code of [ref.node.preRequestScripts, ref.node.postRequestScripts])
      for (const m of code.matchAll(FUNCTION_DEF_RE)) names.add(m[1] ?? m[2]);
    childrenOf(ref).forEach(visit);
  };
  visit({ kind: 'collection', node: collection });
  return [...names].sort();
}
