import { useDeferredValue, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { useActiveCollection } from '@/store/collectionStore';
import { useUiStore, type SearchModeUi } from '@/store/uiStore';
import { declaredFunctions, FIELD_LABEL, searchCollection, type SearchHit, type SearchTag } from '@/lib/search';
import { resolveVariables, scriptDefinedVariables } from '@/lib/variables';
import { findPath, walk } from '@/lib/tree';
import { Badge, IconButton, Input, cx } from '@/components/ui/primitives';
import { NodeIcon } from '@/components/ui/NodeIcon';

const MODES: { id: SearchModeUi; label: string; placeholder: string }[] = [
  { id: 'text', label: 'Texto', placeholder: 'Qualquer texto (nome, URL, body, scripts…)' },
  { id: 'variable', label: 'Variável', placeholder: 'Nome da variável, ex.: accessToken' },
  { id: 'function', label: 'Função', placeholder: 'Nome da função dos scripts' },
];

const TAG_TONE: Record<SearchTag, 'accent' | 'ok' | 'warn' | 'danger' | 'neutral'> = {
  declaração: 'accent',
  definição: 'accent',
  escrita: 'warn',
  remoção: 'danger',
  leitura: 'ok',
  uso: 'neutral',
};

const TAB_FOR_FIELD: Partial<Record<SearchHit['field'], string>> = {
  pre: 'pre',
  post: 'post',
  body: 'body',
  header: 'headers',
  variable: 'variables',
};

function Snippet({ text, query }: { text: string; query: string }) {
  const needle = query.replace(/^\{\{\s*|\s*\}\}$/g, '').trim();
  if (!needle) return <>{text}</>;
  const i = text.toLowerCase().indexOf(needle.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-accent-soft px-0.5 text-accent">{text.slice(i, i + needle.length)}</mark>
      {text.slice(i + needle.length)}
    </>
  );
}

export function SearchPanel() {
  const collection = useActiveCollection();
  const { mode, query, caseSensitive } = useUiStore((s) => s.search);
  const setSearch = useUiStore((s) => s.setSearch);
  const navigate = useUiStore((s) => s.navigate);
  const deferredQuery = useDeferredValue(query);

  const hits = useMemo(
    () => (collection ? searchCollection(collection, { mode, query: deferredQuery, caseSensitive }) : []),
    [collection, mode, deferredQuery, caseSensitive],
  );

  /** Sugestões: variáveis declaradas/criadas por script ou funções declaradas. */
  const suggestions = useMemo(() => {
    if (!collection) return [];
    if (mode === 'function') return declaredFunctions(collection);
    if (mode !== 'variable') return [];
    const names = new Set(scriptDefinedVariables(collection));
    walk({ kind: 'collection', node: collection }, (ref) => {
      if (ref.kind !== 'request') resolveVariables([ref]).forEach((r) => names.add(r.variable.key));
    });
    return [...names].sort();
  }, [collection, mode]);

  const groups = useMemo(() => {
    const map = new Map<string, SearchHit[]>();
    for (const h of hits) map.set(h.nodeId, [...(map.get(h.nodeId) ?? []), h]);
    return [...map.values()];
  }, [hits]);

  if (!collection) return null;

  const open = (hit: SearchHit) => {
    const path = findPath(collection, hit.nodeId);
    navigate({
      nodeId: hit.nodeId,
      ancestorIds: path?.slice(0, -1).map((r) => r.node.id) ?? [],
      tabKey: hit.kind,
      tab: TAB_FOR_FIELD[hit.field],
      field: hit.field,
      line: hit.line,
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-2 border-b border-line p-2">
        <div className="flex rounded-md border border-line p-0.5 text-xs">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSearch({ mode: m.id })}
              className={cx('flex-1 rounded px-2 py-1', mode === m.id ? 'bg-accent-soft font-medium text-accent' : 'text-muted hover:text-fg')}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-muted" />
          <Input
            id="usage-search"
            autoFocus
            list="search-suggestions"
            value={query}
            onChange={(e) => setSearch({ query: e.target.value })}
            placeholder={MODES.find((m) => m.id === mode)!.placeholder}
            className="pr-7 pl-7"
          />
          {query && (
            <IconButton label="Limpar" className="absolute top-1/2 right-1 -translate-y-1/2" onClick={() => setSearch({ query: '' })}>
              <X size={13} />
            </IconButton>
          )}
          <datalist id="search-suggestions">
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <div className="flex items-center justify-between text-xs text-muted">
          {mode === 'text' ? (
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={caseSensitive} onChange={(e) => setSearch({ caseSensitive: e.target.checked })} className="accent-[var(--accent)]" />
              Diferenciar maiúsculas
            </label>
          ) : (
            <span>{mode === 'variable' ? '{{var}}, pm.*.get/set e declarações' : 'Definições e chamadas nos scripts'}</span>
          )}
          {query.trim() && (
            <span>
              {hits.length}
              {hits.length >= 500 ? '+' : ''} resultado(s)
            </span>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {query.trim() && hits.length === 0 && <p className="px-3 py-4 text-sm text-muted">Nenhum uso encontrado.</p>}
        {groups.map((list) => {
          const first = list[0];
          const ref = findPath(collection, first.nodeId)?.at(-1);
          return (
            <div key={first.nodeId} className="border-b border-line">
              <button
                type="button"
                onClick={() => open(first)}
                className="flex w-full items-center gap-1.5 px-3 pt-2 pb-1 text-left text-xs font-medium hover:text-accent"
                title={first.trail}
              >
                {ref && <NodeIcon refNode={ref} />}
                <span className="truncate">{first.trail}</span>
              </button>
              <ul className="pb-1.5">
                {list.map((h, i) => (
                  <li key={i}>
                    <button type="button" onClick={() => open(h)} className="flex w-full items-start gap-2 px-3 py-1 text-left hover:bg-panel-2">
                      <span className="w-20 shrink-0 text-[11px] text-muted">
                        {FIELD_LABEL[h.field]}
                        {h.line ? `:${h.line}` : ''}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-mono text-xs">
                        <Snippet text={h.snippet} query={query} />
                      </span>
                      {h.tag && <Badge tone={TAG_TONE[h.tag]}>{h.tag}</Badge>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
