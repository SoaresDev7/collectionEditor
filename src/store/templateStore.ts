import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DocTemplate, TemplateLevel } from '@/types/template';
import { defaultTemplates } from '@/lib/templates';
import { nowIso, uid } from '@/lib/ids';

type TemplateState = {
  templates: DocTemplate[];
  addTemplate: (level: TemplateLevel) => string;
  updateTemplate: (id: string, patch: Partial<Omit<DocTemplate, 'id' | 'createdAt'>>) => void;
  deleteTemplate: (id: string) => void;
  /** Marca o template como padrão do seu nível (desmarca os demais). */
  setDefault: (id: string) => void;
};

/** Templates de documentação, compartilhados entre todas as collections. */
export const useTemplateStore = create<TemplateState>()(
  persist(
    (set) => ({
      templates: defaultTemplates(),

      addTemplate: (level) => {
        const now = nowIso();
        const t: DocTemplate = { id: uid(), name: 'Novo template', level, content: '', isDefault: false, createdAt: now, updatedAt: now };
        set((s) => ({ templates: [...s.templates, t] }));
        return t.id;
      },
      updateTemplate: (id, patch) =>
        set((s) => ({ templates: s.templates.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: nowIso() } : t)) })),
      deleteTemplate: (id) => set((s) => ({ templates: s.templates.filter((t) => t.id !== id) })),
      setDefault: (id) =>
        set((s) => {
          const level = s.templates.find((t) => t.id === id)?.level;
          return { templates: s.templates.map((t) => (t.level === level ? { ...t, isDefault: t.id === id } : t)) };
        }),
    }),
    { name: 'collection-editor:templates', version: 1 },
  ),
);
