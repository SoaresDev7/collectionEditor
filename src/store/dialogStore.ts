import { create } from 'zustand';

/** Diálogos grandes (não persistidos). */
type DialogState = {
  /** Edição em massa aberta, com os IDs de teste pré-selecionados. */
  bulkEdit: { preselect: string[] } | null;
  report: boolean;
  templates: boolean;
  /** Nó sendo movido pelo diálogo "Mover para…". */
  move: string | null;
  importing: boolean;
  /** Renomear IDs em massa, com IDs pré-selecionados. */
  rename: { preselect: string[] } | null;
  setMove: (nodeId: string | null) => void;
  setImporting: (open: boolean) => void;
  openRename: (preselect?: string[]) => void;
  closeRename: () => void;
  openBulkEdit: (preselect?: string[]) => void;
  closeBulkEdit: () => void;
  setReport: (open: boolean) => void;
  setTemplates: (open: boolean) => void;
};

export const useDialogStore = create<DialogState>()((set) => ({
  bulkEdit: null,
  report: false,
  templates: false,
  move: null,
  importing: false,
  rename: null,
  setMove: (move) => set({ move }),
  setImporting: (importing) => set({ importing }),
  openRename: (preselect = []) => set({ rename: { preselect } }),
  closeRename: () => set({ rename: null }),
  openBulkEdit: (preselect = []) => set({ bulkEdit: { preselect } }),
  closeBulkEdit: () => set({ bulkEdit: null }),
  setReport: (report) => set({ report }),
  setTemplates: (templates) => set({ templates }),
}));
