import { useEffect, useState } from 'react';
import { ListOrdered, Wand2 } from 'lucide-react';
import type { Collection, NodePath, Scenario } from '@/types/collection';
import { useCollectionStore } from '@/store/collectionStore';
import { confirmDialog, notify } from '@/store/feedbackStore';
import { ID_CODE_MAX, formatTestIdName, sanitizeIdCode, suggestIdCode } from '@/lib/nomenclature';
import { Button, Field, IconButton, Input } from '@/components/ui/primitives';

/** Código do cenário (até 3 letras) usado em TC-<código>-NNN. */
export function IdCodeField({ path }: { path: NodePath }) {
  const scenario = path[path.length - 1].node as Scenario;
  const collection = path[0].node as Collection;
  const setCode = useCollectionStore((s) => s.setScenarioIdCode);
  const renumber = useCollectionStore((s) => s.renumberScenarioTestIds);
  const [draft, setDraft] = useState(scenario.idCode);

  useEffect(() => setDraft(scenario.idCode), [scenario.id, scenario.idCode]);

  const sameCode = collection.folders
    .flatMap((f) => f.scenarios)
    .filter((s) => s.id !== scenario.id && s.idCode === draft)
    .map((s) => s.name);

  const commit = (value = draft) => {
    const code = sanitizeIdCode(value);
    if (!code) {
      setDraft(scenario.idCode);
      return;
    }
    if (code !== scenario.idCode) {
      setCode(scenario.id, code);
      notify('success', `Código alterado para ${code}; IDs do padrão anterior foram renomeados.`);
    }
  };

  const hint = sameCode.length
    ? `Atenção: o código ${draft} também é usado em "${sameCode[0]}"${sameCode.length > 1 ? ` e mais ${sameCode.length - 1}` : ''}.`
    : `IDs: ${formatTestIdName(draft || 'XXX', 1)}, ${formatTestIdName(draft || 'XXX', 2)}… (numeração própria deste cenário)`;

  return (
    <Field label={`Código dos IDs (até ${ID_CODE_MAX} letras)`} hint={<span className={sameCode.length ? 'text-warn' : undefined}>{hint}</span>}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 font-mono text-sm text-muted">TC-</span>
          <Input
            value={draft}
            maxLength={ID_CODE_MAX}
            className="pr-8 pl-9 font-mono tracking-widest uppercase"
            placeholder="ABC"
            onChange={(e) => setDraft(sanitizeIdCode(e.target.value))}
            onBlur={() => commit()}
            onKeyDown={(e) => e.key === 'Enter' && commit()}
          />
          <IconButton
            label="Sugerir pelo nome do cenário"
            className="absolute top-1/2 right-1 -translate-y-1/2"
            onClick={() => {
              const s = suggestIdCode(scenario.name);
              setDraft(s);
              commit(s);
            }}
          >
            <Wand2 size={13} />
          </IconButton>
        </div>
        <Button
          icon={<ListOrdered size={14} />}
          title="Renomeia os IDs deste cenário em sequência na ordem atual"
          onClick={async () => {
            const ok = await confirmDialog({
              title: 'Renumerar IDs',
              message: `Os IDs deste cenário serão renomeados para ${formatTestIdName(scenario.idCode, 1)}, ${formatTestIdName(scenario.idCode, 2)}… na ordem atual.`,
              confirmLabel: 'Renumerar',
            });
            if (ok) {
              renumber(scenario.id);
              notify('success', 'IDs renumerados.');
            }
          }}
        >
          Renumerar
        </Button>
      </div>
    </Field>
  );
}
