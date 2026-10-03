import { useEffect, useState } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type * as monaco from 'monaco-editor';
import { useUiStore } from '@/store/uiStore';
import '@/lib/monaco';

type Props = {
  value: string;
  onChange: (value: string) => void;
  language: 'javascript' | 'json';
  height?: number | string;
  /** Usado como URI do modelo, preservando undo/cursor por item. */
  path?: string;
  minimap?: boolean;
  onMount?: OnMount;
  /** Identifica o editor para pedidos de "ir para a linha" vindos da busca. */
  revealTarget?: { nodeId: string; field: string };
};

export function CodeEditor({ value, onChange, language, height = 320, path, minimap = true, onMount, revealTarget }: Props) {
  const theme = useUiStore((s) => s.theme);
  const reveal = useUiStore((s) => s.reveal);
  const [editor, setEditor] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    if (!editor || !reveal || !revealTarget) return;
    if (reveal.nodeId !== revealTarget.nodeId || reveal.field !== revealTarget.field) return;
    const line = Math.min(reveal.line, editor.getModel()?.getLineCount() ?? reveal.line);
    editor.revealLineInCenter(line);
    editor.setSelection({ startLineNumber: line, startColumn: 1, endLineNumber: line, endColumn: Number.MAX_SAFE_INTEGER });
  }, [editor, reveal, revealTarget?.nodeId, revealTarget?.field]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="overflow-hidden rounded-md border border-line">
      <Editor
        height={height}
        language={language}
        path={path}
        value={value}
        theme={theme === 'dark' ? 'vs-dark' : 'vs'}
        onChange={(v) => onChange(v ?? '')}
        onMount={(ed, m) => {
          setEditor(ed);
          onMount?.(ed, m);
        }}
        options={{
          minimap: { enabled: minimap },
          fontSize: 13,
          fontFamily: 'JetBrains Mono, ui-monospace, Menlo, Consolas, monospace',
          tabSize: 2,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          formatOnPaste: true,
          wordWrap: 'on',
          fixedOverflowWidgets: true,
        }}
      />
    </div>
  );
}
