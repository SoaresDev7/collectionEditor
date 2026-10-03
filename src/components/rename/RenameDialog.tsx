import { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useActiveCollection, useCollectionStore } from '@/store/collectionStore';
import { useDialogStore } from '@/store/dialogStore';
import { confirmDialog, notify } from '@/store/feedbackStore';
import { previewRename, type RenameMode, type RenameSpec } from '@/lib/bulkRename';
import { Badge, Button, Field, Input, cx } from '@/components/ui/primitives';
import { LargeDialog } from '@/components/ui/LargeDialog';
import { TestIdPicker } from '@/components/bulk/TestIdPicker';

const MODES: { id: RenameMode; label: string; help: string }[] = [
  { id: 'pattern', label: 'Padrão TC-<código>-NNN', help: 'Renumera os IDs selecionados de cada cenário, na ordem atual.' },
  { id: 'replace', label: 'Localizar e substituir', help: 'Troca um trecho do nome (aceita expressão regular).' },
  { id: 'affix', label: 'Prefixo / sufixo', help: 'Adiciona texto antes ou depois do nome.' },
];

export function RenameDialog() {
  const state = useDialogStore((s) => s.rename);
  if (!state) return null;
  return <RenameContent preselect={state.preselect} />;
}

function RenameContent({ preselect }: { preselect: string[] }) {
  const collection = useActiveCollection();
  const renameNodes = useCollectionStore((s) => s.renameNodes);
  const close = useDialogStore((s) => s.closeRename);

  const [selected, setSelected] = useState(() => new Set(preselect));
  const [mode, setMode] = useState<RenameMode>('pattern');
  const [start, setStart] = useState('1');
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [regex, setRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [prefix, setPrefix] = useState('');
  const [suffix, setSuffix] = useState('');

  const { rows, error } = useMemo(() => {
    if (!collection) return { rows: [], error: null };
    const spec: RenameSpec =
      mode === 'pattern'
        ? { mode, start: Math.max(1, Number(start) || 1) }
        : mode === 'replace'
          ? { mode, find, replace, regex, caseSensitive }
          : { mode, prefix, suffix };
    try {
      return { rows: previewRename(collection, selected, spec), error: null };
    } catch (e) {
      return { rows: [], error: e instanceof Error ? `Expressão regular inválida: ${e.message}` : 'Erro' };
    }
  }, [collection, selected, mode, start, find, replace, regex, caseSensitive, prefix, suffix]);

  const changes = rows.filter((r) => r.to !== r.from && !r.conflict);
  const conflicts = rows.filter((r) => r.conflict);

  const apply = async () => {
    const ok = await confirmDialog({
      title: 'Renomear IDs',
      message: `Renomear ${changes.length} ID(s)?${conflicts.length ? ` ${conflicts.length} com conflito serão ignorados.` : ''} Os IDs de cada cenário serão reordenados pelo número.`,
      confirmLabel: 'Renomear',
    });
    if (!ok) return;
    renameNodes(changes.map((r) => ({ id: r.id, name: r.to })));
    notify('success', `${changes.length} ID(s) renomeado(s).`);
    close();
  };

  if (!collection) return null;

  return (
    <LargeDialog
      title="Renomear IDs em massa"
      subtitle="Selecione os IDs, escolha a regra e confira a pré-visualização."
      onClose={close}
      footer={
        <>
          <span className="mr-auto text-xs text-muted">
            {selected.size} selecionado(s) · {changes.length} serão renomeados · {conflicts.length} com conflito
          </span>
          <Button onClick={close}>Cancelar</Button>
          <Button variant="primary" disabled={!changes.length} onClick={apply}>
            Renomear {changes.length} ID(s)
          </Button>
        </>
      }
    >
      <div className="grid gap-6 p-5 lg:grid-cols-2">
        <section className="flex min-w-0 flex-col gap-2">
          <h3 className="text-sm font-semibold">1. IDs de teste</h3>
          <TestIdPicker collection={collection} selected={selected} onChange={setSelected} />
        </section>

        <section className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">2. Regra</h3>
            {MODES.map((m) => (
              <label
                key={m.id}
                className={cx(
                  'flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm',
                  mode === m.id ? 'border-accent bg-accent-soft' : 'border-line hover:bg-panel-2',
                )}
              >
                <input type="radio" name="rename-mode" checked={mode === m.id} onChange={() => setMode(m.id)} className="mt-0.5 accent-[var(--accent)]" />
                <span>
                  {m.label}
                  <span className="block text-xs text-muted">{m.help}</span>
                </span>
              </label>
            ))}
          </div>

          {mode === 'pattern' && (
            <Field label="Começar em" hint="Ex.: 10 gera TC-XXX-010, TC-XXX-011…">
              <Input type="number" min={1} value={start} onChange={(e) => setStart(e.target.value)} className="w-32" />
            </Field>
          )}
          {mode === 'replace' && (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Localizar" error={error}>
                  <Input value={find} onChange={(e) => setFind(e.target.value)} className="font-mono" invalid={!!error} />
                </Field>
                <Field label="Substituir por" hint={regex ? 'Use $1, $2… para grupos' : undefined}>
                  <Input value={replace} onChange={(e) => setReplace(e.target.value)} className="font-mono" />
                </Field>
              </div>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={regex} onChange={(e) => setRegex(e.target.checked)} className="accent-[var(--accent)]" />
                  Expressão regular
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} className="accent-[var(--accent)]" />
                  Diferenciar maiúsculas
                </label>
              </div>
            </div>
          )}
          {mode === 'affix' && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Prefixo">
                <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} className="font-mono" />
              </Field>
              <Field label="Sufixo">
                <Input value={suffix} onChange={(e) => setSuffix(e.target.value)} className="font-mono" />
              </Field>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">3. Pré-visualização</h3>
              {changes.length > 0 && <Badge tone="ok">{changes.length} renomear</Badge>}
              {conflicts.length > 0 && <Badge tone="danger">{conflicts.length} conflito</Badge>}
            </div>
            {rows.length === 0 ? (
              <p className="text-sm text-muted">Selecione IDs{mode === 'replace' ? ' e informe o texto a localizar' : ''}.</p>
            ) : (
              <ul className="max-h-[45vh] divide-y divide-line overflow-y-auto rounded-md border border-line">
                {rows.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                    <span className="w-28 shrink-0 truncate text-xs text-muted" title={r.scenarioName}>
                      {r.scenarioName}
                    </span>
                    <span className="font-mono text-xs">{r.from}</span>
                    <ArrowRight size={12} className="shrink-0 text-muted" />
                    <span className={cx('font-mono text-xs', r.conflict ? 'text-danger' : r.to === r.from ? 'text-muted' : 'text-ok')}>{r.to || '∅'}</span>
                    {r.conflict && <span className="ml-auto text-[11px] text-danger">{r.conflict}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </LargeDialog>
  );
}
