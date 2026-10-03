import type { Collection } from '@/types/collection';
import { formatTestIdName } from './nomenclature';

/** Renomeação em massa de IDs de teste. */

export type RenameMode = 'pattern' | 'replace' | 'affix';

export type RenameSpec =
  | { mode: 'pattern'; start: number }
  | { mode: 'replace'; find: string; replace: string; regex: boolean; caseSensitive: boolean }
  | { mode: 'affix'; prefix: string; suffix: string };

export type RenamePreview = {
  id: string;
  scenarioName: string;
  from: string;
  to: string;
  /** Motivo pelo qual não será aplicado. */
  conflict?: string;
};

export function compileFind(spec: Extract<RenameSpec, { mode: 'replace' }>): RegExp | string {
  const flags = spec.caseSensitive ? 'g' : 'gi';
  if (spec.regex) return new RegExp(spec.find, flags);
  return new RegExp(spec.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
}

export function previewRename(collection: Collection, selected: Set<string>, spec: RenameSpec): RenamePreview[] {
  let find: RegExp | string | null = null;
  if (spec.mode === 'replace') {
    if (!spec.find) return [];
    find = compileFind(spec);
  }

  const out: RenamePreview[] = [];
  for (const folder of collection.folders) {
    for (const scenario of folder.scenarios) {
      const chosen = scenario.testIds.filter((t) => selected.has(t.id));
      if (!chosen.length) continue;
      let n = spec.mode === 'pattern' ? spec.start : 0;
      const rows = chosen.map((t) => {
        let to = t.name;
        if (spec.mode === 'pattern') to = formatTestIdName(scenario.idCode, n++);
        else if (spec.mode === 'replace') to = t.name.replace(find!, spec.replace);
        else to = `${spec.prefix}${t.name}${spec.suffix}`;
        return { id: t.id, scenarioName: scenario.name, from: t.name, to: to.trim() } as RenamePreview;
      });

      // Conflitos: nomes finais repetidos no cenário (incluindo IDs não selecionados).
      const finalNames = new Map<string, number>();
      const unselected = scenario.testIds.filter((t) => !selected.has(t.id)).map((t) => t.name.toLowerCase());
      for (const name of [...unselected, ...rows.map((r) => r.to.toLowerCase())]) finalNames.set(name, (finalNames.get(name) ?? 0) + 1);
      for (const r of rows) {
        if (!r.to) r.conflict = 'Nome vazio';
        else if ((finalNames.get(r.to.toLowerCase()) ?? 0) > 1) r.conflict = 'Nome repetido no cenário';
      }
      out.push(...rows);
    }
  }
  return out;
}
