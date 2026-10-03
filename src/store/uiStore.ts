import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark';
export type SidebarTab = 'tree' | 'search';
export type SearchModeUi = 'text' | 'variable' | 'function';

/** Pedido para rolar um editor de código até uma linha (vindo da busca). */
export type RevealRequest = { nodeId: string; field: string; line: number; nonce: number };

type UiState = {
  selectedId: string | null;
  /** ids de nós expandidos na árvore. */
  expanded: Record<string, boolean>;
  /** aba aberta por nó (ex.: "body", "pre", "post"). */
  editorTab: Record<string, string>;
  theme: Theme;
  treeFilter: string;
  showVariablesPanel: boolean;
  sidebarScrollTop: number;
  sidebarTab: SidebarTab;
  search: { mode: SearchModeUi; query: string; caseSensitive: boolean };
  reveal: RevealRequest | null;

  select: (id: string | null) => void;
  toggleExpanded: (id: string) => void;
  setExpanded: (ids: string[], value: boolean) => void;
  setEditorTab: (nodeId: string, tab: string) => void;
  toggleTheme: () => void;
  setTreeFilter: (filter: string) => void;
  toggleVariablesPanel: () => void;
  setSidebarScrollTop: (top: number) => void;
  setSidebarTab: (tab: SidebarTab) => void;
  setSearch: (patch: Partial<UiState['search']>) => void;
  /** Abre a aba de busca já com uma consulta (ex.: "ver usos" de uma variável). */
  openSearch: (mode: SearchModeUi, query: string) => void;
  /** Seleciona o nó, expande os ancestrais e, opcionalmente, abre a aba/linha indicada. */
  navigate: (target: { nodeId: string; ancestorIds: string[]; tabKey?: string; tab?: string; line?: number; field?: string }) => void;
};

const prefersDark = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      selectedId: null,
      expanded: {},
      editorTab: {},
      theme: prefersDark() ? 'dark' : 'light',
      treeFilter: '',
      showVariablesPanel: true,
      sidebarScrollTop: 0,
      sidebarTab: 'tree',
      search: { mode: 'text', query: '', caseSensitive: false },
      reveal: null,

      select: (id) => set({ selectedId: id }),
      toggleExpanded: (id) => set((s) => ({ expanded: { ...s.expanded, [id]: !s.expanded[id] } })),
      setExpanded: (ids, value) =>
        set((s) => {
          const expanded = { ...s.expanded };
          for (const id of ids) expanded[id] = value;
          return { expanded };
        }),
      setEditorTab: (nodeId, tab) => set((s) => ({ editorTab: { ...s.editorTab, [nodeId]: tab } })),
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      setTreeFilter: (treeFilter) => set({ treeFilter }),
      toggleVariablesPanel: () => set((s) => ({ showVariablesPanel: !s.showVariablesPanel })),
      setSidebarScrollTop: (sidebarScrollTop) => set({ sidebarScrollTop }),
      setSidebarTab: (sidebarTab) => set({ sidebarTab }),
      setSearch: (patch) => set((s) => ({ search: { ...s.search, ...patch } })),
      openSearch: (mode, query) => set((s) => ({ sidebarTab: 'search', search: { ...s.search, mode, query } })),
      navigate: ({ nodeId, ancestorIds, tabKey, tab, line, field }) =>
        set((s) => {
          const expanded = { ...s.expanded };
          for (const id of ancestorIds) expanded[id] = true;
          return {
            selectedId: nodeId,
            expanded,
            editorTab: tabKey && tab ? { ...s.editorTab, [tabKey]: tab } : s.editorTab,
            reveal: line && field ? { nodeId, field, line, nonce: Date.now() } : null,
          };
        }),
    }),
    {
      name: 'collection-editor:ui',
      version: 1,
      partialize: ({ reveal: _reveal, ...rest }) => rest,
    },
  ),
);
