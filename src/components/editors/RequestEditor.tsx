import { useEffect, useMemo } from 'react';
import { AlertTriangle, Braces, CheckCircle2, XCircle } from 'lucide-react';
import { HTTP_METHODS, type Collection, type HttpMethod, type NodePath, type Request, type TestId } from '@/types/collection';
import { PreservedNotice, preservedFields } from './shared/PreservedNotice';
import { ExecutionChain } from './shared/ExecutionChain';
import { useCollectionStore } from '@/store/collectionStore';
import { useUiStore } from '@/store/uiStore';
import { notify } from '@/store/feedbackStore';
import { formatJson, validateJson, validateUrl } from '@/lib/validation';
import { interpolate, resolveVariables, scriptDefinedVariables, undefinedVariables, variableMap } from '@/lib/variables';
import { setCompletionVariables } from '@/lib/monaco/completionVariables';
import { Badge, Button, Tabs, cx } from '@/components/ui/primitives';
import { CodeEditor } from '@/components/ui/CodeEditor';
import { EditorHeader } from './EditorHeader';
import { NameField } from './shared/NameField';
import { HeadersTable } from './shared/HeadersTable';
import { ScriptEditor, scriptBadge } from './shared/ScriptEditor';

/** Destaca {{variáveis}} não resolvidas no texto já interpolado. */
function Highlighted({ text }: { text: string }) {
  const parts = text.split(/(\{\{[^{}]+\}\})/g);
  return (
    <>
      {parts.map((p, i) =>
        /^\{\{[^$].*\}\}$/.test(p) ? (
          <mark key={i} className="rounded bg-warn/20 px-0.5 text-warn">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

function Preview({ request, values }: { request: Request; values: Map<string, string> }) {
  const body = interpolate(request.body, values);
  const pretty = formatJson(body) ?? body;
  return (
    <div className="flex flex-col gap-3 font-mono text-[13px]">
      <p className="font-sans text-xs text-muted">
        Valores iniciais interpolados. Variáveis definidas por script em tempo de execução aparecem destacadas.
      </p>
      <div className="rounded-md border border-line bg-panel-2 p-3 break-all">
        <span className={cx('mr-2 font-bold', `method-${request.method}`)}>{request.method}</span>
        <Highlighted text={interpolate(request.url, values)} />
      </div>
      {request.headers.some((h) => h.enabled && h.key) && (
        <div className="rounded-md border border-line bg-panel-2 p-3">
          {request.headers
            .filter((h) => h.enabled && h.key)
            .map((h) => (
              <div key={h.id} className="break-all">
                <span className="text-muted">{h.key}:</span> <Highlighted text={interpolate(h.value, values)} />
              </div>
            ))}
        </div>
      )}
      {request.body.trim() && (
        <pre className="overflow-auto rounded-md border border-line bg-panel-2 p-3 whitespace-pre-wrap">
          <Highlighted text={pretty} />
        </pre>
      )}
    </div>
  );
}

export function RequestEditor({ path }: { path: NodePath }) {
  const ref = path[path.length - 1];
  if (ref.kind !== 'request') throw new Error('RequestEditor requer uma requisição');
  const request = ref.node;
  const collection = path[0].node as Collection;

  const updateNode = useCollectionStore((s) => s.updateNode);
  const update = (patch: Partial<Request>) => updateNode(request.id, patch);
  const tab = useUiStore((s) => s.editorTab.request ?? 'body');
  const setTab = (t: string) => useUiStore.getState().setEditorTab('request', t);

  const values = useMemo(() => variableMap(path), [path]);
  const runtime = useMemo(() => scriptDefinedVariables(collection), [collection]);
  const missing = useMemo(
    () =>
      undefinedVariables(
        [request.url, request.body, ...request.headers.filter((h) => h.enabled).map((h) => h.value)],
        path,
        runtime,
      ),
    [request, path, runtime],
  );

  useEffect(() => {
    setCompletionVariables([...new Set([...resolveVariables(path).map((r) => r.variable.key), ...runtime])]);
  }, [path, runtime]);

  const urlCheck = validateUrl(interpolate(request.url, values));
  const bodyCheck = validateJson(request.body);
  const bodyIgnored = request.body.trim() && (request.method === 'GET' || request.method === 'HEAD');

  const rawRequest = (typeof request.postman?.request === 'object' ? request.postman.request : undefined) as Record<string, unknown> | undefined;
  const preserved = preservedFields(request.postman, rawRequest);
  const rawBodyMode = (rawRequest?.body as { mode?: string } | undefined)?.mode;
  const nonRawBody = rawBodyMode && rawBodyMode !== 'raw' && !request.body.trim() ? rawBodyMode : null;
  const testId = path[path.length - 2]?.node as TestId | undefined;
  const subfolderTrail = request.folderPath
    ?.map((k) => String(testId?.subfolders?.[k]?.name ?? '?'))
    .join(' › ');
  const methods: string[] = HTTP_METHODS.includes(request.method) ? [...HTTP_METHODS] : [...HTTP_METHODS, request.method];

  const formatBody = () => {
    const formatted = formatJson(request.body);
    if (formatted === null) notify('error', 'Body não é um JSON válido (variáveis sem aspas não podem ser formatadas).');
    else update({ body: formatted });
  };

  return (
    <div className="flex flex-col gap-5">
      <EditorHeader refNode={ref} />

      {(preserved.length > 0 || nonRawBody || subfolderTrail) && (
        <PreservedNotice>
          {subfolderTrail && (
            <p>
              Dentro das pastas do Postman: <b className="text-fg">{subfolderTrail}</b> (recriadas na exportação).
            </p>
          )}
          {preserved.length > 0 && <p>Preservado do Postman (exportado sem alteração): {preserved.join(', ')}.</p>}
          {nonRawBody && (
            <p>
              Body do tipo <b className="text-fg">{nonRawBody}</b> preservado. Se você escrever um body aqui, ele substitui o
              original por um body raw.
            </p>
          )}
        </PreservedNotice>
      )}

      <div className="flex flex-col gap-1">
        <div className="flex gap-2">
          <select
            value={request.method}
            onChange={(e) => update({ method: e.target.value as HttpMethod })}
            aria-label="Método HTTP"
            className={cx('h-9 rounded-md border border-line bg-panel px-2 font-mono text-sm font-bold', `method-${request.method}`)}
          >
            {methods.map((m) => (
              <option key={m} value={m} className={`method-${m}`}>
                {m}
              </option>
            ))}
          </select>
          <input
            value={request.url}
            onChange={(e) => update({ url: e.target.value })}
            placeholder="{{baseUrl}}/recurso"
            aria-label="URL"
            spellCheck={false}
            className={cx(
              'h-9 min-w-0 flex-1 rounded-md border bg-panel px-3 font-mono text-sm focus:ring-2 focus:ring-accent/40 focus:outline-none',
              urlCheck.ok ? 'border-line' : 'border-danger',
            )}
          />
        </div>
        {!urlCheck.ok && <span className="text-xs text-danger">{urlCheck.message}</span>}
        {missing.length > 0 && (
          <span className="flex flex-wrap items-center gap-1 text-xs text-warn">
            <AlertTriangle size={13} /> Variáveis não definidas:
            {missing.map((m) => (
              <code key={m} className="rounded bg-warn/15 px-1">{`{{${m}}}`}</code>
            ))}
          </span>
        )}
      </div>

      <div className="max-w-md">
        <NameField path={path} />
      </div>

      <div className="flex flex-col gap-3">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            {
              id: 'body',
              label: 'Body',
              badge: request.body.trim() ? (
                bodyCheck.ok ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-ok" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-danger" />
                )
              ) : null,
            },
            {
              id: 'headers',
              label: 'Headers',
              badge: request.headers.length ? <Badge>{request.headers.filter((h) => h.enabled).length}</Badge> : null,
            },
            { id: 'pre', label: 'Pré-request', badge: scriptBadge(request.preRequestScripts) },
            { id: 'post', label: 'Pós-request / Testes', badge: scriptBadge(request.postRequestScripts) },
            { id: 'preview', label: 'Visualizar' },
            { id: 'execution', label: 'Ordem de execução' },
          ]}
        />

        {tab === 'body' && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-1">
                {bodyCheck.ok ? (
                  <span className="flex items-center gap-1 text-ok">
                    <CheckCircle2 size={13} /> JSON válido
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-danger">
                    <XCircle size={13} /> {bodyCheck.message}
                  </span>
                )}
                {bodyIgnored && <span className="ml-2 text-warn">Body é ignorado em {request.method}.</span>}
              </span>
              <Button size="sm" icon={<Braces size={14} />} onClick={formatBody}>
                Formatar JSON
              </Button>
            </div>
            <CodeEditor
              key={request.id}
              language="json"
              path={`${request.id}/body.json`}
              value={request.body}
              onChange={(body) => update({ body })}
              height={360}
              revealTarget={{ nodeId: request.id, field: 'body' }}
            />
          </div>
        )}
        {tab === 'headers' && <HeadersTable headers={request.headers} onChange={(headers) => update({ headers })} />}
        {tab === 'pre' && (
          <ScriptEditor
            key={`${request.id}-pre`}
            nodeId={request.id}
            phase="pre"
            help="Executa antes desta requisição (depois dos scripts dos níveis acima)."
            value={request.preRequestScripts}
            onChange={(preRequestScripts) => update({ preRequestScripts })}
          />
        )}
        {tab === 'post' && (
          <ScriptEditor
            key={`${request.id}-post`}
            nodeId={request.id}
            phase="post"
            help="Executa depois da resposta. Use pm.test(...) para as asserções."
            value={request.postRequestScripts}
            onChange={(postRequestScripts) => update({ postRequestScripts })}
          />
        )}
        {tab === 'preview' && <Preview request={request} values={values} />}
        {tab === 'execution' && <ExecutionChain collection={collection} requestId={request.id} />}
      </div>
    </div>
  );
}
