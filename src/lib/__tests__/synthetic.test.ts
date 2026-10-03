import { beforeEach, describe, expect, it } from 'vitest';
import { useCollectionStore } from '@/store/collectionStore';
import { importPostman } from '../postman/import';
import { toPostman } from '../postman/export';
import { previewRename } from '../bulkRename';
import type { Collection } from '@/types/collection';

/** Caso relatado: requisições direto dentro do cenário (sem pasta de TC). */
const source = {
  info: { name: 'Payment System', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
  item: [
    {
      name: 'AUTHENTICATION',
      item: [
        {
          name: 'SCENARIO_LOGIN_FLOW',
          item: [
            { name: 'AUTH_001_Valid_Login', request: { method: 'POST', url: '{{host}}/login' } },
            { name: 'AUTH_002_Invalid_Credentials', request: { method: 'POST', url: '{{host}}/login' } },
            { name: 'AUTH_003_Refresh_Token', request: { method: 'POST', url: '{{host}}/refresh', body: { mode: 'raw', raw: '{"refresh_token": "x"}' } } },
          ],
        },
      ],
    },
  ],
};

const active = () => useCollectionStore.getState().collections[0];
const exported = () => JSON.parse(JSON.stringify(toPostman(active())));

describe('contêineres sintéticos editados pelo usuário', () => {
  beforeEach(() => {
    const { collection } = importPostman(structuredClone(source));
    useCollectionStore.setState({ collections: [collection as Collection], activeCollectionId: collection.id });
  });

  it('sem edição: exporta igual ao original (requisições direto no cenário)', () => {
    expect(exported()).toEqual(source);
  });

  it('renomear em massa + duplicar N vezes: os TCs viram pastas no Postman', () => {
    const scenario = active().folders[0].scenarios[0];
    scenario.idCode = 'SLF';
    const rows = previewRename(active(), new Set(scenario.testIds.map((t) => t.id)), { mode: 'pattern', start: 1 });
    useCollectionStore.getState().renameNodes(rows.map((r) => ({ id: r.id, name: r.to })));
    const third = active().folders[0].scenarios[0].testIds[2];
    useCollectionStore.getState().duplicateTestIdN(third.id, 2);

    const items = exported().item[0].item[0].item;
    expect(items.map((i: { name: string }) => i.name)).toEqual(['TC-SLF-001', 'TC-SLF-002', 'TC-SLF-003', 'TC-SLF-004', 'TC-SLF-005']);
    expect(items[0].item.map((r: { name: string }) => r.name)).toEqual(['AUTH_001_Valid_Login']);
    expect(items[4].item[0].request.body.raw).toBe('{"refresh_token": "x"}');
  });

  it('renomear só a requisição mantém o contêiner transparente', () => {
    const t = active().folders[0].scenarios[0].testIds[0];
    useCollectionStore.getState().updateNode(t.requests[0].id, { name: 'Login OK' });
    expect(exported().item[0].item[0].item[0]).toMatchObject({ name: 'Login OK', request: { method: 'POST' } });
  });

  it('dados salvos antes da correção (sem syntheticName) também viram pasta quando renomeados', () => {
    const t = active().folders[0].scenarios[0].testIds[0];
    delete t.syntheticName;
    t.name = 'TC-SLF-001';
    expect(exported().item[0].item[0].item[0]).toMatchObject({ name: 'TC-SLF-001', item: [{ name: 'AUTH_001_Valid_Login' }] });
  });
});
