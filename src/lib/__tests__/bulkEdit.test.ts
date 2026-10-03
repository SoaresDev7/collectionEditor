import { describe, expect, it } from 'vitest';
import { applyToBody, parseValue } from '../bulkEdit';
import { parsePath } from '../json/path';

const body = '{\n  "user": { "name": "Ana", "email": "a@x.com" },\n  "id": {{userId}},\n  "items": [{ "sku": 1 }]\n}';
const run = (spec: Parameters<typeof applyToBody>[1], value?: unknown) =>
  applyToBody(body, spec, value as never);

describe('parsePath', () => {
  it('entende pontos e índices', () => {
    expect(parsePath('items[0].sku')).toEqual(['items', 0, 'sku']);
    expect(parsePath('a["x.y"]')).toEqual(['a', 'x.y']);
    expect(parsePath('a..b')).toBeNull();
  });
});

describe('applyToBody', () => {
  it('remove campo e preserva variáveis sem aspas', () => {
    const r = run({ operation: 'remove', path: 'user.email' });
    expect(r.ok && r.body).toContain('"id": {{userId}}');
    expect(r.ok && r.body).not.toContain('email');
  });

  it('edita valor só se existir', () => {
    const v = parseValue('number', '42');
    expect(v.ok).toBe(true);
    const r = run({ operation: 'set', path: 'items[0].sku' }, v.ok && v.value);
    expect(r.ok && JSON.parse(r.body.replace('{{userId}}', '0')).items[0].sku).toBe(42);
    expect(run({ operation: 'set', path: 'user.phone' }, 'x')).toMatchObject({ ok: false, skipped: true });
  });

  it('renomeia mantendo a posição', () => {
    const r = run({ operation: 'rename', path: 'user.name', newKey: 'fullName' });
    expect(r.ok && r.body.indexOf('fullName')).toBeLessThan(r.ok ? r.body.indexOf('email') : 0);
  });

  it('adiciona apenas quando não existe, criando intermediários', () => {
    const r = run({ operation: 'add', path: 'meta.source' }, 'qa');
    expect(r.ok && r.body).toContain('"source": "qa"');
    expect(run({ operation: 'add', path: 'user.name' }, 'x')).toMatchObject({ ok: false, skipped: true });
  });

  it('valor variável sai sem aspas', () => {
    const v = parseValue('variable', '{{token}}');
    const r = run({ operation: 'set', path: 'user.name' }, v.ok && v.value);
    expect(r.ok && r.body).toContain('"name": {{token}}');
  });
});
