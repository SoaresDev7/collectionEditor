import { describe, expect, it } from 'vitest';
import { buildMockCollection } from '@/data/mockCollection';
import { toPostman } from '../postman/export';
import { importPostman } from '../postman/import';

describe('importação Postman', () => {
  it('ida e volta mantém hierarquia, scripts e variáveis de escopo', () => {
    const original = buildMockCollection();
    const { collection, stats } = importPostman(JSON.parse(JSON.stringify(toPostman(original))), { normalizeIds: true });
    expect(stats).toEqual({ folders: 2, scenarios: 4, testIds: 5, requests: 6 });
    const scenario = collection.folders[0].scenarios[0];
    expect(scenario.idCode).toBe('LCV');
    expect(scenario.testIds.map((t) => t.name)).toEqual(['TC-LCV-001', 'TC-LCV-002']);
    expect(collection.folders[0].variables.map((v) => v.key)).toEqual(['authPath']);
    expect(collection.folders[0].preRequestScripts).not.toContain('@collection-editor');
    expect(scenario.testIds[0].requests[0].postRequestScripts).toContain("pm.test('Status 200'");
  });

  it('normaliza estruturas genéricas', () => {
    const json = {
      info: { name: 'Genérica', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
      item: [
        { name: 'Health', request: { method: 'GET', url: { raw: '{{baseUrl}}/health' } } },
        {
          name: 'Pedidos',
          item: [
            { name: 'Listar pedidos', request: { method: 'GET', url: '{{baseUrl}}/orders' } },
            {
              name: 'Criar pedido',
              item: [
                { name: 'Caso feliz', item: [{ name: 'POST', request: { method: 'POST', url: '/o', body: { mode: 'urlencoded', urlencoded: [{ key: 'a', value: '1' }] } } }] },
              ],
            },
          ],
        },
      ],
    };
    const { collection, warnings } = importPostman(json, { normalizeIds: true });
    expect(collection.folders.map((f) => f.name)).toEqual(['Geral', 'Pedidos']);
    const pedidos = collection.folders[1];
    expect(pedidos.scenarios.map((s) => s.name)).toEqual(['Geral', 'Criar pedido']);
    expect(pedidos.scenarios[0].testIds[0]).toMatchObject({ name: 'TC-GER-001', description: 'Listar pedidos' });
    expect(pedidos.scenarios[1].testIds[0].description).toBe('Caso feliz');
    expect(pedidos.scenarios[1].testIds[0].requests[0].body).toContain('"a": "1"');
    expect(warnings.some((w) => w.includes('urlencoded'))).toBe(true);
  });

  it('rejeita arquivo inválido', () => {
    expect(() => importPostman({ foo: 1 }, { normalizeIds: true })).toThrow();
  });
});
