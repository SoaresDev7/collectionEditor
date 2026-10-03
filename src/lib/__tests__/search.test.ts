import { describe, expect, it } from 'vitest';
import { buildMockCollection } from '@/data/mockCollection';
import { declaredFunctions, searchCollection } from '../search';

describe('busca de usos', () => {
  const c = buildMockCollection();
  c.preRequestScripts += '\nfunction gerarCpf() { return "1"; }\n';
  c.folders[0].postRequestScripts = 'const x = gerarCpf();';

  it('variável: declaração, uso e escrita', () => {
    const hits = searchCollection(c, { mode: 'variable', query: '{{accessToken}}' });
    const tags = new Set(hits.map((h) => h.tag));
    expect(tags.has('escrita')).toBe(true);
    expect(tags.has('leitura')).toBe(true);
    expect(tags.has('uso')).toBe(true);
    expect(searchCollection(c, { mode: 'variable', query: 'baseUrl' }).some((h) => h.tag === 'declaração')).toBe(true);
  });

  it('função: definição e uso', () => {
    const hits = searchCollection(c, { mode: 'function', query: 'gerarCpf' });
    expect(hits.map((h) => h.tag)).toEqual(['definição', 'uso']);
    expect(declaredFunctions(c)).toContain('gerarCpf');
  });
});
