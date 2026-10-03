import type { NodePath } from '@/types/collection';
import type { DocTemplate, TemplateLevel } from '@/types/template';
import { nearest } from './tree';
import { uid, nowIso } from './ids';

export type Placeholder = { key: string; description: string; levels: TemplateLevel[] };

/** Placeholders disponíveis em cada nível. */
export const PLACEHOLDERS: Placeholder[] = [
  { key: 'nome', description: 'Nome do item', levels: ['folder', 'scenario', 'testId'] },
  { key: 'descricaoAtual', description: 'Descrição atual do item', levels: ['folder', 'scenario', 'testId'] },
  { key: 'collection', description: 'Nome da collection', levels: ['folder', 'scenario', 'testId'] },
  { key: 'folder', description: 'Nome do folder', levels: ['folder', 'scenario', 'testId'] },
  { key: 'cenario', description: 'Nome do cenário', levels: ['scenario', 'testId'] },
  { key: 'codigo', description: 'Código do cenário (ex.: LCV)', levels: ['scenario', 'testId'] },
  { key: 'id', description: 'Título do ID (ex.: TC-LCV-001)', levels: ['testId'] },
  { key: 'qtdCenarios', description: 'Quantidade de cenários', levels: ['folder'] },
  { key: 'qtdIds', description: 'Quantidade de IDs', levels: ['folder', 'scenario'] },
  { key: 'listaIds', description: 'Lista dos IDs (um por linha)', levels: ['scenario'] },
  { key: 'requisicoes', description: 'Lista "MÉTODO URL" das requisições', levels: ['testId'] },
  { key: 'data', description: 'Data atual', levels: ['folder', 'scenario', 'testId'] },
];

export const placeholdersFor = (level: TemplateLevel) => PLACEHOLDERS.filter((p) => p.levels.includes(level));

/** Valores dos placeholders para o item no fim do caminho. */
export function templateContext(path: NodePath): Record<string, string> {
  const ref = path[path.length - 1];
  const folder = nearest(path, 'folder')?.node;
  const scenario = nearest(path, 'scenario')?.node;
  const ctx: Record<string, string> = {
    nome: ref.node.name,
    descricaoAtual: 'description' in ref.node ? ref.node.description : '',
    collection: path[0].node.name,
    folder: folder?.name ?? '',
    cenario: scenario?.name ?? '',
    codigo: scenario?.idCode ?? '',
    data: new Date().toLocaleDateString(),
  };
  if (ref.kind === 'folder') {
    ctx.qtdCenarios = String(ref.node.scenarios.length);
    ctx.qtdIds = String(ref.node.scenarios.reduce((n, s) => n + s.testIds.length, 0));
  }
  if (ref.kind === 'scenario') {
    ctx.qtdIds = String(ref.node.testIds.length);
    ctx.listaIds = ref.node.testIds.map((t) => `- ${t.name}${t.description ? `: ${t.description}` : ''}`).join('\n');
  }
  if (ref.kind === 'testId') {
    ctx.id = ref.node.name;
    ctx.requisicoes = ref.node.requests.map((r) => `- ${r.method} ${r.url}`).join('\n');
  }
  return ctx;
}

/** Substitui [[campo]] pelos valores; placeholders desconhecidos ficam intactos. */
export const renderTemplate = (content: string, ctx: Record<string, string>): string =>
  content.replace(/\[\[\s*(\w+)\s*\]\]/g, (whole, key: string) => ctx[key] ?? whole);

const tpl = (level: TemplateLevel, name: string, content: string): DocTemplate => {
  const now = nowIso();
  return { id: uid(), name, level, content, isDefault: true, createdAt: now, updatedAt: now };
};

/** Templates iniciais; serão substituídos pelos modelos oficiais do time. */
export const defaultTemplates = (): DocTemplate[] => [
  tpl('folder', 'Folder padrão', '## [[nome]]\n\n**Contexto:** [[descricaoAtual]]\n\n- Cenários: [[qtdCenarios]]\n- IDs: [[qtdIds]]\n'),
  tpl('scenario', 'Cenário padrão', '## [[codigo]] · [[nome]]\n\n**Objetivo:** [[descricaoAtual]]\n\n### IDs\n[[listaIds]]\n'),
  tpl(
    'testId',
    'ID padrão',
    '### [[id]]\n\n**Cenário:** [[cenario]]\n\n**Pré-condições:**\n- \n\n**Passos:**\n[[requisicoes]]\n\n**Resultado esperado:** [[descricaoAtual]]\n',
  ),
];
