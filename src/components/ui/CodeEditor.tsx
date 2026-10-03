import { lazy, Suspense } from 'react';
import type { CodeEditorProps } from './MonacoCodeEditor';

/**
 * O Monaco (~ alguns MB) só é baixado quando o primeiro editor de código
 * aparece na tela, deixando a abertura da ferramenta rápida.
 */
const MonacoCodeEditor = lazy(() => import('./MonacoCodeEditor'));

export function CodeEditor(props: CodeEditorProps) {
  const height = props.height ?? 320;
  return (
    <Suspense
      fallback={
        <div
          style={{ height }}
          className="flex items-center justify-center rounded-md border border-line bg-panel-2 text-xs text-muted"
        >
          Carregando editor…
        </div>
      }
    >
      <MonacoCodeEditor {...props} />
    </Suspense>
  );
}
