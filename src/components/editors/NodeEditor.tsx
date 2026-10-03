import type { NodePath } from '@/types/collection';
import { GroupEditor } from './GroupEditor';
import { RequestEditor } from './RequestEditor';

/** Escolhe o editor adequado ao nível do item selecionado. */
export function NodeEditor({ path }: { path: NodePath }) {
  const ref = path[path.length - 1];
  return ref.kind === 'request' ? <RequestEditor path={path} /> : <GroupEditor path={path} />;
}
