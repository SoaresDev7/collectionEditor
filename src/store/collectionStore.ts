import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { AnyNode, Collection, Folder, NodeRef, Scenario, TestId } from '@/types/collection';
import { buildMockCollection } from '@/data/mockCollection';
import { createCollection, createFolder, createRequest, createScenario, createTestId } from '@/lib/factories';
import { cloneCollection, cloneFolder, cloneRequest, cloneScenario, cloneTestId } from '@/lib/clone';
import { formatTestIdName, maxTestIdNumber, nextTestIdName, uniqueName } from '@/lib/nomenclature';
import { childArray, findPath, nearest } from '@/lib/tree';
import { nowIso } from '@/lib/ids';

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
  /** Renomeia todos os IDs do folder em sequência (001, 002...) usando o prefixo atual. */
  renumberFolderTestIds: (folderId: string) => void;
};

const siblingNames = (parent: NodeRef) => (childArray(parent) ?? []).map((n) => n.name);

/** Renumera os IDs de um cenário recém-copiado, continuando a sequência do folder. */
function renumberTestIds(folder: Folder, testIds: TestId[]): void {
  let next = maxTestIdNumber(folder) + 1;
  for (const t of testIds) t.name = formatTestIdName(folder.idNomenclaturePrefix, next++);
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
                const s = createScenario({ name: uniqueName('Novo cenário', names, 'novo') });
                parent.node.scenarios.push(s);
                return s.id;
              }
              case 'scenario': {
                const folder = nearest(path, 'folder')!.node;
                const t = createTestId({ name: nextTestIdName(folder) });
                parent.node.testIds.push(t);
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
                const folder = nearest(path, 'folder')!.node;
                const s: Scenario = cloneScenario(ref.node);
                s.name = uniqueName(ref.node.name, names);
                renumberTestIds(folder, s.testIds);
                copy = s;
                break;
              }
              case 'testId': {
                const folder = nearest(path, 'folder')!.node;
                copy = cloneTestId(ref.node);
                copy.name = nextTestIdName(folder);
                break;
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
            const folder = nearest(path, 'folder')!.node;
            const scenario = nearest(path, 'scenario')!.node;
            const index = scenario.testIds.findIndex((t) => t.id === id);

            let next = maxTestIdNumber(folder) + 1;
            const copies = Array.from({ length: count }, () => {
              const t = cloneTestId(ref.node);
              t.name = formatTestIdName(folder.idNomenclaturePrefix, next++);
              return t;
            });
            scenario.testIds.splice(index + 1, 0, ...copies);
            return copies.map((t) => t.id);
          }) ?? [],

        renumberFolderTestIds: (folderId) =>
          mutateActive((c) => {
            const folder = c.folders.find((f) => f.id === folderId);
            if (!folder) return;
            let n = 1;
            for (const s of folder.scenarios)
              for (const t of s.testIds) t.name = formatTestIdName(folder.idNomenclaturePrefix, n++);
          }),
      };
    }),
    {
      name: 'collection-editor:data',
      version: 1,
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
