import { useMemo, useState, type DragEvent } from 'react';
import { AlertTriangle, FileJson, Upload } from 'lucide-react';
import { useCollectionStore } from '@/store/collectionStore';
import { useDialogStore } from '@/store/dialogStore';
import { useUiStore } from '@/store/uiStore';
import { notify } from '@/store/feedbackStore';
import { ImportError, importPostman } from '@/lib/postman/import';
import { Badge, Button, Textarea, cx } from '@/components/ui/primitives';
import { LargeDialog } from '@/components/ui/LargeDialog';

export function ImportDialog() {
  const open = useDialogStore((s) => s.importing);
  if (!open) return null;
  return <ImportContent />;
}

function ImportContent() {
  const close = () => useDialogStore.getState().setImporting(false);
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [normalizeIds, setNormalizeIds] = useState(true);
  const [dragOver, setDragOver] = useState(false);

  const result = useMemo(() => {
    if (!text.trim()) return null;
    try {
      return { ok: true as const, ...importPostman(JSON.parse(text), { normalizeIds }) };
    } catch (e) {
      const message = e instanceof ImportError ? e.message : e instanceof SyntaxError ? `JSON inválido: ${e.message}` : String(e);
      return { ok: false as const, error: message };
    }
  }, [text, normalizeIds]);

  const readFile = async (file: File) => {
    setFileName(file.name);
    setText(await file.text());
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) void readFile(file);
  };

  const doImport = () => {
    if (!result?.ok) return;
    useCollectionStore.getState().addCollection(result.collection);
    useUiStore.getState().select(null);
    notify('success', `Collection "${result.collection.name}" importada.`);
    close();
  };

  return (
    <LargeDialog
      title="Importar collection do Postman"
      subtitle="Formato Postman v2.0/v2.1 (.postman_collection.json). A importação cria uma nova collection; nada existente é alterado."
      onClose={close}
      footer={
        <>
          <Button onClick={close}>Cancelar</Button>
          <Button variant="primary" disabled={!result?.ok} onClick={doImport} icon={<Upload size={14} />}>
            Importar
          </Button>
        </>
      }
    >
      <div className="grid gap-6 p-5 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={cx(
              'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center text-sm',
              dragOver ? 'border-accent bg-accent-soft' : 'border-line hover:border-accent',
            )}
          >
            <FileJson size={28} className="text-accent" />
            <span className="font-medium">{fileName ?? 'Arraste o arquivo aqui ou clique para escolher'}</span>
            <span className="text-xs text-muted">.json exportado pelo Postman ou por esta ferramenta</span>
            <input type="file" accept=".json,application/json" className="hidden" onChange={(e) => e.target.files?.[0] && void readFile(e.target.files[0])} />
          </label>
          <details className="text-sm">
            <summary className="cursor-pointer text-muted">…ou cole o JSON</summary>
            <Textarea
              value={text}
              onChange={(e) => {
                setFileName(null);
                setText(e.target.value);
              }}
              className="mt-2 min-h-40 font-mono text-xs"
              placeholder='{"info": {...}, "item": [...]}'
            />
          </details>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={normalizeIds} onChange={(e) => setNormalizeIds(e.target.checked)} className="mt-0.5 accent-[var(--accent)]" />
            <span>
              Reorganizar IDs no padrão <code className="font-mono">TC-&lt;código&gt;-NNN</code>
              <span className="block text-xs text-muted">O nome original vira a descrição do ID. IDs que já seguem o padrão são mantidos.</span>
            </span>
          </label>
        </section>

        <section className="flex flex-col gap-3 text-sm">
          <h3 className="font-semibold">Como a estrutura é mapeada</h3>
          <ul className="list-disc space-y-1 pl-5 text-muted">
            <li>Pasta de 1º nível → <b className="text-fg">Folder</b></li>
            <li>Pasta de 2º nível → <b className="text-fg">Cenário</b> (código sugerido pelo nome)</li>
            <li>Pasta de 3º nível → <b className="text-fg">ID de Teste</b>; pastas mais profundas são achatadas dentro do ID</li>
            <li>Requisição solta num cenário → um ID por requisição; soltas acima disso → contêiner "Geral"</li>
            <li>Scripts e variáveis de cada nível são mantidos (inclusive as variáveis exportadas por esta ferramenta)</li>
          </ul>

          {result && !result.ok && (
            <p className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger/10 p-3 text-danger">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {result.error}
            </p>
          )}
          {result?.ok && (
            <div className="flex flex-col gap-2 rounded-md border border-line p-3">
              <div className="font-medium">{result.collection.name}</div>
              <div className="flex flex-wrap gap-1.5">
                <Badge>{result.stats.folders} folders</Badge>
                <Badge>{result.stats.scenarios} cenários</Badge>
                <Badge>{result.stats.testIds} IDs</Badge>
                <Badge>{result.stats.requests} requisições</Badge>
                <Badge>{result.collection.variables.length} variáveis globais</Badge>
              </div>
              <div className="max-h-48 overflow-y-auto text-xs">
                {result.collection.folders.map((f) => (
                  <div key={f.id} className="mt-1">
                    <div className="font-medium">{f.name}</div>
                    {f.scenarios.map((s) => (
                      <div key={s.id} className="pl-3 text-muted">
                        <span className="font-mono">{s.idCode}</span> {s.name} — {s.testIds.length} ID(s)
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              {result.warnings.length > 0 && (
                <details className="text-xs text-warn" open={result.warnings.length <= 5}>
                  <summary className="cursor-pointer">{result.warnings.length} aviso(s)</summary>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5">
                    {result.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </section>
      </div>
    </LargeDialog>
  );
}
