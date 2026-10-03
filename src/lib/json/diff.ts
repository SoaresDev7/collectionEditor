import { formatPath, type PathSegment } from './path';
import { isPlainObject, type JsonValue } from './loose';

export type JsonChange =
  | { type: 'added'; path: string; value: JsonValue }
  | { type: 'removed'; path: string; value: JsonValue }
  | { type: 'changed'; path: string; from: JsonValue; to: JsonValue }
  | { type: 'renamed'; path: string; to: string; value: JsonValue };

const equal = (a: JsonValue, b: JsonValue) => JSON.stringify(a) === JSON.stringify(b);

/** Diferenças estruturais entre dois JSONs, reportando o nível mais alto alterado. */
export function diffJson(a: JsonValue, b: JsonValue): JsonChange[] {
  const changes: JsonChange[] = [];

  const visit = (x: JsonValue, y: JsonValue, segs: PathSegment[]) => {
    if (equal(x, y)) return;
    if (isPlainObject(x) && isPlainObject(y)) {
      const removed = Object.keys(x).filter((k) => !(k in y));
      const added = Object.keys(y).filter((k) => !(k in x));
      // Renomeação: chave removida e chave adicionada com o mesmo valor no mesmo objeto.
      for (const r of [...removed]) {
        const match = added.find((k) => equal(x[r], y[k]));
        if (match) {
          changes.push({ type: 'renamed', path: formatPath([...segs, r]), to: formatPath([...segs, match]), value: x[r] });
          removed.splice(removed.indexOf(r), 1);
          added.splice(added.indexOf(match), 1);
        }
      }
      for (const k of removed) changes.push({ type: 'removed', path: formatPath([...segs, k]), value: x[k] });
      for (const k of added) changes.push({ type: 'added', path: formatPath([...segs, k]), value: y[k] });
      for (const k of Object.keys(x)) if (k in y) visit(x[k], y[k], [...segs, k]);
      return;
    }
    if (Array.isArray(x) && Array.isArray(y)) {
      const n = Math.max(x.length, y.length);
      for (let i = 0; i < n; i++) {
        if (i >= y.length) changes.push({ type: 'removed', path: formatPath([...segs, i]), value: x[i] });
        else if (i >= x.length) changes.push({ type: 'added', path: formatPath([...segs, i]), value: y[i] });
        else visit(x[i], y[i], [...segs, i]);
      }
      return;
    }
    changes.push({ type: 'changed', path: segs.length ? formatPath(segs) : '(raiz)', from: x, to: y });
  };

  visit(a, b, []);
  return changes;
}
