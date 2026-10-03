import { describe, expect, it } from 'vitest';
import { buildMockCollection } from '@/data/mockCollection';
import { diffCollections } from '../changes/diff';
import { buildCommitMessage, buildMarkdownReport, buildReportModel } from '../changes/report';
import { createTestId } from '../factories';

describe('relatório de alterações', () => {
  const base = buildMockCollection();
  const cur = structuredClone(base);
  const lcv = cur.folders[0].scenarios[0];
  lcv.testIds.push(createTestId({ name: 'TC-LCV-003' }));
  lcv.testIds[0].name = 'TC-LCV-010';
  // Mesma alteração de body em várias requisições
  for (const f of cur.folders)
    for (const s of f.scenarios)
      for (const t of s.testIds) for (const r of t.requests) if (r.body.includes('"username"')) r.body = r.body.replace('"username"', '"login"');
  // Exclui o cenário de remoção (e o ID dentro dele) e uma requisição de outro ID
  cur.folders[1].scenarios.splice(1, 1);
  cur.folders[1].scenarios[0].testIds[0].requests.pop();
  const diff = diffCollections(base, cur);
  const meta = { collectionName: cur.name, baselineAt: base.createdAt, generatedAt: base.createdAt };

  it('identifica cada ID adicionado, modificado e excluído', () => {
    const model = buildReportModel(diff);
    const by = (status: string) => model.testIds.filter((e) => e.status === status).map((e) => e.name);
    expect(by('adicionado')).toEqual(['TC-LCV-003']);
    expect(by('modificado')).toEqual(['TC-CAD-001', 'TC-LCI-001', 'TC-LCV-010']);
    expect(by('excluído')).toEqual(['TC-REM-001']);
    const renamed = model.testIds.find((e) => e.name === 'TC-LCV-010')!;
    expect(renamed.previousName).toBe('TC-LCV-001');
    expect(renamed.details.some((d) => d.includes('Requisição `POST login`: Body: campo `username` renomeado para `login`'))).toBe(true);
    expect(model.testIds.find((e) => e.name === 'TC-CAD-001')!.details).toContain('Requisição `GET usuário criado` excluída');
    expect(model.structure.map((s) => [s.kind, s.name, s.status])).toEqual([['scenario', 'Remoção de usuário', 'excluído']]);
  });

  it('markdown e commit trazem as identificações', () => {
    const md = buildMarkdownReport(diff, meta);
    expect(md).toContain('- **IDs adicionados (1):** `TC-LCV-003`');
    expect(md).toContain('### TC-LCV-010 — modificado (antes: TC-LCV-001)');
    expect(md).toContain('### TC-REM-001 — excluído');
    expect(md).toContain('em `TC-LCI-001`, `TC-LCV-010`');
    const commit = buildCommitMessage(diff, meta);
    expect(commit.split('\n')[0]).toBe(`test(postman): atualiza ${cur.name} (+1 ID, 3 IDs alterados, -1 ID)`);
    expect(commit).toContain('- TC-LCV-003: adicionado');
    expect(commit).toContain('- TC-REM-001: excluído');
    expect(commit).toMatch(/- TC-CAD-001: modificado — Requisição GET usuário criado excluída/);
  });
});
