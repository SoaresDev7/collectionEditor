import { useMemo } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { CodeEditor } from '@/components/ui/CodeEditor';
import { validateJavaScript } from '@/lib/validation';

type Props = {
  nodeId: string;
  phase: 'pre' | 'post';
  value: string;
  onChange: (value: string) => void;
  help: string;
};

/** Editor de script pré/pós-request com validação de sintaxe. */
export function ScriptEditor({ nodeId, phase, value, onChange, help }: Props) {
  const result = useMemo(() => validateJavaScript(value), [value]);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        <span>
          {help}{' '}
          <span title="Os rótulos ao lado de variáveis e funções mostram de onde elas vêm (passe o mouse para detalhes). Sublinhado amarelo = não vai funcionar neste ponto. Digite 'shared' para criar uma função compartilhada.">
            Rótulos cinza = origem de cada variável/função · digite <code className="font-mono">shared</code> para função
            compartilhada.
          </span>
        </span>
        {result.ok ? (
          <span className="flex items-center gap-1 text-ok">
            <CheckCircle2 size={13} /> Sintaxe OK
          </span>
        ) : (
          <span className="flex items-center gap-1 text-danger" title={result.message}>
            <AlertCircle size={13} /> {result.message}
          </span>
        )}
      </div>
      <CodeEditor
        language="javascript"
        path={`${nodeId}/${phase}.js`}
        value={value}
        onChange={onChange}
        height={360}
        revealTarget={{ nodeId, field: phase }}
      />
    </div>
  );
}

export const scriptBadge = (code: string) => {
  if (!code.trim()) return null;
  return validateJavaScript(code).ok ? (
    <span className="h-1.5 w-1.5 rounded-full bg-ok" title="Possui script" />
  ) : (
    <span className="h-1.5 w-1.5 rounded-full bg-danger" title="Erro de sintaxe" />
  );
};
