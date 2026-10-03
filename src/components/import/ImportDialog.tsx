import { useMemo, useState, type DragEvent } from 'react';
import { AlertTriangle, FileJson, Info, ShieldCheck, Upload } from 'lucide-react';
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
  /** Conteúdo do arquivo escolhido (fica fora da caixa de texto, que travaria com arquivos grandes). */
  const [fileText, setFileText] = useState('');
  const [pasted, setPasted] = useState('');
  const text = fileText || pasted;
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const result = useMemo(() => {
    if (!text.trim()) return null;
    try {
      return { ok: true as const, ...importPostman(JSON.parse(text)) };
    } catch (e) {
      const message = e instanceof ImportError ? e.message : e instanceof SyntaxError ? `JSON inválido: ${e.message}` : String(e);
      return { ok: false as const, error: message };
    }
  }, [text]);

  const readFile = async (file: File) => {
    setFileName(file.name);
    setPasted('');
    setFileText(await file.text());
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
      subtitle="Formato Postman v2.0/v2.1. A collection entra exatamente como está; mudanças só acontecem pelas ações que você escolher depois."
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
            {fileName && <span className="text-xs text-muted">{(fileText.length / 1e6).toFixed(1)} MB</span>}
            <span className="text-xs text-muted">.json exportado pelo Postman ou por esta ferramenta</span>
            <input type="file" accept=".json,application/json" className="hidden" onChange={(e) => e.target.files?.[0] && void readFile(e.target.files[0])} />
          </label>
          <details className="text-sm">
            <summary className="cursor-pointer text-muted">…ou cole o JSON</summary>
            <Textarea
              value={pasted}
              onChange={(e) => {
                setFileName(null);
                setFileText('');
                setPasted(e.target.value);
              }}
              className="mt-2 min-h-40 font-mono text-xs"
              placeholder='{"info": {...}, "item": [...]}'
            />
          </details>
          <p className="flex items-start gap-2 rounded-md border border-ok/40 bg-ok/10 p-3 text-sm">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-ok" />
            <span>
              Nada é renomeado, reordenado ou convertido. Nomes, scripts, variáveis, autenticação, exemplos de resposta e
              campos que a ferramenta não edita são preservados e voltam iguais na exportação.
            </span>
          </p>
        </section>

        <section className="flex flex-col gap-3 text-sm">
          <h3 className="font-semibold">Como a estrutura é mapeada</h3>
          <ul className="list-disc space-y-1 pl-5 text-muted">
            <li>Pasta de 1º nível → <b className="text-fg">Folder</b>; 2º nível → <b className="text-fg">Cenário</b>; 3º nível → <b className="text-fg">ID de Teste</b></li>
            <li>Pastas abaixo do 3º nível continuam existindo dentro do ID e são recriadas na exportação</li>
            <li>
              Requisições fora desse encaixe (ex.: soltas na raiz) ficam em contêineres <i>sintéticos</i>, só para navegação
              na ferramenta: eles não viram pastas na exportação
            </li>
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
                {result.stats.synthetic > 0 && <Badge tone="accent">{result.stats.synthetic} contêiner(es) sintético(s)</Badge>}
              </div>
              <div className="max-h-48 overflow-y-auto text-xs">
                {result.collection.folders.map((f) => (
                  <div key={f.id} className="mt-1">
                    <div className="font-medium">{f.name}</div>
                    {f.scenarios.map((s) => (
                      <div key={s.id} className="pl-3 text-muted">
                        {s.name} — {s.testIds.length} item(ns)
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              {result.notes.length > 0 && (
                <details className="text-xs text-muted" open={result.notes.length <= 5}>
                  <summary className="flex cursor-pointer items-center gap-1">
                    <Info size={12} /> {result.notes.length} item(ns) preservado(s) sem edição na ferramenta
                  </summary>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5">
                    {result.notes.map((w, i) => (
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
