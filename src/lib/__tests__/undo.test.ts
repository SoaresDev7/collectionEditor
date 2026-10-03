import { beforeEach, describe, expect, it } from 'vitest';
import { useCollectionStore } from '@/store/collectionStore';
import { useHistoryStore } from '@/store/historyStore';
import { redo, undo } from '@/store/undo';
import { buildMockCollection } from '@/data/mockCollection';

const store = () => useCollectionStore.getState();
const active = () => store().collections.find((c) => c.id === store().activeCollectionId)!;
const ids = () => active().folders[0].scenarios[0].testIds.map((t) => t.name);

describe('desfazer / refazer', () => {
  beforeEach(() => {
    const c = buildMockCollection();
    useCollectionStore.setState({ collections: [c], activeCollectionId: c.id });
    useHistoryStore.getState().clear();
  });

  it('desfaz e refaz ações estruturais', () => {
    store().duplicateTestIdN(active().folders[0].scenarios[0].testIds[0].id, 2);
    expect(ids()).toHaveLength(4);
    store().deleteNode(active().folders[0].id);
    expect(active().folders).toHaveLength(1);
    undo();
    expect(active().folders).toHaveLength(2);
    expect(ids()).toHaveLength(4);
    undo();
    expect(ids()).toEqual(['TC-LCV-001', 'TC-LCV-002']);
    redo();
    expect(ids()).toHaveLength(4);
    expect(useHistoryStore.getState().future.at(-1)?.label).toBe('Excluir item');
  });

  it('agrupa digitação no mesmo campo e não registra ações sem efeito', () => {
    const req = active().folders[0].scenarios[0].testIds[0].requests[0];
    for (const url of ['a', 'ab', 'abc']) store().updateNode(req.id, { url });
    expect(useHistoryStore.getState().past).toHaveLength(1);
    expect(useHistoryStore.getState().past[0].label).toBe('Editar URL');
    const s = active().folders[0].scenarios[0];
    store().moveNode(s.testIds[0].id, s.id, 0); // mesma posição
    expect(useHistoryStore.getState().past).toHaveLength(1);
    undo();
    expect(active().folders[0].scenarios[0].testIds[0].requests[0].url).toBe(req.url);
  });

  it('uma nova ação apaga o que podia ser refeito; excluir collection é reversível', () => {
    const c = active();
    store().deleteCollection(c.id);
    expect(store().collections).toHaveLength(0);
    undo();
    expect(store().activeCollectionId).toBe(c.id);
    store().updateNode(c.id, { description: 'x' });
    expect(useHistoryStore.getState().future).toHaveLength(0);
  });
});
