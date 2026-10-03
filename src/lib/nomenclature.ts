import type { Scenario } from '@/types/collection';

/**
 * Nomenclatura dos IDs de teste: TC-<código do cenário>-<NNN>.
 * A numeração é independente em cada cenário (reinicia em 001).
 */

export const ID_PREFIX = 'TC';
export const ID_PAD = 3;
export const ID_CODE_MAX = 3;

export const formatTestIdName = (code: string, n: number): string =>
  `${ID_PREFIX}-${code}-${String(n).padStart(ID_PAD, '0')}`;

/** Número sequencial de um ID que segue o padrão do código, ex.: ("LCV", "TC-LCV-007") → 7. */
export function parseTestIdNumber(code: string, name: string): number | null {
  const match = new RegExp(`^${ID_PREFIX}-${code}-(\\d+)$`).exec(name.trim());
  return match ? Number(match[1]) : null;
}

export function maxTestIdNumber(scenario: Scenario): number {
  let max = 0;
  for (const t of scenario.testIds) {
    const n = parseTestIdNumber(scenario.idCode, t.name);
    if (n !== null && n > max) max = n;
  }
  return max;
}

export const nextTestIdName = (scenario: Scenario): string =>
  formatTestIdName(scenario.idCode, maxTestIdNumber(scenario) + 1);

/** Normaliza o código: só letras A-Z, maiúsculas, sem acento, no máximo 3. */
export const sanitizeIdCode = (input: string): string =>
  input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, ID_CODE_MAX);

const STOP_WORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'com', 'sem', 'e', 'em', 'para', 'por', 'a', 'o', 'as', 'os', 'no', 'na', 'um', 'uma']);

/**
 * Sugere um código a partir do nome do cenário usando as iniciais das palavras
 * relevantes, completando com letras da primeira palavra:
 * "Login com credenciais válidas" → LCV, "Cadastro de usuário" → CAU.
 */
export function suggestIdCode(name: string): string {
  const words = sanitizeWords(name).filter((w) => !STOP_WORDS.has(w.toLowerCase()));
  if (!words.length) return 'CEN';
  const take = words.map(() => 1);
  let total = Math.min(words.length, ID_CODE_MAX);
  while (total < ID_CODE_MAX && take[0] < words[0].length) {
    take[0]++;
    total++;
  }
  return sanitizeIdCode(words.map((w, i) => w.slice(0, take[i])).join(''));
}

const sanitizeWords = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^A-Za-z]+/)
    .filter(Boolean);

/** Gera um nome que não colida com os irmãos: "Nome", "Nome (cópia)", "Nome (cópia 2)"... */
export function uniqueName(base: string, siblings: string[], suffix = 'cópia'): string {
  const taken = new Set(siblings.map((s) => s.trim().toLowerCase()));
  if (!taken.has(base.trim().toLowerCase())) return base;
  let candidate = `${base} (${suffix})`;
  for (let i = 2; taken.has(candidate.toLowerCase()); i++) candidate = `${base} (${suffix} ${i})`;
  return candidate;
}

/**
 * Ordena pelo número os IDs que seguem o padrão TC-<código>-NNN, apenas entre
 * as posições que eles já ocupam. IDs fora do padrão (ex.: nomes de uma
 * collection importada) não saem do lugar.
 */
export function sortTestIds<T extends { name: string }>(code: string, testIds: T[]): T[] {
  const numbered = testIds.map((t) => parseTestIdNumber(code, t.name));
  const sorted = testIds.filter((_, i) => numbered[i] !== null).sort((a, b) => parseTestIdNumber(code, a.name)! - parseTestIdNumber(code, b.name)!);
  let k = 0;
  return testIds.map((t, i) => (numbered[i] === null ? t : sorted[k++]));
}

/**
 * Renumera os IDs no padrão conforme a posição: os números já usados são
 * redistribuídos em ordem crescente seguindo a ordem atual da lista (lacunas
 * são mantidas). Usado ao mover um ID: a posição passa a definir o número.
 * Retorna as renomeações feitas.
 */
export function renumberByPosition<T extends { name: string }>(code: string, testIds: T[]): { from: string; to: string }[] {
  const numbered = testIds.filter((t) => parseTestIdNumber(code, t.name) !== null);
  const numbers = numbered.map((t) => parseTestIdNumber(code, t.name)!).sort((a, b) => a - b);
  const changes: { from: string; to: string }[] = [];
  numbered.forEach((t, i) => {
    const name = formatTestIdName(code, numbers[i]);
    if (name !== t.name) {
      changes.push({ from: t.name, to: name });
      t.name = name;
    }
  });
  return changes;
}
