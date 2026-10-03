import { useMemo } from 'react';
import { ListOrdered } from 'lucide-react';
import { CHILD_KIND, KIND_LABEL, SCOPE_BY_KIND, type NodePath, type NodeRef, type Variable } from '@/types/collection';
import { useCollectionStore } from '@/store/collectionStore';
import { useUiStore } from '@/store/uiStore';
import { confirmDialog, notify } from '@/store/feedbackStore';
import { childrenOf, nearest, walk } from '@/lib/tree';
import { nextTestIdName } from '@/lib/nomenclature';
import { Badge, Button, Field, Input, Tabs, Textarea } from '@/components/ui/primitives';
import { EditorHeader } from './EditorHeader';
import { ChildrenList } from './ChildrenList';
import { NameField } from './shared/NameField';
import { ScriptEditor, scriptBadge } from './shared/ScriptEditor';
import { VariablesTable } from './shared/VariablesTable';

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
  const renumber = useCollectionStore((s) => s.renumberFolderTestIds);
  const tab = useUiStore((s) => s.editorTab[ref.kind] ?? (CHILD_KIND[ref.kind] ? 'children' : 'variables'));
  const setTab = (t: string) => useUiStore.getState().setEditorTab(ref.kind, t);
  const scope = SCOPE_BY_KIND[ref.kind]!;
  const childKind = CHILD_KIND[ref.kind]!;
  const counts = useMemo(() => stats(ref), [ref]);

  const folder = nearest(path, 'folder')?.node;

  return (
    <div className="flex flex-col gap-5">
      <EditorHeader refNode={ref} />

      <div className="grid gap-4 md:grid-cols-2">
        <NameField
          path={path}
          label={ref.kind === 'testId' ? 'Título do ID' : 'Nome'}
          hint={ref.kind === 'testId' && folder ? `Padrão do folder: ${folder.idNomenclaturePrefix}NNN (próximo: ${nextTestIdName(folder)})` : undefined}
        />

        {ref.kind === 'folder' && (
          <Field label="Prefixo de nomenclatura dos IDs" hint={`Ex.: ${ref.node.idNomenclaturePrefix || 'USER_'}001, ${ref.node.idNomenclaturePrefix || 'USER_'}002...`}>
            <div className="flex gap-2">
              <Input
                value={ref.node.idNomenclaturePrefix}
                className="font-mono"
                placeholder="USER_"
                onChange={(e) => updateNode(node.id, { idNomenclaturePrefix: e.target.value.toUpperCase() })}
              />
              <Button
                icon={<ListOrdered size={14} />}
                title="Renomeia todos os IDs do folder em sequência com o prefixo atual"
                onClick={async () => {
                  const ok = await confirmDialog({
                    title: 'Renumerar IDs',
                    message: `Todos os IDs deste folder serão renomeados para ${ref.node.idNomenclaturePrefix}001, ${ref.node.idNomenclaturePrefix}002... na ordem atual.`,
                    confirmLabel: 'Renumerar',
                  });
                  if (ok) {
                    renumber(node.id);
                    notify('success', 'IDs renumerados.');
                  }
                }}
              >
                Renumerar
              </Button>
            </div>
          </Field>
        )}

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

        <Field label={DESCRIPTION_LABEL[ref.kind]} className="md:col-span-2">
          <Textarea value={node.description} onChange={(e) => updateNode(node.id, { description: e.target.value })} />
        </Field>
      </div>

      <div className="flex flex-col gap-3">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'children', label: `${KIND_LABEL[childKind]}s`, badge: <Badge>{childrenOf(ref).length}</Badge> },
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
