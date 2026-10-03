import type { ReactNode } from 'react';
import { Info } from 'lucide-react';

/** Aviso discreto sobre dados preservados do Postman ou contêineres sintéticos. */
export function PreservedNotice({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-2 rounded-md border border-line bg-panel-2 px-3 py-2 text-xs text-muted">
      <Info size={14} className="mt-0.5 shrink-0 text-accent" />
      <div className="min-w-0 flex-1 space-y-0.5">{children}</div>
      {action}
    </div>
  );
}

/** Lista legível do que veio do Postman e é preservado sem edição. */
export function preservedFields(raw: Record<string, unknown> | undefined, request?: Record<string, unknown>): string[] {
  const out: string[] = [];
  const auth = (request?.auth ?? raw?.auth) as { type?: string } | undefined;
  if (auth?.type) out.push(`autenticação ${auth.type}`);
  const responses = raw?.response as unknown[] | undefined;
  if (responses?.length) out.push(`${responses.length} exemplo(s) de resposta`);
  if (raw?.protocolProfileBehavior) out.push('configurações de protocolo');
  if (request?.description) out.push('descrição da requisição');
  return out;
}
