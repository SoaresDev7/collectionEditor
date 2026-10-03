import { Plus, Trash2 } from 'lucide-react';
import type { Variable, VariableScope, VariableType } from '@/types/collection';
import { createVariable } from '@/lib/factories';
import { validateVariableName } from '@/lib/validation';
import { Button, IconButton, Input, cx } from '@/components/ui/primitives';

type Props = {
  scope: VariableScope;
  variables: Variable[];
  onChange: (variables: Variable[]) => void;
};

const TYPES: VariableType[] = ['string', 'number', 'boolean'];

function valueError(v: Variable): string | null {
  if (v.type === 'number' && v.value !== '' && !v.value.includes('{{') && Number.isNaN(Number(v.value))) return 'Não é número';
  if (v.type === 'boolean' && v.value !== '' && !['true', 'false'].includes(v.value)) return 'Use true/false';
  return null;
}

/** Editor visual de variáveis de um escopo. */
export function VariablesTable({ scope, variables, onChange }: Props) {
  const update = (id: string, patch: Partial<Variable>) =>
    onChange(variables.map((v) => (v.id === id ? { ...v, ...patch } : v)));

  const keyCount = new Map<string, number>();
  for (const v of variables) if (v.key) keyCount.set(v.key, (keyCount.get(v.key) ?? 0) + 1);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted">
        Valores definidos aqui são inicializados ao entrar neste nível e valem para tudo que está abaixo dele.
        Escopos internos sobrescrevem chaves de escopos externos.
      </p>
      <div className="overflow-x-auto rounded-md border border-line">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-panel-2 text-left text-xs text-muted uppercase">
            <tr>
              <th className="px-2 py-1.5 font-medium">Chave</th>
              <th className="px-2 py-1.5 font-medium">Valor inicial</th>
              <th className="w-28 px-2 py-1.5 font-medium">Tipo</th>
              <th className="px-2 py-1.5 font-medium">Descrição</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {variables.map((v) => {
              const nameCheck = validateVariableName(v.key);
              const keyErr = !nameCheck.ok ? nameCheck.message : (keyCount.get(v.key) ?? 0) > 1 ? 'Chave duplicada' : null;
              const valErr = valueError(v);
              return (
                <tr key={v.id} className="border-t border-line align-top">
                  <td className="p-1">
                    <Input
                      value={v.key}
                      invalid={!!keyErr}
                      title={keyErr ?? undefined}
                      placeholder="nomeVariavel"
                      className="font-mono"
                      onChange={(e) => update(v.id, { key: e.target.value })}
                    />
                    {keyErr && <span className="text-[11px] text-danger">{keyErr}</span>}
                    {v.storage === 'postman' && v.scope !== 'global' && (
                      <span className="text-[11px] text-muted" title="Veio do campo variable do item no Postman e volta para ele na exportação">
                        do Postman
                      </span>
                    )}
                  </td>
                  <td className="p-1">
                    <Input
                      value={v.value}
                      invalid={!!valErr}
                      className="font-mono"
                      onChange={(e) => update(v.id, { value: e.target.value })}
                    />
                    {valErr && <span className="text-[11px] text-danger">{valErr}</span>}
                  </td>
                  <td className="p-1">
                    <select
                      value={v.type}
                      onChange={(e) => update(v.id, { type: e.target.value as VariableType })}
                      className="h-8 w-full rounded-md border border-line bg-panel px-2 text-sm"
                    >
                      {TYPES.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-1">
                    <Input value={v.description} onChange={(e) => update(v.id, { description: e.target.value })} />
                  </td>
                  <td className="p-1 pt-2">
                    <IconButton
                      label="Remover variável"
                      className="hover:text-danger"
                      onClick={() => onChange(variables.filter((x) => x.id !== v.id))}
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </td>
                </tr>
              );
            })}
            {variables.length === 0 && (
              <tr>
                <td colSpan={5} className={cx('px-3 py-4 text-center text-sm text-muted')}>
                  Nenhuma variável neste escopo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div>
        <Button size="sm" icon={<Plus size={14} />} onClick={() => onChange([...variables, createVariable(scope)])}>
          Adicionar variável
        </Button>
      </div>
    </div>
  );
}
