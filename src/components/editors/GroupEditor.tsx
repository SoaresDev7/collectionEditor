import { useMemo } from 'react';
import { CHILD_KIND, SCOPE_BY_KIND, type NodePath, type NodeRef, type Variable } from '@/types/collection';
import { useCollectionStore } from '@/store/collectionStore';
import { useUiStore } from '@/store/uiStore';
import { childrenOf, nearest, walk } from '@/lib/tree';
import { nextTestIdName } from '@/lib/nomenclature';
import { Badge, Button, Tabs } from '@/components/ui/primitives';
import { PreservedNotice, preservedFields } from './shared/PreservedNotice';
import { isTransparentRef } from '@/lib/synthetic';
import { EditorHeader } from './EditorHeader';
import { ChildrenList } from './ChildrenList';
import { NameField } from './shared/NameField';
import { ScriptEditor, scriptBadge } from './shared/ScriptEditor';
import { VariablesTable } from './shared/VariablesTable';
import { IdCodeField } from './shared/IdCodeField';
import { DescriptionField } from './shared/DescriptionField';

type GroupRef = Exclude<NodeRef, { kind: 'request' }>;

const SCRIPT_HELP: Record<GroupRef['kind'], { pre: string; post: string }> = {
  collection: {
    pre: 'Executa antes de TODAS as requisições da collection.',
    post: 'Executa depois de TODAS as requisições da collection.',
  },
  folder: {
    pre: 'Compartilhado entre os cenários: executa antes de cada requisição deste folder.',
    post: 'Compartilhado entre os cenários: executa depois de cada requisição deste folder.',
  },
  scenario: {
    pre: 'Executa antes de cada requisição deste cenário.',
    post: 'Executa depois de cada requisição deste cenário.',
  },
  testId: {
    pre: 'Executa antes de cada requisição deste ID.',
    post: 'Executa depois de cada requisição deste ID.',
  },
};

const CHILDREN_TAB_LABEL: Partial<Record<string, string>> = {
  folder: 'Folders',
  scenario: 'Cenários',
  testId: 'IDs de Teste',
  request: 'Requisições',
};

const DESCRIPTION_LABEL: Record<GroupRef['kind'], string> = {
  collection: 'Descrição',
  folder: 'Contexto / funcionalidade',
  scenario: 'O que será testado',
  testId: 'Resultado esperado',
};

function stats(ref: NodeRef) {
  const count = { folder: 0, scenario: 0, testId: 0, request: 0 };
  walk(ref, (r) => {
    if (r.kind !== 'collection' && r.node.id !== ref.node.id) count[r.kind]++;
  });
  return count;
}

export function GroupEditor({ path }: { path: NodePath }) {
  const ref = path[path.length - 1] as GroupRef;
  const node = ref.node;
  const updateNode = useCollectionStore((s) => s.updateNode);
  const tab = useUiStore((s) => s.editorTab[ref.kind] ?? (CHILD_KIND[ref.kind] ? 'children' : 'variables'));
  const setTab = (t: string) => useUiStore.getState().setEditorTab(ref.kind, t);
  const scope = SCOPE_BY_KIND[ref.kind]!;
  const childKind = CHILD_KIND[ref.kind]!;
  const counts = useMemo(() => stats(ref), [ref]);

  const scenario = nearest(path, 'scenario')?.node;

  return (
    <div className="flex flex-col gap-5">
      <EditorHeader refNode={ref} />

      {isTransparentRef(ref) && (
        <PreservedNotice
          action={
            <Button size="sm" onClick={() => updateNode(node.id, { synthetic: false })}>
              Tornar pasta real
            </Button>
          }
        >
          <p>
            <b className="text-fg">Contêiner sintético.</b> Não existe como pasta no Postman: foi criado só para encaixar
            requisições na hierarquia. Na exportação, os itens dentro dele saem no lugar original.
          </p>
          <p>Se você renomear, duplicar ou adicionar descrição, scripts ou variáveis, ele passa a ser exportado como pasta.</p>
        </PreservedNotice>
      )}
      {preservedFields(node.postman).length > 0 && (
        <PreservedNotice>
          Preservado do Postman (exportado sem alteração): {preservedFields(node.postman).join(', ')}.
        </PreservedNotice>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <NameField
          path={path}
          label={ref.kind === 'testId' ? 'Título do ID' : 'Nome'}
          hint={ref.kind === 'testId' && scenario ? `Padrão do cenário: TC-${scenario.idCode}-NNN (próximo livre: ${nextTestIdName(scenario)})` : undefined}
        />

        {ref.kind === 'scenario' && <IdCodeField path={path} />}

        {ref.kind === 'collection' && (
          <div className="flex flex-wrap items-end gap-2 text-xs text-muted">
            <Badge>{counts.folder} folders</Badge>
            <Badge>{counts.scenario} cenários</Badge>
            <Badge>{counts.testId} IDs</Badge>
            <Badge>{counts.request} requisições</Badge>
            <span className="w-full">
              Criada em {new Date(ref.node.createdAt).toLocaleString()} · Atualizada em{' '}
              {new Date(ref.node.updatedAt).toLocaleString()}
            </span>
          </div>
        )}

        <DescriptionField path={path} label={DESCRIPTION_LABEL[ref.kind]} />
      </div>

      <div className="flex flex-col gap-3">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'children', label: CHILDREN_TAB_LABEL[childKind], badge: <Badge>{childrenOf(ref).length}</Badge> },
            { id: 'variables', label: 'Variáveis', badge: node.variables.length ? <Badge>{node.variables.length}</Badge> : null },
            { id: 'pre', label: 'Pré-request', badge: scriptBadge(node.preRequestScripts) },
            { id: 'post', label: 'Pós-request', badge: scriptBadge(node.postRequestScripts) },
          ]}
        />
        {tab === 'children' && <ChildrenList refNode={ref} />}
        {tab === 'variables' && (
          <VariablesTable
            scope={scope}
            variables={node.variables}
            onChange={(variables: Variable[]) => updateNode(node.id, { variables })}
          />
        )}
        {tab === 'pre' && (
          <ScriptEditor
            key={`${node.id}-pre`}
            nodeId={node.id}
            phase="pre"
            help={SCRIPT_HELP[ref.kind].pre}
            value={node.preRequestScripts}
            onChange={(preRequestScripts) => updateNode(node.id, { preRequestScripts })}
          />
        )}
        {tab === 'post' && (
          <ScriptEditor
            key={`${node.id}-post`}
            nodeId={node.id}
            phase="post"
            help={SCRIPT_HELP[ref.kind].post}
            value={node.postRequestScripts}
            onChange={(postRequestScripts) => updateNode(node.id, { postRequestScripts })}
          />
        )}
      </div>
    </div>
  );
}
