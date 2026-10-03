import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark';

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

  select: (id: string | null) => void;
  toggleExpanded: (id: string) => void;
  setExpanded: (ids: string[], value: boolean) => void;
  setEditorTab: (nodeId: string, tab: string) => void;
  toggleTheme: () => void;
  setTreeFilter: (filter: string) => void;
  toggleVariablesPanel: () => void;
  setSidebarScrollTop: (top: number) => void;
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
    }),
    { name: 'collection-editor:ui', version: 1 },
  ),
);
