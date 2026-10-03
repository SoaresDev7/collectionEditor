import { beforeEach, describe, expect, it } from 'vitest';
import { useCollectionStore } from '@/store/collectionStore';
import { buildMockCollection } from '@/data/mockCollection';
import { previewRename } from '../bulkRename';

const active = () => useCollectionStore.getState().collections[0];

describe('estrutura', () => {
  beforeEach(() => useCollectionStore.setState({ collections: [buildMockCollection()], activeCollectionId: null }, false));
  beforeEach(() => useCollectionStore.setState({ activeCollectionId: useCollectionStore.getState().collections[0].id }));

  it('duplicar N vezes reordena pelo número', () => {
    const first = active().folders[0].scenarios[0].testIds[0];
    useCollectionStore.getState().duplicateTestIdN(first.id, 2);
    expect(active().folders[0].scenarios[0].testIds.map((t) => t.name)).toEqual(['TC-LCV-001', 'TC-LCV-002', 'TC-LCV-003', 'TC-LCV-004']);
  });

  it('mover ID para outro cenário assume o código do destino', () => {
    const id = active().folders[0].scenarios[0].testIds[1].id;
    const target = active().folders[0].scenarios[1];
    const r = useCollectionStore.getState().moveNode(id, target.id);
    expect(r).toEqual({ ok: true, renamedTo: 'TC-LCI-002' });
    expect(active().folders[0].scenarios[1].testIds.map((t) => t.name)).toEqual(['TC-LCI-001', 'TC-LCI-002']);
  });

  it('mover rejeita nível incompatível e reordena entre irmãos', () => {
    const folders = active().folders;
    expect(useCollectionStore.getState().moveNode(folders[0].id, folders[1].id).ok).toBe(false);
    useCollectionStore.getState().moveNode(folders[1].id, active().id, 0);
    expect(active().folders.map((f) => f.name)).toEqual(['Usuários', 'Autenticação']);
  });

  it('renomear em massa: padrão e conflitos', () => {
    const ids = new Set(active().folders[0].scenarios[0].testIds.map((t) => t.id));
    const pattern = previewRename(active(), ids, { mode: 'pattern', start: 10 });
    expect(pattern.map((p) => p.to)).toEqual(['TC-LCV-010', 'TC-LCV-011']);
    const clash = previewRename(active(), ids, { mode: 'replace', find: '\\d+$', replace: 'X', regex: true, caseSensitive: true });
    expect(clash.every((p) => p.conflict)).toBe(true);
  });
});

describe('itens importados fora do padrão', () => {
  beforeEach(() => useCollectionStore.setState({ collections: [buildMockCollection()], activeCollectionId: null }, false));
  beforeEach(() => useCollectionStore.setState({ activeCollectionId: useCollectionStore.getState().collections[0].id }));

  it('duplicar mantém o nome original e a posição; IDs fora do padrão não são reordenados', () => {
    const scenario = active().folders[0].scenarios[0];
    useCollectionStore.getState().renameNodes([{ id: scenario.testIds[0].id, name: 'CT99 - Empresa' }]);
    const id = active().folders[0].scenarios[0].testIds[0].id;
    useCollectionStore.getState().duplicateTestIdN(id, 2);
    expect(active().folders[0].scenarios[0].testIds.map((t) => t.name)).toEqual([
      'CT99 - Empresa',
      'CT99 - Empresa (cópia)',
      'CT99 - Empresa (cópia 2)',
      'TC-LCV-002',
    ]);
  });
});
