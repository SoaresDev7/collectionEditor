import type { Folder, NodeRef, Scenario, TestId } from '@/types/collection';

/**
 * Contêineres sintéticos: criados na importação só para encaixar requisições
 * na hierarquia (não existem como pasta no Postman).
 *
 * Um contêiner continua "transparente" (não vira pasta na exportação) somente
 * enquanto o usuário não lhe der identidade: se for renomeado, duplicado ou
 * receber descrição, scripts ou variáveis, passa a ser exportado como pasta.
 */

export const SYNTHETIC_FOLDER_NAME = '(requisições na raiz)';
export const SYNTHETIC_SCENARIO_NAME = '(requisições sem pasta)';

type Group = Folder | Scenario | TestId;

/** Nome automático que o contêiner recebeu (dados antigos sem `syntheticName` usam a regra da importação). */
function autoName(kind: 'folder' | 'scenario' | 'testId', g: Group): string | undefined {
  if (g.syntheticName !== undefined) return g.syntheticName;
  if (kind === 'folder') return SYNTHETIC_FOLDER_NAME;
  if (kind === 'scenario') return SYNTHETIC_SCENARIO_NAME;
  const t = g as TestId;
  return t.requests.length === 1 ? t.requests[0].name : undefined;
}

export function isTransparent(kind: 'folder' | 'scenario' | 'testId', g: Group): boolean {
  return (
    !!g.synthetic &&
    g.name === autoName(kind, g) &&
    !g.description &&
    !g.preRequestScripts.trim() &&
    !g.postRequestScripts.trim() &&
    !g.variables.length
  );
}

export const isTransparentRef = (ref: NodeRef): boolean =>
  (ref.kind === 'folder' || ref.kind === 'scenario' || ref.kind === 'testId') && isTransparent(ref.kind, ref.node);
