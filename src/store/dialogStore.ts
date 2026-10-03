import { create } from 'zustand';

/** Diálogos grandes (não persistidos). */
type DialogState = {
  /** Edição em massa aberta, com os IDs de teste pré-selecionados. */
  bulkEdit: { preselect: string[] } | null;
  report: boolean;
  templates: boolean;
  openBulkEdit: (preselect?: string[]) => void;
  closeBulkEdit: () => void;
  setReport: (open: boolean) => void;
  setTemplates: (open: boolean) => void;
};

export const useDialogStore = create<DialogState>()((set) => ({
  bulkEdit: null,
  report: false,
  templates: false,
  openBulkEdit: (preselect = []) => set({ bulkEdit: { preselect } }),
  closeBulkEdit: () => set({ bulkEdit: null }),
  setReport: (report) => set({ report }),
  setTemplates: (templates) => set({ templates }),
}));
