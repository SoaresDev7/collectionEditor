import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { Collection } from '@/types/collection';
import { Button, Input, cx } from '@/components/ui/primitives';

type Props = {
  collection: Collection;
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
};

function TriCheckbox({ ids, selected, onToggle, label }: { ids: string[]; selected: Set<string>; onToggle: (all: boolean) => void; label: string }) {
  const count = ids.filter((id) => selected.has(id)).length;
  const all = ids.length > 0 && count === ids.length;
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={all}
      ref={(el) => {
        if (el) el.indeterminate = count > 0 && !all;
      }}
      disabled={!ids.length}
      onChange={() => onToggle(!all)}
      className="accent-[var(--accent)]"
    />
  );
}

/** Seleção de IDs de teste agrupados por folder e cenário. */
export function TestIdPicker({ collection, selected, onChange }: Props) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const folders = useMemo(
    () =>
      collection.folders
        .map((f) => ({
          folder: f,
          scenarios: f.scenarios
            .map((s) => ({
              scenario: s,
              testIds: s.testIds.filter(
                (t) => !q || `${f.name} ${s.name} ${t.name} ${t.description}`.toLowerCase().includes(q),
              ),
            }))
            .filter((s) => s.testIds.length),
        }))
        .filter((f) => f.scenarios.length),
    [collection, q],
  );

  const visibleIds = folders.flatMap((f) => f.scenarios.flatMap((s) => s.testIds.map((t) => t.id)));

  const setMany = (ids: string[], value: boolean) => {
    const next = new Set(selected);
    for (const id of ids) {
      if (value) next.add(id);
      else next.delete(id);
    }
    onChange(next);
  };

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-muted" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filtrar IDs, cenários, folders" className="pl-7" />
        </div>
        <Button size="sm" onClick={() => setMany(visibleIds, true)}>
          Todos
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setMany(visibleIds, false)}>
          Nenhum
        </Button>
      </div>
      <p className="text-xs text-muted">{selected.size} ID(s) selecionado(s)</p>

      <div className="flex flex-col gap-3">
        {folders.map(({ folder, scenarios }) => {
          const folderIds = scenarios.flatMap((s) => s.testIds.map((t) => t.id));
          return (
            <div key={folder.id} className="rounded-md border border-line">
              <label className="flex items-center gap-2 border-b border-line bg-panel-2 px-3 py-1.5 text-sm font-medium">
                <TriCheckbox ids={folderIds} selected={selected} onToggle={(v) => setMany(folderIds, v)} label={`Selecionar folder ${folder.name}`} />
                {folder.name}
              </label>
              <div className="flex flex-col divide-y divide-line">
                {scenarios.map(({ scenario, testIds }) => {
                  const ids = testIds.map((t) => t.id);
                  return (
                    <div key={scenario.id} className="px-3 py-2">
                      <label className="mb-1.5 flex items-center gap-2 text-sm">
                        <TriCheckbox ids={ids} selected={selected} onToggle={(v) => setMany(ids, v)} label={`Selecionar cenário ${scenario.name}`} />
                        <span className="font-mono text-xs text-muted">{scenario.idCode}</span>
                        {scenario.name}
                      </label>
                      <div className="flex flex-wrap gap-1.5 pl-6">
                        {testIds.map((t) => {
                          const on = selected.has(t.id);
                          return (
                            <button
                              key={t.id}
                              type="button"
                              aria-pressed={on}
                              title={t.description || undefined}
                              onClick={() => setMany([t.id], !on)}
                              className={cx(
                                'rounded border px-2 py-0.5 font-mono text-xs',
                                on ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted hover:text-fg',
                              )}
                            >
                              {t.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {!folders.length && <p className="py-4 text-sm text-muted">Nenhum ID encontrado.</p>}
      </div>
    </div>
  );
}
