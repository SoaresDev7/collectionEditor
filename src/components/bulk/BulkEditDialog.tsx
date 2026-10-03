import { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, MinusCircle } from 'lucide-react';
import { HTTP_METHODS, type HttpMethod } from '@/types/collection';
import { useActiveCollection, useCollectionStore } from '@/store/collectionStore';
import { useDialogStore } from '@/store/dialogStore';
import { confirmDialog, notify } from '@/store/feedbackStore';
import {
  OPERATION_LABEL,
  VALUE_TYPE_LABEL,
  collectTargets,
  parseValue,
  previewBulkEdit,
  type BodyEditSpec,
  type BodyOperation,
  type EditOutcome,
  type ValueType,
} from '@/lib/bulkEdit';
import { parseLoose } from '@/lib/json/loose';
import { collectPaths, parsePath } from '@/lib/json/path';
import { diffJson } from '@/lib/json/diff';
import { describeJsonChange } from '@/lib/changes/diff';
import { Badge, Button, Field, Input, Textarea, cx } from '@/components/ui/primitives';
import { LargeDialog } from '@/components/ui/LargeDialog';
import { TestIdPicker } from './TestIdPicker';

const OPERATIONS: BodyOperation[] = ['remove', 'set', 'rename', 'add'];
const VALUE_TYPES: ValueType[] = ['string', 'number', 'boolean', 'null', 'json', 'variable'];

/** Descrição curta do que mudou num body, para a pré-visualização. */
function changeSummary(o: Extract<EditOutcome, { status: 'changed' }>): string {
  const a = o.before.trim() ? parseLoose(o.before) : { ok: true as const, value: null };
  const b = parseLoose(o.after);
  if (!a.ok || !b.ok) return 'Body alterado';
  return diffJson(a.value, b.value).map(describeJsonChange).join('; ').replace(/`/g, '');
}

function OutcomeRow({ o }: { o: EditOutcome }) {
  const icon =
    o.status === 'changed' ? (
      <CheckCircle2 size={14} className="shrink-0 text-ok" />
    ) : o.status === 'skipped' ? (
      <MinusCircle size={14} className="shrink-0 text-muted" />
    ) : (
      <AlertCircle size={14} className="shrink-0 text-danger" />
    );
  return (
    <li className="flex items-start gap-2 px-3 py-1.5 text-sm">
      <span className="mt-0.5">{icon}</span>
      <span className="w-28 shrink-0 font-mono text-xs leading-5">{o.target.testIdName}</span>
      <span className={cx('w-12 shrink-0 text-[11px] leading-5 font-bold', `method-${o.target.request.method}`)}>{o.target.request.method}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate">{o.target.request.name}</span>
        <span className={cx('block font-mono text-xs', o.status === 'error' ? 'text-danger' : 'text-muted')}>
          {o.status === 'changed' ? changeSummary(o) : o.reason}
        </span>
      </span>
    </li>
  );
}

export function BulkEditDialog() {
  const state = useDialogStore((s) => s.bulkEdit);
  if (!state) return null;
  return <BulkEditForm preselect={state.preselect} />;
}

function BulkEditForm({ preselect }: { preselect: string[] }) {
  const collection = useActiveCollection();
  const applyBodies = useCollectionStore((s) => s.applyBodies);
  const close = useDialogStore((s) => s.closeBulkEdit);

  const [selected, setSelected] = useState(() => new Set(preselect));
  const [method, setMethod] = useState<HttpMethod | 'ALL'>('ALL');
  const [text, setText] = useState('');
  const [operation, setOperation] = useState<BodyOperation>('remove');
  const [path, setPath] = useState('');
  const [newKey, setNewKey] = useState('');
  const [valueType, setValueType] = useState<ValueType>('string');
  const [value, setValue] = useState('');
  const [showSkipped, setShowSkipped] = useState(false);

  const targets = useMemo(
    () => (collection ? collectTargets(collection, selected, { method, text }) : []),
    [collection, selected, method, text],
  );

  /** Campos existentes nos bodies alvo, para autocompletar o caminho. */
  const suggestions = useMemo(() => {
    const set = new Set<string>();
    for (const t of targets) {
      const parsed = t.request.body.trim() ? parseLoose(t.request.body) : null;
      if (parsed?.ok) collectPaths(parsed.value, 300).forEach((p) => set.add(p));
      if (set.size > 500) break;
    }
    return [...set].sort();
  }, [targets]);

  const needsValue = operation === 'set' || operation === 'add';
  const pathError = path.trim() && !parsePath(path) ? 'Caminho inválido. Ex.: user.email, items[0].id' : null;
  const parsedValue = needsValue ? parseValue(valueType, value) : null;
  const valueError = parsedValue && !parsedValue.ok ? parsedValue.error : null;
  const renameError = operation === 'rename' && !newKey.trim() ? 'Informe o novo nome.' : null;
  const ready = !!path.trim() && !pathError && !valueError && !renameError && targets.length > 0;

  const spec: BodyEditSpec = { operation, path, newKey, valueType, value };
  const outcomes = useMemo(
    () => (ready ? previewBulkEdit(targets, spec, parsedValue?.ok ? parsedValue.value : undefined) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, targets, operation, path, newKey, valueType, value],
  );
  const changed = outcomes.filter((o): o is Extract<EditOutcome, { status: 'changed' }> => o.status === 'changed');
  const skipped = outcomes.filter((o) => o.status === 'skipped');
  const errors = outcomes.filter((o) => o.status === 'error');

  const apply = async () => {
    const ok = await confirmDialog({
      title: 'Aplicar edição em massa',
      message: `${OPERATION_LABEL[operation]} "${path}" em ${changed.length} requisição(ões). Os bodies alterados serão reformatados com 2 espaços.`,
      confirmLabel: 'Aplicar',
    });
    if (!ok) return;
    applyBodies(changed.map((o) => ({ requestId: o.target.request.id, body: o.after })));
    notify('success', `${changed.length} requisição(ões) alterada(s). Veja o Relatório de alterações.`);
    close();
  };

  if (!collection) return null;

  return (
    <LargeDialog
      title="Edição em massa do body"
      subtitle="Selecione os IDs, escolha o campo e a operação. Nada é alterado antes de clicar em Aplicar."
      onClose={close}
      footer={
        <>
          <span className="mr-auto text-xs text-muted">
            {targets.length} requisição(ões) alvo
            {ready && ` · ${changed.length} serão alteradas · ${skipped.length} ignoradas · ${errors.length} com erro`}
          </span>
          <Button onClick={close}>Cancelar</Button>
          <Button variant="primary" disabled={!ready || changed.length === 0} onClick={apply}>
            Aplicar em {changed.length} requisição(ões)
          </Button>
        </>
      }
    >
      <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="flex min-w-0 flex-col gap-2">
          <h3 className="text-sm font-semibold">1. IDs de teste</h3>
          <TestIdPicker collection={collection} selected={selected} onChange={setSelected} />
        </section>

        <section className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">2. Requisições alvo (opcional)</h3>
            <div className="flex gap-2">
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as HttpMethod | 'ALL')}
                aria-label="Filtrar por método"
                className="h-8 rounded-md border border-line bg-panel px-2 text-sm"
              >
                <option value="ALL">Todos os métodos</option>
                {HTTP_METHODS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
              <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Nome ou URL contém…" />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">3. Campo e operação</h3>
            <div className="grid grid-cols-2 gap-1.5">
              {OPERATIONS.map((op) => (
                <label
                  key={op}
                  className={cx(
                    'flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm',
                    operation === op ? 'border-accent bg-accent-soft' : 'border-line hover:bg-panel-2',
                  )}
                >
                  <input type="radio" name="operation" checked={operation === op} onChange={() => setOperation(op)} className="accent-[var(--accent)]" />
                  {OPERATION_LABEL[op]}
                </label>
              ))}
            </div>

            <Field
              label="Caminho do campo"
              error={pathError}
              hint={operation === 'add' ? 'Objetos intermediários ausentes são criados.' : `${suggestions.length} campo(s) encontrados nos bodies alvo.`}
            >
              <Input list="bulk-paths" value={path} onChange={(e) => setPath(e.target.value)} placeholder="ex.: user.email ou items[0].id" className="font-mono" invalid={!!pathError} />
            </Field>
            <datalist id="bulk-paths">
              {suggestions.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>

            {operation === 'rename' && (
              <Field label="Novo nome da chave" error={newKey ? null : renameError}>
                <Input value={newKey} onChange={(e) => setNewKey(e.target.value)} className="font-mono" placeholder="novoNome" />
              </Field>
            )}

            {needsValue && (
              <div className="grid gap-2 sm:grid-cols-[10rem_minmax(0,1fr)]">
                <Field label="Tipo do valor">
                  <select
                    value={valueType}
                    onChange={(e) => setValueType(e.target.value as ValueType)}
                    className="h-8 rounded-md border border-line bg-panel px-2 text-sm"
                  >
                    {VALUE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {VALUE_TYPE_LABEL[t]}
                      </option>
                    ))}
                  </select>
                </Field>
                {valueType !== 'null' && (
                  <Field label="Valor" error={valueError}>
                    {valueType === 'json' ? (
                      <Textarea value={value} onChange={(e) => setValue(e.target.value)} className="min-h-16 font-mono" placeholder='{"chave": "valor"}' />
                    ) : (
                      <Input
                        value={value}
                        invalid={!!valueError}
                        onChange={(e) => setValue(e.target.value)}
                        className="font-mono"
                        placeholder={valueType === 'variable' ? 'nomeVariavel' : valueType === 'boolean' ? 'true' : ''}
                      />
                    )}
                  </Field>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">4. Pré-visualização</h3>
              {ready && (
                <>
                  <Badge tone="ok">{changed.length} alterar</Badge>
                  <Badge>{skipped.length} ignorar</Badge>
                  {errors.length > 0 && <Badge tone="danger">{errors.length} erro</Badge>}
                </>
              )}
            </div>
            {!ready ? (
              <p className="text-sm text-muted">
                {targets.length === 0 ? 'Selecione IDs com requisições.' : 'Informe o campo e a operação para ver o resultado.'}
              </p>
            ) : (
              <>
                <ul className="divide-y divide-line rounded-md border border-line">
                  {[...changed, ...errors, ...(showSkipped ? skipped : [])].map((o) => (
                    <OutcomeRow key={o.target.request.id} o={o} />
                  ))}
                  {changed.length + errors.length === 0 && !showSkipped && (
                    <li className="px-3 py-2 text-sm text-muted">Nenhuma requisição seria alterada.</li>
                  )}
                </ul>
                {skipped.length > 0 && (
                  <button type="button" className="self-start text-xs text-muted hover:text-fg" onClick={() => setShowSkipped((v) => !v)}>
                    {showSkipped ? 'Ocultar ignoradas' : `Mostrar ${skipped.length} ignorada(s) e o motivo`}
                  </button>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </LargeDialog>
  );
}
