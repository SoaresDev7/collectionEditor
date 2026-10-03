import { KIND_LABEL, SCOPE_BY_KIND, type Collection, type NodeKind, type NodeRef, type VariableScope } from '@/types/collection';
import { childrenOf, findPath } from '@/lib/tree';
import { analyzeScript, findIdentifierUses, type PmAccess, type PmScope, type ScriptAnalysis } from './analysis';

/**
 * Entende os scripts da collection como o Postman os executa:
 *
 *   pré-request:  Collection → Folder → Cenário → ID → Requisição
 *   (requisição)
 *   pós-request:  Collection → Folder → Cenário → ID → Requisição
 *
 * e explica, para cada uso de variável ou função num script, de onde ela vem e
 * se estará disponível naquele ponto.
 */

export type Phase = 'pre' | 'post';

export type ScriptEntry = {
  nodeId: string;
  kind: NodeKind;
  nodeName: string;
  /** "Folder › Cenário › ID" */
  trail: string;
  phase: Phase;
  code: string;
  analysis: ScriptAnalysis;
  /** ids dos ancestrais (sem o próprio nó). */
  ancestorIds: string[];
};

export type InsightSeverity = 'info' | 'warning';

export type Insight = {
  line: number;
  column: number;
  endColumn: number;
  severity: InsightSeverity;
  /** Rótulo curto exibido no editor, ao lado do nome. */
  hint?: string;
  /** Explicação (Markdown) exibida ao passar o mouse. */
  message: string;
  /** Também vira sublinhado/aviso no editor. */
  marker?: boolean;
};

const PHASE_LABEL: Record<Phase, string> = { pre: 'pré-request', post: 'pós-request' };
const SCOPE_SHORT: Record<VariableScope, string> = { global: 'Global', folder: 'Folder', scenario: 'Cenário', testId: 'ID' };
const PM_SCOPE_LABEL: Record<PmScope, string> = {
  variables: 'local (pm.variables)',
  collectionVariables: 'collection',
  environment: 'environment',
  globals: 'globals',
  iterationData: 'dados da iteração',
};

export const describeScript = (s: Pick<ScriptEntry, 'kind' | 'nodeName' | 'phase'>) =>
  `${KIND_LABEL[s.kind]} **${s.nodeName}** (${PHASE_LABEL[s.phase]})`;

/** Todos os scripts não vazios da collection, com o caminho de cada um. */
export function collectScripts(collection: Collection): ScriptEntry[] {
  const out: ScriptEntry[] = [];
  const visit = (ref: NodeRef, ancestors: NodeRef[]) => {
    const trail = [...ancestors.slice(1), ref].map((r) => r.node.name).join(' › ') || ref.node.name;
    for (const phase of ['pre', 'post'] as const) {
      const code = phase === 'pre' ? ref.node.preRequestScripts : ref.node.postRequestScripts;
      if (code.trim())
        out.push({
          nodeId: ref.node.id,
          kind: ref.kind,
          nodeName: ref.node.name,
          trail,
          phase,
          code,
          analysis: analyzeScript(code),
          ancestorIds: ancestors.map((a) => a.node.id),
        });
    }
    for (const c of childrenOf(ref)) visit(c, [...ancestors, ref]);
  };
  visit({ kind: 'collection', node: collection }, []);
  return out;
}

export type Order = 'before' | 'sometimes' | 'never';

/**
 * Se `entry` roda antes do script alvo numa mesma execução.
 * "sometimes": depende da requisição (script de um nível abaixo do alvo).
 */
export function runsBefore(entry: Pick<ScriptEntry, 'nodeId' | 'phase' | 'ancestorIds'>, target: { nodeId: string; phase: Phase; ancestorIds: string[] }): Order {
  if (entry.nodeId === target.nodeId) return entry.phase === 'pre' && target.phase === 'post' ? 'before' : 'never';
  if (target.ancestorIds.includes(entry.nodeId)) return entry.phase === 'pre' || target.phase === 'post' ? 'before' : 'never';
  if (entry.ancestorIds.includes(target.nodeId)) return entry.phase === 'pre' && target.phase === 'post' ? 'sometimes' : 'never';
  return 'never';
}

type TableVar = { scope: VariableScope; nodeId: string; nodeName: string; kind: NodeKind; value: string; visible: boolean; disabled: boolean };

function tableVariables(collection: Collection, visibleIds: Set<string>): Map<string, TableVar[]> {
  const map = new Map<string, TableVar[]>();
  const visit = (ref: NodeRef) => {
    const scope = SCOPE_BY_KIND[ref.kind];
    if (scope && 'variables' in ref.node)
      for (const v of ref.node.variables) {
        if (!v.key) continue;
        const entry: TableVar = {
          scope,
          nodeId: ref.node.id,
          nodeName: ref.node.name,
          kind: ref.kind,
          value: v.value,
          visible: visibleIds.has(ref.node.id),
          disabled: v.extra?.disabled === true,
        };
        map.set(v.key, [...(map.get(v.key) ?? []), entry]);
      }
    childrenOf(ref).forEach(visit);
  };
  visit({ kind: 'collection', node: collection });
  return map;
}

/** Quais acessos `pm.<escopo>.get` encontram uma variável definida de cada forma. */
const tableCompatible = (v: TableVar, access: PmScope) =>
  access === 'variables' || (v.scope === 'global' && access === 'collectionVariables');
const setCompatible = (set: PmScope, access: PmScope) => access === 'variables' || set === access;

const where = (s: Pick<ScriptEntry, 'kind' | 'nodeName' | 'phase'>, line?: number) => `${describeScript(s)}${line ? `, linha ${line}` : ''}`;
const code = (s: string) => `\`${s}\``;

export type ScriptTarget = { nodeId: string; phase: Phase };

/** Insights para o script de um nó/fase, com o código atual (pode ainda não estar salvo). */
export function scriptInsights(collection: Collection, target: ScriptTarget, source: string): Insight[] {
  const path = findPath(collection, target.nodeId);
  if (!path) return [];
  const ancestorIds = path.slice(0, -1).map((r) => r.node.id);
  const visibleIds = new Set(path.map((r) => r.node.id));
  const self = { nodeId: target.nodeId, phase: target.phase, ancestorIds };
  const all = collectScripts(collection).filter((s) => !(s.nodeId === target.nodeId && s.phase === target.phase));
  const current = analyzeScript(source);
  const tables = tableVariables(collection, visibleIds);
  const insights: Insight[] = [];

  // ---- Variáveis do Postman -------------------------------------------------
  const sets = new Map<string, { entry: ScriptEntry; access: PmAccess; order: Order }[]>();
  for (const entry of all)
    for (const a of entry.analysis.pmAccesses)
      if (a.op === 'set') sets.set(a.name, [...(sets.get(a.name) ?? []), { entry, access: a, order: runsBefore(entry, self) }]);

  for (const a of current.pmAccesses) {
    const range = { line: a.line, column: a.column, endColumn: a.endColumn };
    if (a.op === 'set' || a.op === 'unset') {
      insights.push({
        ...range,
        severity: 'info',
        hint: a.op === 'set' ? `→ ${a.scope === 'variables' ? 'local' : PM_SCOPE_LABEL[a.scope]}` : undefined,
        message:
          a.scope === 'variables'
            ? `${code(a.name)} é gravada no escopo **local** (pm.variables): vale só durante esta requisição, para os scripts que rodam depois deste.`
            : `${code(a.name)} é gravada no escopo **${PM_SCOPE_LABEL[a.scope]}** e continua disponível nas próximas requisições da execução.`,
      });
      continue;
    }

    const defs = tables.get(a.name) ?? [];
    const scriptSets = sets.get(a.name) ?? [];
    const earlierHere = current.pmAccesses.some((x) => x.op === 'set' && x.name === a.name && x.line < a.line && setCompatible(x.scope, a.scope));
    const visibleDefs = defs.filter((d) => d.visible && !d.disabled);
    const okDefs = visibleDefs.filter((d) => tableCompatible(d, a.scope));
    const okSets = scriptSets.filter(
      (s) => setCompatible(s.access.scope, a.scope) && (s.access.scope !== 'variables' || s.order !== 'never'),
    );

    const lines: string[] = [];
    for (const d of defs)
      lines.push(
        `- ${SCOPE_SHORT[d.scope]}: ${KIND_LABEL[d.kind]} **${d.nodeName}** = ${code(d.value || '∅')}${d.disabled ? ' _(desativada)_' : ''}${d.visible ? '' : ' — _fora do alcance deste script_'}`,
      );
    for (const s of scriptSets)
      lines.push(
        `- Script ${PM_SCOPE_LABEL[s.access.scope]}: ${where(s.entry, s.access.line)}${
          s.access.scope === 'variables' && s.order === 'never' ? ' — _não roda antes deste script_' : s.order === 'sometimes' ? ' — _roda antes só para algumas requisições_' : ''
        }`,
      );
    if (earlierHere) lines.push('- Neste script, numa linha anterior');
    const origin = lines.length ? `\n\n**Definida em:**\n${lines.join('\n')}` : '';

    if (okDefs.length || okSets.length || earlierHere) {
      const best = okDefs.at(-1);
      insights.push({
        ...range,
        severity: 'info',
        hint: best ? SCOPE_SHORT[best.scope] : earlierHere ? 'neste script' : `script: ${okSets[0].entry.nodeName}`,
        message: `${code(a.name)} está disponível aqui.${origin}`,
      });
    } else if (visibleDefs.length) {
      const d = visibleDefs.at(-1)!;
      const advice = d.scope === 'global' ? `pm.collectionVariables.get('${a.name}') ou pm.variables.get('${a.name}')` : `pm.variables.get('${a.name}')`;
      insights.push({
        ...range,
        severity: 'warning',
        marker: true,
        hint: `⚠ ${SCOPE_SHORT[d.scope]}`,
        message:
          `${code(a.name)} é variável de **${SCOPE_SHORT[d.scope]}**` +
          (d.scope === 'global' ? ' (variável da collection)' : ' (exportada como pm.variables.set, escopo local)') +
          `, e **pm.${a.scope}** não a encontra. Use ${code(advice)}.${origin}`,
      });
    } else if (defs.length || scriptSets.length) {
      insights.push({
        ...range,
        severity: 'warning',
        marker: true,
        hint: '⚠ fora do alcance',
        message: `${code(a.name)} existe na collection, mas não está disponível neste ponto.${origin}`,
      });
    } else {
      const external = a.scope === 'environment' || a.scope === 'globals' || a.scope === 'iterationData';
      insights.push({
        ...range,
        severity: external ? 'info' : 'warning',
        marker: !external,
        hint: external ? `externa (${a.scope})` : '⚠ não definida',
        message: external
          ? `${code(a.name)} não é definida na collection; deve vir de ${a.scope === 'iterationData' ? 'um arquivo de dados do Runner' : `um ${a.scope === 'environment' ? 'environment' : 'globals'} do Postman`}.`
          : `${code(a.name)} não é definida em nenhum lugar da collection (pode vir de um environment do Postman).`,
      });
    }
  }

  // ---- Funções e variáveis JavaScript entre scripts ------------------------
  const declarations = new Map<string, { entry: ScriptEntry; kind: 'local' | 'shared'; keyword: string; line: number; order: Order }[]>();
  for (const entry of all)
    for (const d of entry.analysis.declarations)
      declarations.set(d.name, [...(declarations.get(d.name) ?? []), { entry, kind: d.kind, keyword: d.keyword, line: d.line, order: runsBefore(entry, self) }]);

  const foreignNames = [...declarations.keys()].filter((n) => !current.declaredNames.has(n));
  for (const use of findIdentifierUses(current, source, foreignNames)) {
    const decls = declarations.get(use.name)!;
    const range = { line: use.line, column: use.column, endColumn: use.endColumn };
    const shared = decls.filter((d) => d.kind === 'shared');
    const available = shared.filter((d) => d.order !== 'never');
    const list = decls.map((d) => `- ${d.kind === 'shared' ? 'Compartilhada' : `Local (${code(d.keyword)})`}: ${where(d.entry, d.line)}`).join('\n');

    if (available.length) {
      const d = available[0];
      insights.push({
        ...range,
        severity: 'info',
        hint: `⇠ ${KIND_LABEL[d.entry.kind]} ${PHASE_LABEL[d.entry.phase]}`,
        message: `${code(use.name)} vem de um script que roda antes deste.${d.order === 'sometimes' ? ' _(Só para algumas requisições.)_' : ''}\n\n${list}`,
      });
    } else if (shared.length) {
      insights.push({
        ...range,
        severity: 'warning',
        marker: true,
        hint: '⚠ roda depois',
        message: `${code(use.name)} é compartilhada, mas o script que a define **não roda antes deste**. Ordem do Postman: pré-request da Collection → Folder → Cenário → ID → Requisição; depois os pós-request na mesma ordem.\n\n${list}`,
      });
    } else {
      const d = decls[0];
      insights.push({
        ...range,
        severity: 'warning',
        marker: true,
        hint: '⚠ local de outro script',
        message:
          `${code(use.name)} foi declarada com ${code(d.keyword)} em ${where(d.entry, d.line)}. ` +
          `No Postman cada script roda isolado: declarações com function/const/let/var **não** ficam visíveis em outros scripts.\n\n` +
          `Para reutilizar, declare-a como **compartilhada** num nível acima (ex.: pré-request da Collection), sem const/let/function:\n\n` +
          '```js\n' +
          `${use.name} = function (/* parâmetros */) {\n  // ...\n};\n` +
          '```\n\n' +
          `Ou digite ${code('shared')} no editor para inserir o modelo.\n\n${list}`,
      });
    }
  }

  // ---- Declarações deste script ---------------------------------------------
  for (const d of current.declarations) {
    const range = { line: d.line, column: d.column, endColumn: d.column + d.name.length };
    if (d.kind === 'shared') {
      const users = all.filter((s) => runsBefore(self, s) !== 'never' && !s.analysis.declaredNames.has(d.name) && findIdentifierUses(s.analysis, s.code, [d.name]).length);
      insights.push({
        ...range,
        severity: 'info',
        hint: 'compartilhada',
        message:
          `${code(d.name)} é **compartilhada**: fica disponível para os scripts que rodam depois deste na mesma requisição.` +
          (users.length ? `\n\n**Usada em:**\n${users.map((u) => `- ${where(u)}`).join('\n')}` : ''),
      });
    } else if (d.keyword.startsWith('function')) {
      const elsewhere = all.filter((s) => !s.analysis.declaredNames.has(d.name) && findIdentifierUses(s.analysis, s.code, [d.name]).length);
      insights.push({
        ...range,
        severity: elsewhere.length ? 'warning' : 'info',
        marker: elsewhere.length > 0,
        hint: 'só neste script',
        message:
          `${code(d.name)} é **local**: só existe dentro deste script.` +
          (elsewhere.length
            ? `\n\nOutros scripts chamam ${code(d.name)} e não vão encontrá-la:\n${elsewhere.map((u) => `- ${where(u)}`).join('\n')}\n\nPara compartilhar: ${code(`${d.name} = function (...) { ... };`)}`
            : ''),
      });
    }
  }

  return insights.sort((x, y) => x.line - y.line || x.column - y.column);
}

export type ChainStep = {
  nodeId: string;
  kind: NodeKind;
  nodeName: string;
  phase: Phase;
  code: string;
  lines: number;
  shared: string[];
  locals: string[];
  sets: { name: string; scope: PmScope }[];
  reads: string[];
  warnings: number;
};

/** Ordem de execução dos scripts de uma requisição, com o resumo de cada um. */
export function executionChain(collection: Collection, requestId: string): ChainStep[] {
  const path = findPath(collection, requestId);
  if (!path) return [];
  const steps: ChainStep[] = [];
  for (const phase of ['pre', 'post'] as const)
    for (const ref of path) {
      const src = phase === 'pre' ? ref.node.preRequestScripts : ref.node.postRequestScripts;
      if (!src.trim()) continue;
      const a = analyzeScript(src);
      steps.push({
        nodeId: ref.node.id,
        kind: ref.kind,
        nodeName: ref.node.name,
        phase,
        code: src,
        lines: src.split('\n').length,
        shared: a.declarations.filter((d) => d.kind === 'shared').map((d) => d.name),
        locals: a.declarations.filter((d) => d.kind === 'local' && d.keyword.startsWith('function')).map((d) => d.name),
        sets: a.pmAccesses.filter((x) => x.op === 'set').map((x) => ({ name: x.name, scope: x.scope })),
        reads: [...new Set(a.pmAccesses.filter((x) => x.op === 'get' || x.op === 'ref').map((x) => x.name))],
        warnings: scriptInsights(collection, { nodeId: ref.node.id, phase }, src).filter((i) => i.severity === 'warning').length,
      });
    }
  return steps;
}
