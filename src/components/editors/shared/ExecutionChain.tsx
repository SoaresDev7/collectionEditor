import { useMemo } from 'react';
import { AlertTriangle, ArrowDown, Send } from 'lucide-react';
import { KIND_LABEL, type Collection, type NodeKind } from '@/types/collection';
import { executionChain, type ChainStep } from '@/lib/scripts/insights';
import { findPath } from '@/lib/tree';
import { useUiStore } from '@/store/uiStore';
import { Badge } from '@/components/ui/primitives';

const Chip = ({ children, tone = 'neutral', title }: { children: string; tone?: 'neutral' | 'accent' | 'ok' | 'warn'; title?: string }) => (
  <span title={title}>
    <Badge tone={tone}>{children}</Badge>
  </span>
);

function Step({ step, collection }: { step: ChainStep; collection: Collection }) {
  const navigate = useUiStore((s) => s.navigate);
  const open = () => {
    const path = findPath(collection, step.nodeId);
    navigate({
      nodeId: step.nodeId,
      ancestorIds: path?.slice(0, -1).map((r) => r.node.id) ?? [],
      tabKey: step.kind as NodeKind,
      tab: step.phase,
      field: step.phase,
      line: 1,
    });
  };
  return (
    <button type="button" onClick={open} className="flex w-full flex-col gap-1.5 rounded-md border border-line px-3 py-2 text-left hover:border-accent">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-xs text-muted">{KIND_LABEL[step.kind]}</span>
        <span className="font-medium">{step.nodeName}</span>
        <span className="text-xs text-muted">· {step.lines} linha(s)</span>
        {step.warnings > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs text-warn">
            <AlertTriangle size={12} /> {step.warnings} aviso(s) de escopo
          </span>
        )}
      </div>
      {(step.shared.length > 0 || step.locals.length > 0 || step.sets.length > 0 || step.reads.length > 0) && (
        <div className="flex flex-wrap items-center gap-1 text-xs">
          {step.shared.map((n) => (
            <Chip key={`s-${n}`} tone="accent" title="Compartilhada: disponível nos scripts seguintes">{`ƒ ${n}`}</Chip>
          ))}
          {step.locals.map((n) => (
            <Chip key={`l-${n}`} title="Local: só existe neste script">{`ƒ ${n} (local)`}</Chip>
          ))}
          {step.sets.map((v) => (
            <Chip key={`w-${v.name}-${v.scope}`} tone="warn" title={`Grava em pm.${v.scope}`}>{`✎ ${v.name}`}</Chip>
          ))}
          {step.reads.map((n) => (
            <Chip key={`r-${n}`} tone="ok" title="Lê a variável">{`◉ ${n}`}</Chip>
          ))}
        </div>
      )}
    </button>
  );
}

/** Todos os scripts que rodam para esta requisição, na ordem do Postman. */
export function ExecutionChain({ collection, requestId }: { collection: Collection; requestId: string }) {
  const steps = useMemo(() => executionChain(collection, requestId), [collection, requestId]);
  const pre = steps.filter((s) => s.phase === 'pre');
  const post = steps.filter((s) => s.phase === 'post');

  const column = (title: string, list: ChainStep[]) => (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">{title}</h3>
      {list.length === 0 && <p className="text-sm text-muted">Nenhum script.</p>}
      {list.map((s, i) => (
        <div key={`${s.nodeId}-${s.phase}`} className="flex flex-col items-stretch gap-2">
          <Step step={s} collection={collection} />
          {i < list.length - 1 && <ArrowDown size={14} className="self-center text-muted" />}
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted">
        Ordem em que o Postman executa os scripts desta requisição. Funções <b>compartilhadas</b> (ƒ em destaque) e variáveis
        gravadas (✎) num passo ficam disponíveis para os passos seguintes; funções <b>locais</b> não. Clique num passo para
        abrir o script.
      </p>
      {column('1. Pré-request', pre)}
      <div className="flex items-center justify-center gap-2 rounded-md border border-dashed border-line py-2 text-sm text-muted">
        <Send size={14} /> Envio da requisição
      </div>
      {column('2. Pós-request / Testes', post)}
    </div>
  );
}
