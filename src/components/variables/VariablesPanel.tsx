import { useMemo } from 'react';
import { Copy, Zap } from 'lucide-react';
import type { Collection, NodePath, VariableScope } from '@/types/collection';
import { resolveVariables, scriptDefinedVariables, type ResolvedVariable } from '@/lib/variables';
import { useUiStore } from '@/store/uiStore';
import { notify } from '@/store/feedbackStore';
import { IconButton, cx } from '@/components/ui/primitives';

const SCOPE_LABEL: Record<VariableScope, string> = {
  global: 'Global (collection)',
  folder: 'Folder',
  scenario: 'Cenário',
  testId: 'ID de Teste',
};

const copyRef = (key: string) => {
  void navigator.clipboard?.writeText(`{{${key}}}`);
  notify('info', `{{${key}}} copiado.`);
};

function VariableRow({ r }: { r: ResolvedVariable }) {
  const select = useUiStore((s) => s.select);
  return (
    <li className="group flex items-start gap-2 px-3 py-1.5 hover:bg-panel-2">
      <div className="min-w-0 flex-1">
        <div className={cx('truncate font-mono text-[13px]', r.overridden && 'text-muted line-through')}>{r.variable.key}</div>
        <div className="truncate font-mono text-xs text-muted" title={r.variable.value}>
          {r.variable.value || <em>vazio</em>}
        </div>
        <button type="button" className="text-[11px] text-muted hover:text-accent" onClick={() => select(r.sourceId)}>
          {r.sourceName}
          {r.overridden && ' · sobrescrita'}
        </button>
      </div>
      <IconButton label="Copiar referência" className="opacity-0 group-hover:opacity-100" onClick={() => copyRef(r.variable.key)}>
        <Copy size={13} />
      </IconButton>
    </li>
  );
}

/** Referência rápida das variáveis visíveis no item selecionado. */
export function VariablesPanel({ path }: { path: NodePath }) {
  const collection = path[0].node as Collection;
  const resolved = useMemo(() => resolveVariables(path), [path]);
  const runtime = useMemo(() => {
    const declared = new Set(resolved.map((r) => r.variable.key));
    return [...scriptDefinedVariables(collection)].filter((k) => !declared.has(k)).sort();
  }, [collection, resolved]);

  const groups = (['testId', 'scenario', 'folder', 'global'] as VariableScope[])
    .map((scope) => ({ scope, items: resolved.filter((r) => r.scope === scope) }))
    .filter((g) => g.items.length);

  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-line bg-panel">
      <div className="border-b border-line px-3 py-2.5">
        <h2 className="text-sm font-semibold">Variáveis disponíveis</h2>
        <p className="text-xs text-muted">Do escopo mais interno ao global.</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        {groups.length === 0 && runtime.length === 0 && <p className="px-3 py-4 text-sm text-muted">Nenhuma variável.</p>}
        {groups.map((g) => (
          <section key={g.scope}>
            <h3 className="px-3 pt-3 pb-1 text-[11px] font-semibold tracking-wider text-muted uppercase">{SCOPE_LABEL[g.scope]}</h3>
            <ul>
              {g.items.map((r) => (
                <VariableRow key={r.variable.id} r={r} />
              ))}
            </ul>
          </section>
        ))}
        {runtime.length > 0 && (
          <section>
            <h3 className="flex items-center gap-1 px-3 pt-3 pb-1 text-[11px] font-semibold tracking-wider text-muted uppercase">
              <Zap size={12} /> Definidas por script
            </h3>
            <ul>
              {runtime.map((key) => (
                <li key={key} className="group flex items-center gap-2 px-3 py-1 hover:bg-panel-2">
                  <span className="min-w-0 flex-1 truncate font-mono text-[13px]">{key}</span>
                  <IconButton label="Copiar referência" className="opacity-0 group-hover:opacity-100" onClick={() => copyRef(key)}>
                    <Copy size={13} />
                  </IconButton>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </aside>
  );
}
