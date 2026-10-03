import { useEffect, useState } from 'react';
import { useCollectionStore } from '@/store/collectionStore';
import { childArray } from '@/lib/tree';
import { isDuplicateName } from '@/lib/validation';
import { Field, Input } from '@/components/ui/primitives';
import type { NodePath } from '@/types/collection';

/** Nome do nó com validação de duplicidade no mesmo nível. Só grava quando válido. */
export function NameField({ path, label = 'Nome', hint }: { path: NodePath; label?: string; hint?: string }) {
  const ref = path[path.length - 1];
  const updateNode = useCollectionStore((s) => s.updateNode);
  const [draft, setDraft] = useState(ref.node.name);

  useEffect(() => setDraft(ref.node.name), [ref.node.id, ref.node.name]);

  const siblings = path.length > 1 ? childArray(path[path.length - 2]) ?? [] : [];
  const trimmed = draft.trim();
  const error = !trimmed
    ? 'Nome obrigatório.'
    : isDuplicateName(trimmed, siblings, ref.node.id)
      ? 'Já existe um item com este nome neste nível.'
      : null;

  const commit = () => {
    if (error) setDraft(ref.node.name);
    else if (trimmed !== ref.node.name) updateNode(ref.node.id, { name: trimmed });
  };

  return (
    <Field label={label} error={error} hint={hint}>
      <Input
        value={draft}
        invalid={!!error}
        onChange={(e) => {
          setDraft(e.target.value);
          const v = e.target.value.trim();
          if (v && !isDuplicateName(v, siblings, ref.node.id)) updateNode(ref.node.id, { name: v });
        }}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
      />
    </Field>
  );
}
