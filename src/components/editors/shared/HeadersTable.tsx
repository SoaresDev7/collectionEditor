import { Plus, Trash2 } from 'lucide-react';
import type { Header } from '@/types/collection';
import { createHeader } from '@/lib/factories';
import { Button, IconButton, Input } from '@/components/ui/primitives';

const COMMON = ['Content-Type', 'Authorization', 'Accept', 'X-Request-Id', 'X-Api-Key'];

export function HeadersTable({ headers, onChange }: { headers: Header[]; onChange: (h: Header[]) => void }) {
  const update = (id: string, patch: Partial<Header>) => onChange(headers.map((h) => (h.id === id ? { ...h, ...patch } : h)));
  const dupes = new Set(
    headers.map((h) => h.key.toLowerCase()).filter((k, i, all) => k && all.indexOf(k) !== i),
  );

  return (
    <div className="flex flex-col gap-2">
      <datalist id="common-headers">
        {COMMON.map((h) => (
          <option key={h} value={h} />
        ))}
      </datalist>
      <div className="flex flex-col gap-1">
        {headers.map((h) => (
          <div key={h.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={h.enabled}
              onChange={(e) => update(h.id, { enabled: e.target.checked })}
              aria-label="Header ativo"
              className="accent-[var(--accent)]"
            />
            <Input
              list="common-headers"
              value={h.key}
              placeholder="Header"
              invalid={dupes.has(h.key.toLowerCase())}
              title={dupes.has(h.key.toLowerCase()) ? 'Header duplicado' : undefined}
              className="w-1/3 font-mono"
              onChange={(e) => update(h.id, { key: e.target.value })}
            />
            <Input
              value={h.value}
              placeholder="Valor (aceita {{variavel}})"
              className="flex-1 font-mono"
              onChange={(e) => update(h.id, { value: e.target.value })}
            />
            <IconButton label="Remover header" className="hover:text-danger" onClick={() => onChange(headers.filter((x) => x.id !== h.id))}>
              <Trash2 size={14} />
            </IconButton>
          </div>
        ))}
        {headers.length === 0 && <p className="py-2 text-sm text-muted">Nenhum header.</p>}
      </div>
      <div>
        <Button size="sm" icon={<Plus size={14} />} onClick={() => onChange([...headers, createHeader()])}>
          Adicionar header
        </Button>
      </div>
    </div>
  );
}
