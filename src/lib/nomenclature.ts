import type { Folder } from '@/types/collection';

export const ID_PAD = 3;

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const formatTestIdName = (prefix: string, n: number, pad = ID_PAD): string =>
  `${prefix}${String(n).padStart(pad, '0')}`;

/** Extrai o número sequencial de um nome seguindo o prefixo, ex.: ("USER_", "USER_007") → 7. */
export function parseTestIdNumber(prefix: string, name: string): number | null {
  const match = new RegExp(`^${escapeRegExp(prefix)}(\\d+)$`).exec(name.trim());
  return match ? Number(match[1]) : null;
}

/** Maior número já usado no folder inteiro (IDs são sequenciais por folder). */
export function maxTestIdNumber(folder: Folder): number {
  let max = 0;
  for (const scenario of folder.scenarios) {
    for (const t of scenario.testIds) {
      const n = parseTestIdNumber(folder.idNomenclaturePrefix, t.name);
      if (n !== null && n > max) max = n;
    }
  }
  return max;
}

export const nextTestIdName = (folder: Folder): string =>
  formatTestIdName(folder.idNomenclaturePrefix, maxTestIdNumber(folder) + 1);

/** Gera um nome que não colida com os irmãos: "Nome", "Nome (cópia)", "Nome (cópia 2)"... */
export function uniqueName(base: string, siblings: string[], suffix = 'cópia'): string {
  const taken = new Set(siblings.map((s) => s.trim().toLowerCase()));
  if (!taken.has(base.trim().toLowerCase())) return base;
  let candidate = `${base} (${suffix})`;
  for (let i = 2; taken.has(candidate.toLowerCase()); i++) candidate = `${base} (${suffix} ${i})`;
  return candidate;
}
