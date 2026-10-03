import type { Collection, Folder, Header, PostmanRaw, Request, Scenario, TestId, Variable } from '@/types/collection';
import { nowIso, uid } from './ids';

/** Cópias profundas que geram novos ids em todos os níveis. */

/** Dados originais do Postman sem o `id` do item (a cópia é um item novo para o Postman). */
const withoutPostmanId = (raw: PostmanRaw | undefined): PostmanRaw | undefined => {
  if (!raw) return raw;
  const { id: _id, ...rest } = raw;
  return rest;
};

const cloneVariables = (vars: Variable[]): Variable[] => vars.map((v) => ({ ...v, id: uid() }));
const cloneHeaders = (headers: Header[]): Header[] => headers.map((h) => ({ ...h, id: uid() }));

export const cloneRequest = (r: Request): Request => ({
  ...r,
  id: uid(),
  headers: cloneHeaders(r.headers),
  postman: withoutPostmanId(r.postman),
});

export const cloneTestId = (t: TestId): TestId => ({
  ...t,
  id: uid(),
  variables: cloneVariables(t.variables),
  requests: t.requests.map(cloneRequest),
  postman: withoutPostmanId(t.postman),
  subfolders: t.subfolders && Object.fromEntries(Object.entries(t.subfolders).map(([k, v]) => [k, withoutPostmanId(v)!])),
});

export const cloneScenario = (s: Scenario): Scenario => ({
  ...s,
  id: uid(),
  variables: cloneVariables(s.variables),
  testIds: s.testIds.map(cloneTestId),
  postman: withoutPostmanId(s.postman),
});

export const cloneFolder = (f: Folder): Folder => ({
  ...f,
  id: uid(),
  variables: cloneVariables(f.variables),
  scenarios: f.scenarios.map(cloneScenario),
  postman: withoutPostmanId(f.postman),
});

export const cloneCollection = (c: Collection): Collection => {
  const now = nowIso();
  const info = c.postman?.info as PostmanRaw | undefined;
  return {
    ...c,
    id: uid(),
    variables: cloneVariables(c.variables),
    folders: c.folders.map(cloneFolder),
    postman: c.postman && { ...c.postman, info: info && { ...info, _postman_id: undefined } },
    createdAt: now,
    updatedAt: now,
  };
};
