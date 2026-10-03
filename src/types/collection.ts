/**
 * Modelo de domínio da ferramenta.
 *
 * Hierarquia fixa:
 *   Collection → Folder → Scenario → TestId → Request
 *
 * Datas são guardadas como ISO strings (e não `Date`) para que o estado
 * possa ser serializado em localStorage / JSON sem conversões.
 */

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export type VariableScope = 'global' | 'folder' | 'scenario' | 'testId';
export type VariableType = 'string' | 'number' | 'boolean';

export type Variable = {
  id: string;
  key: string;
  value: string;
  type: VariableType;
  scope: VariableScope;
  description: string;
};

/** Header como lista (e não Record) para preservar ordem, permitir chaves vazias durante a edição e desabilitar itens. */
export type Header = {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
};

/** Campos comuns a todos os níveis que possuem scripts. */
export type Scripted = {
  /** JavaScript executado antes (Postman: event "prerequest"). */
  preRequestScripts: string;
  /** JavaScript executado depois (Postman: event "test"). */
  postRequestScripts: string;
};

export type Request = Scripted & {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  headers: Header[];
  /** Body cru (normalmente JSON). String vazia = sem body. */
  body: string;
};

export type TestId = Scripted & {
  id: string;
  name: string;
  description: string;
  requests: Request[];
  variables: Variable[];
};

export type Scenario = Scripted & {
  id: string;
  name: string;
  description: string;
  /** Código de até 3 letras usado nos títulos dos IDs: TC-<código>-001. */
  idCode: string;
  testIds: TestId[];
  variables: Variable[];
};

export type Folder = Scripted & {
  id: string;
  name: string;
  description: string;
  scenarios: Scenario[];
  variables: Variable[];
};

export type Collection = Scripted & {
  id: string;
  name: string;
  description: string;
  folders: Folder[];
  variables: Variable[];
  createdAt: string;
  updatedAt: string;
};

/* ------------------------------------------------------------------ */
/* Tipos auxiliares para navegar na árvore de forma genérica           */
/* ------------------------------------------------------------------ */

export type NodeKind = 'collection' | 'folder' | 'scenario' | 'testId' | 'request';

export type NodeByKind = {
  collection: Collection;
  folder: Folder;
  scenario: Scenario;
  testId: TestId;
  request: Request;
};

export type AnyNode = NodeByKind[NodeKind];

/** Referência tipada a um nó qualquer da árvore. */
export type NodeRef = { [K in NodeKind]: { kind: K; node: NodeByKind[K] } }[NodeKind];

/** Caminho da raiz até um nó (inclusive), usado em breadcrumb e resolução de variáveis. */
export type NodePath = NodeRef[];

/** Qual tipo de filho cada nível aceita. */
export const CHILD_KIND: Record<NodeKind, NodeKind | null> = {
  collection: 'folder',
  folder: 'scenario',
  scenario: 'testId',
  testId: 'request',
  request: null,
};

/** Escopo de variável associado a cada nível que pode tê-las. */
export const SCOPE_BY_KIND: Partial<Record<NodeKind, VariableScope>> = {
  collection: 'global',
  folder: 'folder',
  scenario: 'scenario',
  testId: 'testId',
};

export const KIND_LABEL: Record<NodeKind, string> = {
  collection: 'Collection',
  folder: 'Folder',
  scenario: 'Cenário',
  testId: 'ID de Teste',
  request: 'Requisição',
};
