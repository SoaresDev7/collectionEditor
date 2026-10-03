import type {
  Collection,
  Folder,
  Header,
  HttpMethod,
  Request,
  Scenario,
  TestId,
  Variable,
  VariableScope,
} from '@/types/collection';
import { nowIso, uid } from './ids';
import { suggestIdCode } from './nomenclature';

const scripts = () => ({ preRequestScripts: '', postRequestScripts: '' });

export const createVariable = (scope: VariableScope, partial: Partial<Variable> = {}): Variable => ({
  id: uid(),
  key: '',
  value: '',
  type: 'string',
  description: '',
  ...partial,
  scope,
});

export const createHeader = (partial: Partial<Header> = {}): Header => ({
  id: uid(),
  key: '',
  value: '',
  enabled: true,
  ...partial,
});

export const createRequest = (partial: Partial<Request> = {}): Request => ({
  id: uid(),
  name: 'Nova requisição',
  method: 'GET' as HttpMethod,
  url: '{{baseUrl}}/',
  headers: [],
  body: '',
  ...scripts(),
  ...partial,
});

export const createTestId = (partial: Partial<TestId> = {}): TestId => ({
  id: uid(),
  name: 'TC-CEN-001',
  description: '',
  requests: [],
  variables: [],
  ...scripts(),
  ...partial,
});

export const createScenario = (partial: Partial<Scenario> = {}): Scenario => {
  const name = partial.name ?? 'Novo cenário';
  return {
    id: uid(),
    name,
    description: '',
    idCode: suggestIdCode(name),
    testIds: [],
    variables: [],
    ...scripts(),
    ...partial,
  };
};

export const createFolder = (partial: Partial<Folder> = {}): Folder => ({
  id: uid(),
  name: 'Novo folder',
  description: '',
  scenarios: [],
  variables: [],
  ...scripts(),
  ...partial,
});

export const createCollection = (partial: Partial<Collection> = {}): Collection => {
  const now = nowIso();
  return {
    id: uid(),
    name: 'Nova collection',
    description: '',
    folders: [],
    variables: [createVariable('global', { key: 'baseUrl', value: 'https://api.example.com' })],
    ...scripts(),
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
};
