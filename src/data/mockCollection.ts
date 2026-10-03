import type { Collection } from '@/types/collection';
import {
  createCollection,
  createFolder,
  createHeader,
  createRequest,
  createScenario,
  createTestId,
  createVariable,
} from '@/lib/factories';

const jsonHeaders = () => [
  createHeader({ key: 'Content-Type', value: 'application/json' }),
  createHeader({ key: 'Authorization', value: 'Bearer {{accessToken}}' }),
];

/** Collection de exemplo carregada na primeira execução. */
export function buildMockCollection(): Collection {
  return createCollection({
    name: 'API de Usuários - Testes',
    description: 'Roteiro de testes funcionais da API de usuários e autenticação.',
    variables: [
      createVariable('global', { key: 'baseUrl', value: 'https://api.example.com/v1', description: 'URL base da API' }),
      createVariable('global', { key: 'timeoutMs', value: '5000', type: 'number' }),
    ],
    preRequestScripts: "// Executa antes de TODAS as requisições\npm.variables.set('requestStartedAt', Date.now());\n",
    postRequestScripts:
      "// Executa depois de TODAS as requisições\npm.test('Tempo de resposta aceitável', () => {\n  pm.expect(pm.response.responseTime).to.be.below(Number(pm.variables.get('timeoutMs')));\n});\n",
    folders: [
      createFolder({
        name: 'Autenticação',
        description: 'Login, refresh e logout de usuários.',
        variables: [createVariable('folder', { key: 'authPath', value: '/auth' })],
        scenarios: [
          createScenario({
            name: 'Login com credenciais válidas',
            idCode: 'LCV',
            description: 'Usuário existente autentica e recebe tokens.',
            variables: [createVariable('scenario', { key: 'username', value: 'qa.user@example.com' })],
            testIds: [
              createTestId({
                name: 'TC-LCV-001',
                description: 'Deve retornar 200 e um accessToken.',
                requests: [
                  createRequest({
                    name: 'POST login',
                    method: 'POST',
                    url: '{{baseUrl}}{{authPath}}/login',
                    headers: [createHeader({ key: 'Content-Type', value: 'application/json' })],
                    body: '{\n  "username": "{{username}}",\n  "password": "{{password}}"\n}',
                    postRequestScripts:
                      "pm.test('Status 200', () => pm.response.to.have.status(200));\nconst body = pm.response.json();\npm.collectionVariables.set('accessToken', body.accessToken);\n",
                  }),
                ],
                variables: [createVariable('testId', { key: 'password', value: 'S3nh@Forte' })],
              }),
              createTestId({
                name: 'TC-LCV-002',
                description: 'Deve retornar refreshToken válido.',
                requests: [
                  createRequest({
                    name: 'POST refresh',
                    method: 'POST',
                    url: '{{baseUrl}}{{authPath}}/refresh',
                    headers: jsonHeaders(),
                    body: '{\n  "refreshToken": "{{refreshToken}}"\n}',
                  }),
                ],
              }),
            ],
          }),
          createScenario({
            name: 'Login com credenciais inválidas',
            idCode: 'LCI',
            description: 'Senha errada ou usuário inexistente devem ser rejeitados.',
            testIds: [
              createTestId({
                name: 'TC-LCI-001',
                description: 'Senha incorreta deve retornar 401.',
                requests: [
                  createRequest({
                    name: 'POST login senha errada',
                    method: 'POST',
                    url: '{{baseUrl}}{{authPath}}/login',
                    headers: [createHeader({ key: 'Content-Type', value: 'application/json' })],
                    body: '{\n  "username": "qa.user@example.com",\n  "password": "errada"\n}',
                    postRequestScripts: "pm.test('Status 401', () => pm.response.to.have.status(401));\n",
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      createFolder({
        name: 'Usuários',
        description: 'CRUD de usuários.',
        preRequestScripts: "// Garante que existe token antes de chamar endpoints de usuário\nif (!pm.collectionVariables.get('accessToken')) {\n  console.warn('accessToken ausente');\n}\n",
        scenarios: [
          createScenario({
            name: 'Cadastro de usuário',
            idCode: 'CAD',
            description: 'Criação de usuários com dados válidos e inválidos.',
            testIds: [
              createTestId({
                name: 'TC-CAD-001',
                description: 'Criar usuário com todos os campos obrigatórios retorna 201.',
                requests: [
                  createRequest({
                    name: 'POST criar usuário',
                    method: 'POST',
                    url: '{{baseUrl}}/users',
                    headers: jsonHeaders(),
                    body: '{\n  "name": "Maria Silva",\n  "email": "maria.{{$timestamp}}@example.com",\n  "role": "admin"\n}',
                    postRequestScripts:
                      "pm.test('Status 201', () => pm.response.to.have.status(201));\npm.collectionVariables.set('userId', pm.response.json().id);\n",
                  }),
                  createRequest({
                    name: 'GET usuário criado',
                    method: 'GET',
                    url: '{{baseUrl}}/users/{{userId}}',
                    headers: jsonHeaders(),
                  }),
                ],
              }),
            ],
          }),
          createScenario({
            name: 'Remoção de usuário',
            idCode: 'REM',
            description: 'Exclusão lógica de usuários.',
            testIds: [
              createTestId({
                name: 'TC-REM-001',
                description: 'DELETE em usuário existente retorna 204.',
                requests: [
                  createRequest({
                    name: 'DELETE usuário',
                    method: 'DELETE',
                    url: '{{baseUrl}}/users/{{userId}}',
                    headers: jsonHeaders(),
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}
