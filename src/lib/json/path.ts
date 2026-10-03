import { isPlainObject, type JsonValue } from './loose';

/** Segmentos de um caminho: chave de objeto (string) ou índice de array (number). */
export type PathSegment = string | number;

/**
 * Converte "user.address[0].street" em ["user", "address", 0, "street"].
 * Chaves com caracteres especiais podem usar colchetes com aspas: a["x.y"].
 */
export function parsePath(path: string): PathSegment[] | null {
  const segments: PathSegment[] = [];
  const re = /([^.[\]]+)|\[(\d+)\]|\["((?:[^"\\]|\\.)*)"\]|(\.)/g;
  let lastIndex = 0;
  let expectKey = true;
  for (const m of path.trim().matchAll(re)) {
    if (m.index !== lastIndex) return null;
    lastIndex = m.index + m[0].length;
    if (m[1] !== undefined) {
      if (!expectKey) return null;
      segments.push(m[1]);
      expectKey = false;
    } else if (m[2] !== undefined) {
      segments.push(Number(m[2]));
      expectKey = false;
    } else if (m[3] !== undefined) {
      segments.push(m[3].replace(/\\(.)/g, '$1'));
      expectKey = false;
    } else {
      if (expectKey) return null;
      expectKey = true;
    }
  }
  if (lastIndex !== path.trim().length || expectKey || !segments.length) return null;
  return segments;
}

export function formatPath(segments: PathSegment[]): string {
  return segments
    .map((s, i) =>
      typeof s === 'number' ? `[${s}]` : /^[A-Za-z_$][\w$-]*$/.test(s) ? (i ? `.${s}` : s) : `[${JSON.stringify(s)}]`,
    )
    .join('');
}

/** Todos os caminhos (folhas e nós intermediários) de um valor JSON. */
export function collectPaths(value: JsonValue, limit = 1000): string[] {
  const out: string[] = [];
  const visit = (v: JsonValue, segs: PathSegment[]) => {
    if (out.length >= limit) return;
    if (segs.length) out.push(formatPath(segs));
    if (Array.isArray(v)) v.forEach((item, i) => visit(item, [...segs, i]));
    else if (isPlainObject(v)) for (const [k, item] of Object.entries(v)) visit(item, [...segs, k]);
  };
  visit(value, []);
  return out;
}
