import { describe, expect, it } from 'vitest';
import { buildMockCollection } from '@/data/mockCollection';
import { analyzeScript, maskCode } from '../scripts/analysis';
import { executionChain, scriptInsights } from '../scripts/insights';

describe('análise de scripts', () => {
  it('mascara strings e comentários preservando posições', () => {
    const src = "const a = 'x // y'; // comentário\nb()";
    const m = maskCode(src);
    expect(m.length).toBe(src.length);
    expect(m).not.toContain('comentário');
    expect(m.split('\n')[1]).toBe('b()');
  });

  it('separa declarações locais e compartilhadas', () => {
    const a = analyzeScript("function local(x) { return x; }\nutils = { a() {} };\nconst c = 1;\nglobalThis.gerar = () => 1;\n  aninhada = 2;");
    expect(a.declarations.map((d) => `${d.name}:${d.kind}`)).toEqual(['local:local', 'c:local', 'utils:shared', 'gerar:shared', 'aninhada:shared']);
    expect(a.declaredNames.has('x')).toBe(true);
  });

  it('encontra acessos pm.* e {{var}} em strings', () => {
    const a = analyzeScript("pm.collectionVariables.set('token', 1);\nconst u = pm.variables.replaceIn('{{baseUrl}}/x');\n// {{ignorado}}");
    expect(a.pmAccesses.map((x) => `${x.scope}.${x.op}:${x.name}@${x.line}`)).toEqual(['collectionVariables.set:token@1', 'variables.ref:baseUrl@2']);
  });
});

describe('insights de escopo', () => {
  const c = buildMockCollection();
  const folder = c.folders[0]; // Autenticação: variável authPath (escopo folder)
  const scenario = folder.scenarios[0]; // username (cenário)
  const testId = scenario.testIds[0]; // password (ID)
  const request = testId.requests[0];
  const usuarios = c.folders[1];

  it('mostra de onde vem cada variável e avisa acessor errado', () => {
    const src = "pm.variables.get('username');\npm.collectionVariables.get('authPath');\npm.collectionVariables.get('baseUrl');";
    const ins = scriptInsights(c, { nodeId: request.id, phase: 'pre' }, src);
    expect(ins[0]).toMatchObject({ line: 1, severity: 'info', hint: 'Cenário' });
    expect(ins[1]).toMatchObject({ line: 2, severity: 'warning', hint: '⚠ Folder' });
    expect(ins[1].message).toContain("pm.variables.get('authPath')");
    expect(ins[2]).toMatchObject({ line: 3, severity: 'info', hint: 'Global' });
  });

  it('variável de outro ramo da árvore fica fora do alcance', () => {
    const ins = scriptInsights(c, { nodeId: usuarios.id, phase: 'pre' }, "pm.variables.get('username');");
    expect(ins[0]).toMatchObject({ severity: 'warning', hint: '⚠ fora do alcance' });
  });

  it('função local de outro script é sinalizada com orientação; compartilhada anterior é ok', () => {
    const col = structuredClone(c);
    col.preRequestScripts = 'function gerarCpf() { return 1; }\nutils = { soma(a, b) { return a + b; } };';
    const ins = scriptInsights(col, { nodeId: col.folders[0].scenarios[0].testIds[0].requests[0].id, phase: 'post' }, 'const a = gerarCpf();\nutils.soma(1, 2);');
    expect(ins.find((i) => i.line === 1)).toMatchObject({ severity: 'warning', hint: '⚠ local de outro script' });
    expect(ins.find((i) => i.line === 1)!.message).toContain('gerarCpf = function');
    expect(ins.find((i) => i.line === 2)).toMatchObject({ severity: 'info', hint: '⇠ Collection pré-request' });
  });

  it('compartilhada definida num script que roda depois é sinalizada', () => {
    const col = structuredClone(c);
    const req = col.folders[0].scenarios[0].testIds[0].requests[0];
    req.postRequestScripts = 'helper = () => 1;';
    const ins = scriptInsights(col, { nodeId: req.id, phase: 'pre' }, 'helper();');
    expect(ins[0]).toMatchObject({ severity: 'warning', hint: '⚠ roda depois' });
  });

  it('cadeia de execução em ordem', () => {
    const steps = executionChain(c, request.id).map((s) => `${s.kind}:${s.phase}`);
    expect(steps).toEqual(['collection:pre', 'collection:post', 'request:post']);
  });
});
