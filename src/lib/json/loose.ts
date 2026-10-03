/**
 * JSON "tolerante" a variáveis do Postman sem aspas, ex.: { "id": {{userId}} }.
 *
 * Antes do parse, cada {{var}} fora de string vira a string-marcador
 * "@@ce-raw:{{var}}"; ao serializar, o marcador volta a ser {{var}} sem aspas.
 */

export const RAW_MARKER = '@@ce-raw:';

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

/** Substitui {{var}} fora de strings por "@@ce-raw:{{var}}". */
export function protectPlaceholders(text: string): string {
  let out = '';
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      out += ch;
      if (ch === '\\') {
        out += text[++i] ?? '';
      } else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === '{' && text[i + 1] === '{') {
      const end = text.indexOf('}}', i + 2);
      if (end > 0) {
        out += JSON.stringify(RAW_MARKER + text.slice(i, end + 2));
        i = end + 1;
        continue;
      }
    }
    out += ch;
  }
  return out;
}

const MARKER_RE = new RegExp(`"${RAW_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\{\\{[^"]*?\\}\\})"`, 'g');

export const restorePlaceholders = (text: string): string => text.replace(MARKER_RE, '$1');

export type LooseParse = { ok: true; value: JsonValue } | { ok: false; error: string };

export function parseLoose(text: string): LooseParse {
  try {
    return { ok: true, value: JSON.parse(protectPlaceholders(text)) as JsonValue };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'JSON inválido' };
  }
}

export const stringifyLoose = (value: JsonValue): string => restorePlaceholders(JSON.stringify(value, null, 2));

/** Representação curta de um valor para relatórios e pré-visualizações. */
export function displayValue(value: JsonValue | undefined, max = 60): string {
  if (value === undefined) return '∅';
  if (typeof value === 'string' && value.startsWith(RAW_MARKER)) return value.slice(RAW_MARKER.length);
  const s = restorePlaceholders(JSON.stringify(value));
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export const isPlainObject = (v: unknown): v is { [key: string]: JsonValue } =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
