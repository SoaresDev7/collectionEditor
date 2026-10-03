import type * as Monaco from 'monaco-editor';
import { useCollectionStore } from '@/store/collectionStore';
import { scriptInsights, collectScripts, type Insight, type Phase } from '@/lib/scripts/insights';
import { childrenOf } from '@/lib/tree';
import { SCOPE_BY_KIND, KIND_LABEL, type Collection, type NodeRef } from '@/types/collection';

/**
 * Integra a análise de escopo aos editores de script (pré/pós-request):
 * - rótulos ao lado de cada variável/função dizendo de onde vêm (inlay hints);
 * - explicação ao passar o mouse;
 * - sublinhado amarelo nos usos que não vão funcionar no Postman;
 * - autocomplete de nomes em pm.*.get('…') e snippets de função compartilhada.
 *
 * Os modelos dos scripts usam o caminho "<id do nó>/<pre|post>.js".
 */

const OWNER = 'escopo';
const PATH_RE = /([^/]+)\/(pre|post)\.js$/;

const activeCollection = (): Collection | undefined => {
  const s = useCollectionStore.getState();
  return s.collections.find((c) => c.id === s.activeCollectionId);
};

const targetOf = (model: Monaco.editor.ITextModel) => {
  const m = PATH_RE.exec(model.uri.path);
  return m ? { nodeId: m[1], phase: m[2] as Phase } : null;
};

/** Cache por versão do modelo e da collection. */
const cache = new WeakMap<Monaco.editor.ITextModel, { key: string; insights: Insight[] }>();

function insightsFor(model: Monaco.editor.ITextModel): Insight[] {
  const target = targetOf(model);
  const collection = activeCollection();
  if (!target || !collection) return [];
  const key = `${model.getVersionId()}:${collection.updatedAt}`;
  const hit = cache.get(model);
  if (hit?.key === key) return hit.insights;
  const insights = scriptInsights(collection, target, model.getValue());
  cache.set(model, { key, insights });
  return insights;
}

/** Nomes conhecidos para o autocomplete de pm.*.get('…'), com a origem. */
function knownVariables(collection: Collection): Map<string, string> {
  const names = new Map<string, string>();
  const visit = (ref: NodeRef) => {
    const scope = SCOPE_BY_KIND[ref.kind];
    if (scope && 'variables' in ref.node)
      for (const v of ref.node.variables) if (v.key && !names.has(v.key)) names.set(v.key, `${KIND_LABEL[ref.kind]}: ${ref.node.name}`);
    childrenOf(ref).forEach(visit);
  };
  visit({ kind: 'collection', node: collection });
  for (const s of collectScripts(collection))
    for (const a of s.analysis.pmAccesses)
      if (a.op === 'set' && !names.has(a.name)) names.set(a.name, `definida por script em ${s.nodeName}`);
  return names;
}

const SNIPPETS = [
  {
    label: 'shared',
    detail: 'Função compartilhada entre scripts',
    documentation:
      'Cria uma função visível para os scripts que rodam depois deste (ex.: defina no pré-request da Collection e use em qualquer requisição). No Postman, `function nome()` / `const nome` ficam presos ao script onde foram declarados.',
    insertText: '// Compartilhada: disponível para os scripts que rodam depois deste.\n${1:nomeDaFuncao} = function (${2:parametros}) {\n\t$0\n};',
  },
  {
    label: 'shared-utils',
    detail: 'Objeto de utilidades compartilhado',
    documentation: 'Agrupa várias funções num objeto compartilhado sem sobrescrever o que já foi definido em níveis acima.',
    insertText:
      '// Compartilhado: disponível para os scripts que rodam depois deste.\nutils = Object.assign(typeof utils === \'object\' ? utils : {}, {\n\t${1:nomeDaFuncao}(${2:parametros}) {\n\t\t$0\n\t},\n});',
  },
  {
    label: 'var-local',
    detail: 'Ler variável local/de nível (pm.variables)',
    documentation: 'pm.variables.get enxerga todos os escopos: local, dados, environment, collection e globals.',
    insertText: "pm.variables.get('${1:nome}')",
  },
];

export function registerScopeProviders(monaco: typeof Monaco) {
  const hintsChanged = new monaco.Emitter<void>();

  monaco.languages.registerInlayHintsProvider('javascript', {
    onDidChangeInlayHints: hintsChanged.event,
    provideInlayHints(model) {
      const hints = insightsFor(model)
        .filter((i) => i.hint)
        .map((i) => ({
          position: { lineNumber: i.line, column: i.endColumn + (model.getLineContent(i.line)[i.endColumn - 1]?.match(/['"`]/) ? 1 : 0) },
          label: i.hint!,
          paddingLeft: true,
          tooltip: { value: i.message },
        }));
      return { hints, dispose() {} };
    },
  });

  monaco.languages.registerHoverProvider('javascript', {
    provideHover(model, position) {
      const found = insightsFor(model).filter(
        (i) => i.line === position.lineNumber && position.column >= i.column && position.column <= i.endColumn,
      );
      if (!found.length) return null;
      const i = found[0];
      return {
        range: new monaco.Range(i.line, i.column, i.line, i.endColumn),
        contents: [{ value: i.message }],
      };
    },
  });

  monaco.languages.registerCompletionItemProvider('javascript', {
    triggerCharacters: ["'", '"', '`'],
    provideCompletionItems(model, position) {
      const before = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
      const call = /pm\.(\w+)\.(get|set|unset|has)\(\s*['"`]([\w.$-]*)$/.exec(before);
      const word = model.getWordUntilPosition(position);
      const wordRange = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
      if (call) {
        const collection = activeCollection();
        if (!collection) return { suggestions: [] };
        const range = new monaco.Range(position.lineNumber, position.column - call[3].length, position.lineNumber, position.column);
        return {
          suggestions: [...knownVariables(collection)].map(([name, origin]) => ({
            label: name,
            detail: origin,
            kind: monaco.languages.CompletionItemKind.Variable,
            insertText: name,
            range,
          })),
        };
      }
      return {
        suggestions: SNIPPETS.map((s) => ({
          label: s.label,
          detail: s.detail,
          documentation: { value: s.documentation },
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: s.insertText,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range: wordRange,
        })),
      };
    },
  });

  /** Sublinhados (markers) nos usos problemáticos. */
  const refreshMarkers = (model: Monaco.editor.ITextModel) => {
    if (!targetOf(model) || model.isDisposed()) return;
    monaco.editor.setModelMarkers(
      model,
      OWNER,
      insightsFor(model)
        .filter((i) => i.marker)
        .map((i) => ({
          severity: monaco.MarkerSeverity.Warning,
          message: i.message.replace(/\*\*|`|_/g, '').replace(/```js\n?|```/g, ''),
          startLineNumber: i.line,
          startColumn: i.column,
          endLineNumber: i.line,
          endColumn: i.endColumn,
          source: 'escopo',
        })),
    );
  };

  const timers = new WeakMap<Monaco.editor.ITextModel, ReturnType<typeof setTimeout>>();
  const schedule = (model: Monaco.editor.ITextModel) => {
    clearTimeout(timers.get(model));
    timers.set(model, setTimeout(() => refreshMarkers(model), 300));
  };

  monaco.editor.onDidCreateModel((model) => {
    if (!targetOf(model)) return;
    schedule(model);
    model.onDidChangeContent(() => schedule(model));
  });

  // Mudanças em outros scripts/variáveis afetam a análise dos editores abertos.
  let pending: ReturnType<typeof setTimeout> | undefined;
  useCollectionStore.subscribe(() => {
    clearTimeout(pending);
    pending = setTimeout(() => {
      for (const model of monaco.editor.getModels()) if (targetOf(model)) refreshMarkers(model);
      hintsChanged.fire();
    }, 400);
  });
}
