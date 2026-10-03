import { useState } from 'react';
import { Plus, Star, Trash2 } from 'lucide-react';
import type { TemplateLevel } from '@/types/template';
import { useTemplateStore } from '@/store/templateStore';
import { useDialogStore } from '@/store/dialogStore';
import { confirmDialog } from '@/store/feedbackStore';
import { placeholdersFor } from '@/lib/templates';
import { Badge, Button, Field, IconButton, Input, Tabs, Textarea, cx } from '@/components/ui/primitives';
import { LargeDialog } from '@/components/ui/LargeDialog';

const LEVEL_LABEL: Record<TemplateLevel, string> = { folder: 'Folder', scenario: 'Cenário', testId: 'ID de Teste' };

export function TemplatesDialog() {
  const open = useDialogStore((s) => s.templates);
  if (!open) return null;
  return <TemplatesManager />;
}

function TemplatesManager() {
  const { templates, addTemplate, updateTemplate, deleteTemplate, setDefault } = useTemplateStore();
  const [level, setLevel] = useState<TemplateLevel>('folder');
  const list = templates.filter((t) => t.level === level);
  const [selectedId, setSelectedId] = useState<string | null>(list[0]?.id ?? null);
  const current = templates.find((t) => t.id === selectedId && t.level === level) ?? list[0];

  return (
    <LargeDialog
      title="Templates de documentação"
      subtitle="Modelos em Markdown aplicados à descrição de cada nível. Use [[campo]] para inserir dados do item."
      onClose={() => useDialogStore.getState().setTemplates(false)}
    >
      <div className="flex flex-col gap-4 p-5">
        <Tabs
          value={level}
          onChange={(l) => {
            setLevel(l as TemplateLevel);
            setSelectedId(null);
          }}
          tabs={(Object.keys(LEVEL_LABEL) as TemplateLevel[]).map((l) => ({
            id: l,
            label: LEVEL_LABEL[l],
            badge: <Badge>{templates.filter((t) => t.level === l).length}</Badge>,
          }))}
        />
        <div className="grid gap-4 md:grid-cols-[14rem_minmax(0,1fr)]">
          <div className="flex flex-col gap-2">
            <ul className="divide-y divide-line rounded-md border border-line">
              {list.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(t.id)}
                    className={cx('flex w-full items-center gap-2 px-3 py-2 text-left text-sm', current?.id === t.id ? 'bg-accent-soft' : 'hover:bg-panel-2')}
                  >
                    <span className="min-w-0 flex-1 truncate">{t.name}</span>
                    {t.isDefault && <Star size={12} className="fill-current text-warn" />}
                  </button>
                </li>
              ))}
              {!list.length && <li className="px-3 py-2 text-sm text-muted">Nenhum template.</li>}
            </ul>
            <Button size="sm" icon={<Plus size={14} />} onClick={() => setSelectedId(addTemplate(level))}>
              Novo template
            </Button>
          </div>

          {current ? (
            <div className="flex min-w-0 flex-col gap-3">
              <div className="flex items-end gap-2">
                <Field label="Nome" className="flex-1">
                  <Input value={current.name} onChange={(e) => updateTemplate(current.id, { name: e.target.value })} />
                </Field>
                <Button icon={<Star size={14} />} disabled={current.isDefault} onClick={() => setDefault(current.id)}>
                  {current.isDefault ? 'Padrão' : 'Tornar padrão'}
                </Button>
                <IconButton
                  label="Excluir template"
                  className="mb-1 hover:text-danger"
                  onClick={async () => {
                    if (await confirmDialog({ title: 'Excluir template', message: `Excluir "${current.name}"?`, confirmLabel: 'Excluir', danger: true })) {
                      deleteTemplate(current.id);
                      setSelectedId(null);
                    }
                  }}
                >
                  <Trash2 size={15} />
                </IconButton>
              </div>
              <Field label="Conteúdo (Markdown)">
                <Textarea
                  value={current.content}
                  onChange={(e) => updateTemplate(current.id, { content: e.target.value })}
                  className="min-h-64 font-mono text-[13px]"
                />
              </Field>
              <div>
                <h4 className="mb-1 text-xs font-medium tracking-wide text-muted uppercase">Placeholders disponíveis</h4>
                <div className="flex flex-wrap gap-1.5">
                  {placeholdersFor(level).map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      title={p.description}
                      onClick={() => updateTemplate(current.id, { content: `${current.content}[[${p.key}]]` })}
                      className="rounded border border-line px-1.5 py-0.5 font-mono text-xs hover:border-accent hover:text-accent"
                    >
                      [[{p.key}]]
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">Crie um template para este nível.</p>
          )}
        </div>
      </div>
    </LargeDialog>
  );
}
