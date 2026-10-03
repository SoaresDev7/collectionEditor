import type { Collection, Folder, Header, Request, Scenario, TestId, Variable } from '@/types/collection';
import { nowIso, uid } from './ids';

/** Cópias profundas que geram novos ids em todos os níveis. */

const cloneVariables = (vars: Variable[]): Variable[] => vars.map((v) => ({ ...v, id: uid() }));
const cloneHeaders = (headers: Header[]): Header[] => headers.map((h) => ({ ...h, id: uid() }));

export const cloneRequest = (r: Request): Request => ({ ...r, id: uid(), headers: cloneHeaders(r.headers) });

export const cloneTestId = (t: TestId): TestId => ({
  ...t,
  id: uid(),
  variables: cloneVariables(t.variables),
  requests: t.requests.map(cloneRequest),
});

export const cloneScenario = (s: Scenario): Scenario => ({
  ...s,
  id: uid(),
  variables: cloneVariables(s.variables),
  testIds: s.testIds.map(cloneTestId),
});

export const cloneFolder = (f: Folder): Folder => ({
  ...f,
  id: uid(),
  variables: cloneVariables(f.variables),
  scenarios: f.scenarios.map(cloneScenario),
});

export const cloneCollection = (c: Collection): Collection => {
  const now = nowIso();
  return {
    ...c,
    id: uid(),
    variables: cloneVariables(c.variables),
    folders: c.folders.map(cloneFolder),
    createdAt: now,
    updatedAt: now,
  };
};
