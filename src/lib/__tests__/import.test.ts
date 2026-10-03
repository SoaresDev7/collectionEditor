import { describe, expect, it } from 'vitest';
import fixture from './fixtures/company.postman_collection.json';
import { buildMockCollection } from '@/data/mockCollection';
import { toPostman } from '../postman/export';
import { importPostman } from '../postman/import';

const roundTrip = (json: unknown) => JSON.parse(JSON.stringify(toPostman(importPostman(structuredClone(json)).collection)));

describe('importação Postman (fiel ao original)', () => {
  it('importar e exportar sem editar devolve o mesmo JSON', () => {
    expect(roundTrip(fixture)).toEqual(fixture);
  });

  it('não renomeia nem reestrutura: mapeia por profundidade com contêineres sintéticos', () => {
    const { collection, stats } = importPostman(structuredClone(fixture));
    expect(stats).toMatchObject({ folders: 1, scenarios: 1, testIds: 1, requests: 8 });
    expect(collection.folders.map((f) => [f.name, !!f.synthetic])).toEqual([
      ['(requisições na raiz)', true],
      ['01 - Pagamentos', false],
      ['(requisições na raiz)', true],
    ]);
    const scenario = collection.folders[1].scenarios[1];
    expect(scenario.name).toBe('CT01 - Cartão');
    expect(scenario.variables[0]).toMatchObject({ key: 'bandeira', storage: 'postman' });
    const testId = scenario.testIds[0];
    expect(testId.name).toBe('CT01.1 Aprovado');
    expect(testId.requests.map((r) => r.name)).toEqual(['Criar pagamento', 'Consultar', 'Estornar', 'Depois da subpasta']);
    expect(testId.requests[2].folderPath).toHaveLength(2);
  });

  it('edições afetam só o campo editado', () => {
    const { collection } = importPostman(structuredClone(fixture));
    const req = collection.folders[1].scenarios[1].testIds[0].requests[0];
    req.body = req.body.replace('{{valor}}', '200');
    const out = JSON.parse(JSON.stringify(toPostman(collection)));
    const exported = out.item[1].item[1].item[0].item[0];
    const original = fixture.item[1].item![1].item![0].item![0];
    expect(exported.request.body.raw).toContain('200');
    expect({ ...exported, request: { ...exported.request, body: undefined } }).toEqual({ ...original, request: { ...original.request, body: undefined } });
    expect(exported.request.body.options).toEqual(original.request!.body!.options);
  });

  it('collection criada na ferramenta continua com ida e volta', () => {
    const original = buildMockCollection();
    const { collection } = importPostman(JSON.parse(JSON.stringify(toPostman(original))));
    expect(collection.folders[0].variables.map((v) => v.key)).toEqual(['authPath']);
    expect(collection.folders[0].preRequestScripts).not.toContain('@collection-editor');
    expect(collection.folders[0].scenarios[0].testIds.map((t) => t.name)).toEqual(['TC-LCV-001', 'TC-LCV-002']);
  });

  it('rejeita arquivo inválido', () => {
    expect(() => importPostman({ foo: 1 })).toThrow();
  });
});
