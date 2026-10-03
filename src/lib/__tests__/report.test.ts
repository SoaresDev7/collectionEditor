import { describe, expect, it } from 'vitest';
import { buildMockCollection } from '@/data/mockCollection';
import { diffCollections } from '../changes/diff';
import { buildCommitMessage, buildMarkdownReport } from '../changes/report';
import { createTestId } from '../factories';

describe('relatório de alterações', () => {
  it('detecta adição, renomeação e alteração de body em lote', () => {
    const base = buildMockCollection();
    const cur = structuredClone(base);
    const scenario = cur.folders[0].scenarios[0];
    scenario.testIds.push(createTestId({ name: 'TC-LCV-003' }));
    scenario.testIds[0].name = 'TC-LCV-010';
    for (const f of cur.folders)
      for (const s of f.scenarios)
        for (const t of s.testIds)
          for (const r of t.requests) if (r.body.includes('"username"')) r.body = r.body.replace('"username"', '"login"');

    const diff = diffCollections(base, cur);
    expect(diff.added.map((a) => a.name)).toEqual(['TC-LCV-003']);
    expect(diff.modified.some((m) => m.details.some((d) => d.includes('Renomeado')))).toBe(true);

    const meta = { collectionName: cur.name, baselineAt: base.createdAt, generatedAt: base.createdAt };
    const md = buildMarkdownReport(diff, meta);
    expect(md).toContain('## Adicionados');
    expect(md).toContain('renomeado para `login`');
    expect(buildCommitMessage(diff, meta).split('\n')[0]).toMatch(/^test\(postman\): atualiza .*\+1 ID/);
  });
});
