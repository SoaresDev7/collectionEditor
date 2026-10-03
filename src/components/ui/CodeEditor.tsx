import Editor, { type OnMount } from '@monaco-editor/react';
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
};

export function CodeEditor({ value, onChange, language, height = 320, path, minimap = true, onMount }: Props) {
  const theme = useUiStore((s) => s.theme);
  return (
    <div className="overflow-hidden rounded-md border border-line">
      <Editor
        height={height}
        language={language}
        path={path}
        value={value}
        theme={theme === 'dark' ? 'vs-dark' : 'vs'}
        onChange={(v) => onChange(v ?? '')}
        onMount={onMount}
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
