import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { CHILD_KIND, type AnyNode, type Collection, type NodeRef, type Scenario } from '@/types/collection';
import { buildMockCollection } from '@/data/mockCollection';
import { createCollection, createFolder, createRequest, createScenario, createTestId } from '@/lib/factories';
import { cloneCollection, cloneFolder, cloneRequest, cloneScenario, cloneTestId } from '@/lib/clone';
import {
  formatTestIdName,
  maxTestIdNumber,
  nextTestIdName,
  parseTestIdNumber,
  renumberByPosition,
  sanitizeIdCode,
  sortTestIds,
  suggestIdCode,
  uniqueName,
} from '@/lib/nomenclature';
import { childArray, findPath, nearest } from '@/lib/tree';
import { nowIso } from '@/lib/ids';
import { indexedDbStorage } from '@/lib/storage';

type CollectionState = {
  collections: Collection[];
  activeCollectionId: string | null;

  /* Collections */
  newCollection: (partial?: Partial<Collection>) => string;
  addCollection: (collection: Collection) => void;
  duplicateCollection: (id: string) => string | null;
  deleteCollection: (id: string) => void;
  setActiveCollection: (id: string) => void;

  /* Nós da collection ativa */
  updateNode: (id: string, patch: Partial<AnyNode>) => void;
  addChild: (parentId: string) => string | null;
  deleteNode: (id: string) => void;
  duplicateNode: (id: string) => string | null;
  /** Cria `count` cópias de um ID de teste com numeração sequencial. Retorna os ids criados. */
  duplicateTestIdN: (id: string, count: number) => string[];
  /** Renomeia todos os IDs do cenário em sequência (TC-XXX-001, 002...) na ordem atual. */
  renumberScenarioTestIds: (scenarioId: string) => void;
  /** Troca o código do cenário e renomeia os IDs que seguiam o código anterior. */
  setScenarioIdCode: (scenarioId: string, code: string) => void;
  /** Substitui o body de várias requisições numa única alteração. */
  applyBodies: (bodies: { requestId: string; body: string }[]) => void;
  /** Renomeia vários nós numa única alteração (IDs renomeados são reordenados pelo número). */
  renameNodes: (renames: { id: string; name: string }[]) => void;
  /**
   * Move um nó para outro pai (do nível adequado) na posição `index`
   * (fim, se omitido). Retorna mensagem de erro ou o resultado.
   */
  moveNode: (id: string, targetParentId: string, index?: number) => MoveResult;
};

export type MoveResult =
  | { ok: true; renamedTo?: string; renumbered?: { from: string; to: string }[] }
  | { ok: false; error: string };

/** Reordena os IDs do cenário pelo número após inclusões. */
const resort = (scenario: Scenario) => {
  scenario.testIds = sortTestIds(scenario.idCode, scenario.testIds);
};

const siblingNames = (parent: NodeRef) => (childArray(parent) ?? []).map((n) => n.name);

/** Migração v1 → v2: prefixo de nomenclatura saiu do folder e virou código do cenário. */
function migrateV1(collections: Collection[]): Collection[] {
  for (const c of collections) {
    for (const f of c.folders) {
      delete (f as { idNomenclaturePrefix?: string }).idNomenclaturePrefix;
      for (const s of f.scenarios) s.idCode ??= suggestIdCode(s.name);
    }
  }
  return collections;
}

export const useCollectionStore = create<CollectionState>()(
  persist(
    immer((set, get) => {
      /** Executa `fn` na collection ativa (draft do immer) e atualiza `updatedAt`. */
      const mutateActive = <T>(fn: (c: Collection) => T): T | undefined => {
        let result: T | undefined;
        set((state) => {
          const c = state.collections.find((x) => x.id === state.activeCollectionId);
          if (!c) return;
          result = fn(c);
          c.updatedAt = nowIso();
        });
        return result;
      };

      return {
        collections: [],
        activeCollectionId: null,

        newCollection: (partial) => {
          const c = createCollection(partial);
          set((s) => {
            s.collections.push(c);
            s.activeCollectionId = c.id;
          });
          return c.id;
        },

        addCollection: (collection) =>
          set((s) => {
            s.collections.push(collection);
            s.activeCollectionId = collection.id;
          }),

        duplicateCollection: (id) => {
          const source = get().collections.find((c) => c.id === id);
          if (!source) return null;
          const copy = cloneCollection(source);
          copy.name = uniqueName(source.name, get().collections.map((c) => c.name));
          set((s) => {
            s.collections.push(copy);
            s.activeCollectionId = copy.id;
          });
          return copy.id;
        },

        deleteCollection: (id) =>
          set((s) => {
            s.collections = s.collections.filter((c) => c.id !== id);
            if (s.activeCollectionId === id) s.activeCollectionId = s.collections[0]?.id ?? null;
          }),

        setActiveCollection: (id) => set({ activeCollectionId: id }),

        updateNode: (id, patch) =>
          mutateActive((c) => {
            const path = findPath(c, id);
            if (path) Object.assign(path[path.length - 1].node, patch);
          }),

        addChild: (parentId) =>
          mutateActive((c) => {
            const path = findPath(c, parentId);
            if (!path) return null;
            const parent = path[path.length - 1];
            const names = siblingNames(parent);
            switch (parent.kind) {
              case 'collection': {
                const f = createFolder({ name: uniqueName('Novo folder', names, 'novo') });
                parent.node.folders.push(f);
                return f.id;
              }
              case 'folder': {
                const s = createScenario({ name: uniqueName('Novo cenário', names, 'novo'), idCode: 'NOV' });
                parent.node.scenarios.push(s);
                return s.id;
              }
              case 'scenario': {
                const t = createTestId({ name: nextTestIdName(parent.node) });
                parent.node.testIds.push(t);
                resort(parent.node);
                return t.id;
              }
              case 'testId': {
                const r = createRequest({ name: uniqueName('Nova requisição', names, 'nova') });
                parent.node.requests.push(r);
                return r.id;
              }
              default:
                return null;
            }
          }) ?? null,

        deleteNode: (id) =>
          mutateActive((c) => {
            const path = findPath(c, id);
            if (!path || path.length < 2) return;
            const siblings = childArray(path[path.length - 2])!;
            const index = siblings.findIndex((n) => n.id === id);
            if (index >= 0) siblings.splice(index, 1);
          }),

        duplicateNode: (id) =>
          mutateActive((c) => {
            const path = findPath(c, id);
            if (!path || path.length < 2) return null;
            const ref = path[path.length - 1];
            const parent = path[path.length - 2];
            const siblings = childArray(parent)!;
            const index = siblings.findIndex((n) => n.id === id);
            const names = siblingNames(parent);

            let copy: AnyNode;
            switch (ref.kind) {
              case 'folder': {
                copy = cloneFolder(ref.node);
                copy.name = uniqueName(ref.node.name, names);
                break;
              }
              case 'scenario': {
                // A cópia mantém código e IDs (a numeração é por cenário).
                copy = cloneScenario(ref.node);
                copy.name = uniqueName(ref.node.name, names);
                break;
              }
              case 'testId': {
                const scenario = nearest(path, 'scenario')!.node;
                const t = cloneTestId(ref.node);
                // Só aplica a nomenclatura da ferramenta a IDs que já a seguem.
                if (parseTestIdNumber(scenario.idCode, ref.node.name) === null) {
                  t.name = uniqueName(ref.node.name, names);
                  siblings.splice(index + 1, 0, t);
                  return t.id;
                }
                t.name = nextTestIdName(scenario);
                scenario.testIds.push(t);
                resort(scenario);
                return t.id;
              }
              case 'request': {
                copy = cloneRequest(ref.node);
                copy.name = uniqueName(ref.node.name, names);
                break;
              }
              default:
                return null;
            }
            siblings.splice(index + 1, 0, copy);
            return copy.id;
          }) ?? null,

        duplicateTestIdN: (id, count) =>
          mutateActive((c) => {
            const path = findPath(c, id);
            const ref = path?.[path.length - 1];
            if (!path || ref?.kind !== 'testId' || count < 1) return [];
            const scenario = nearest(path, 'scenario')!.node;
            const index = scenario.testIds.findIndex((t) => t.id === id);

            const followsPattern = parseTestIdNumber(scenario.idCode, ref.node.name) !== null;
            let next = maxTestIdNumber(scenario) + 1;
            const names = scenario.testIds.map((t) => t.name);
            const copies = Array.from({ length: count }, () => {
              const t = cloneTestId(ref.node);
              // Fora do padrão TC, mantém o nome original com sufixo "(cópia N)".
              t.name = followsPattern ? formatTestIdName(scenario.idCode, next++) : uniqueName(ref.node.name, names);
              names.push(t.name);
              return t;
            });
            scenario.testIds.splice(index + 1, 0, ...copies);
            resort(scenario);
            return copies.map((t) => t.id);
          }) ?? [],

        renumberScenarioTestIds: (scenarioId) =>
          mutateActive((c) => {
            const ref = findPath(c, scenarioId)?.at(-1);
            if (ref?.kind !== 'scenario') return;
            ref.node.testIds.forEach((t, i) => (t.name = formatTestIdName(ref.node.idCode, i + 1)));
          }),

        setScenarioIdCode: (scenarioId, code) =>
          mutateActive((c) => {
            const ref = findPath(c, scenarioId)?.at(-1);
            if (ref?.kind !== 'scenario') return;
            const scenario = ref.node;
            const next = sanitizeIdCode(code);
            const previous = scenario.idCode;
            scenario.idCode = next;
            if (!next || !previous || next === previous) return;
            for (const t of scenario.testIds) {
              const n = parseTestIdNumber(previous, t.name);
              if (n !== null) t.name = formatTestIdName(next, n);
            }
          }),

        renameNodes: (renames) =>
          mutateActive((c) => {
            const touched = new Set<Scenario>();
            for (const { id, name } of renames) {
              const path = findPath(c, id);
              const ref = path?.at(-1);
              if (!path || !ref) continue;
              ref.node.name = name;
              if (ref.kind === 'testId') touched.add(nearest(path, 'scenario')!.node);
            }
            touched.forEach(resort);
          }),

        moveNode: (id, targetParentId, index) =>
          mutateActive((c): MoveResult => {
            const path = findPath(c, id);
            const targetPath = findPath(c, targetParentId);
            if (!path || path.length < 2 || !targetPath) return { ok: false, error: 'Item não encontrado.' };
            const ref = path[path.length - 1];
            const source = path[path.length - 2];
            const target = targetPath[targetPath.length - 1];
            if (CHILD_KIND[target.kind] !== ref.kind)
              return { ok: false, error: `Não é possível colocar este item dentro de ${target.node.name}.` };

            const from = childArray(source)!;
            const to = childArray(target)!;
            const fromIndex = from.findIndex((n) => n.id === id);
            let insertAt = index ?? to.length;
            if (source.node.id === target.node.id && fromIndex < insertAt) insertAt--;
            if (source.node.id === target.node.id && fromIndex === insertAt) return { ok: true };

            const originalName = ref.node.name;
            const [node] = from.splice(fromIndex, 1);
            let renamedTo: string | undefined;
            if (source.node.id !== target.node.id) {
              if (ref.kind === 'testId' && target.kind === 'scenario') {
                // Em outro cenário o ID assume o código e o próximo número do destino.
                const sourceScenario = source.node as Scenario;
                if (parseTestIdNumber(sourceScenario.idCode, node.name) !== null || parseTestIdNumber(target.node.idCode, node.name) !== null) {
                  node.name = nextTestIdName(target.node);
                  renamedTo = node.name;
                }
              } else {
                const unique = uniqueName(node.name, to.map((n) => n.name));
                if (unique !== node.name) renamedTo = node.name = unique;
              }
            }
            to.splice(Math.max(0, Math.min(insertAt, to.length)), 0, node);
            // ID no padrão TC: a posição no cenário define o número (ex.: mover o 003 para cima do 002 troca os dois).
            let renumbered: { from: string; to: string }[] | undefined;
            if (ref.kind === 'testId' && target.kind === 'scenario' && parseTestIdNumber(target.node.idCode, node.name) !== null) {
              renumbered = renumberByPosition(target.node.idCode, target.node.testIds);
              renamedTo = node.name !== originalName ? node.name : undefined;
            }
            return { ok: true, renamedTo, renumbered };
          }) ?? { ok: false, error: 'Nenhuma collection ativa.' },

        applyBodies: (bodies) =>
          mutateActive((c) => {
            const byId = new Map(bodies.map((b) => [b.requestId, b.body]));
            for (const f of c.folders)
              for (const s of f.scenarios)
                for (const t of s.testIds)
                  for (const r of t.requests) {
                    const body = byId.get(r.id);
                    if (body !== undefined) r.body = body;
                  }
          }),
      };
    }),
    {
      name: 'collection-editor:data',
      version: 2,
      storage: indexedDbStorage<Pick<CollectionState, 'collections' | 'activeCollectionId'>>(),
      partialize: (s) => ({ collections: s.collections, activeCollectionId: s.activeCollectionId }),
      migrate: (persisted, version) => {
        const state = persisted as { collections: Collection[]; activeCollectionId: string | null };
        if (version < 2) state.collections = migrateV1(state.collections ?? []);
        return state as CollectionState;
      },
      onRehydrateStorage: () => (state) => {
        // Primeira execução: carrega o exemplo.
        if (state && state.collections.length === 0) state.addCollection(buildMockCollection());
      },
    },
  ),
);

/** Collection ativa (ou undefined). */
export const useActiveCollection = () =>
  useCollectionStore((s) => s.collections.find((c) => c.id === s.activeCollectionId));
