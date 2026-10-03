import { FileText, Settings2 } from 'lucide-react';
import type { NodePath } from '@/types/collection';
import type { TemplateLevel } from '@/types/template';
import { useCollectionStore } from '@/store/collectionStore';
import { useTemplateStore } from '@/store/templateStore';
import { useDialogStore } from '@/store/dialogStore';
import { confirmDialog, notify } from '@/store/feedbackStore';
import { renderTemplate, templateContext } from '@/lib/templates';
import { IconButton, Textarea } from '@/components/ui/primitives';

/** Descrição/documentação do item, com aplicação de templates por nível. */
export function DescriptionField({ path, label }: { path: NodePath; label: string }) {
  const ref = path[path.length - 1];
  const updateNode = useCollectionStore((s) => s.updateNode);
  const level = (['folder', 'scenario', 'testId'] as const).find((k) => k === ref.kind) as TemplateLevel | undefined;
  const templates = useTemplateStore((s) => s.templates).filter((t) => t.level === level);
  const description = 'description' in ref.node ? ref.node.description : '';

  const apply = async (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;
    if (description.trim()) {
      const ok = await confirmDialog({
        title: 'Aplicar template',
        message: `A descrição atual será substituída pelo template "${template.name}". O placeholder [[descricaoAtual]] mantém o texto atual dentro do template.`,
        confirmLabel: 'Aplicar',
      });
      if (!ok) return;
    }
    updateNode(ref.node.id, { description: renderTemplate(template.content, templateContext(path)) });
    notify('success', `Template "${template.name}" aplicado.`);
  };

  return (
    <div className="flex flex-col gap-1 md:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={`desc-${ref.node.id}`} className="text-xs font-medium tracking-wide text-muted uppercase">
          {label}
        </label>
        {level && (
        <div className="flex items-center gap-1">
          <FileText size={13} className="text-muted" />
          <select
            value=""
            aria-label="Aplicar template"
            onChange={(e) => void apply(e.target.value)}
            className="h-7 rounded-md border border-line bg-panel px-1.5 text-xs"
          >
            <option value="">Aplicar template…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.isDefault ? ' (padrão)' : ''}
              </option>
            ))}
          </select>
          <IconButton label="Gerenciar templates" onClick={() => useDialogStore.getState().setTemplates(true)}>
            <Settings2 size={13} />
          </IconButton>
        </div>
        )}
      </div>
      <Textarea
        id={`desc-${ref.node.id}`}
        value={description}
        rows={level ? 6 : 3}
        className="font-mono text-[13px]"
        onChange={(e) => updateNode(ref.node.id, { description: e.target.value })}
      />
    </div>
  );
}
