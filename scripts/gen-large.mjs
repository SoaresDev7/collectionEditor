// Gera uma collection Postman sintética grande para testes de capacidade.
// Uso: node scripts/gen-large.mjs <requisições> > arquivo.json
const total = Number(process.argv[2] ?? 2000);
const perId = 2, idsPerScenario = 10, scenariosPerFolder = 10;
const body = JSON.stringify({ cliente: { nome: 'Maria', documento: '{{cpf}}', endereco: { rua: 'Rua A', numero: 10 } }, itens: [{ sku: 1, qtd: 2 }, { sku: 2, qtd: 1 }], obs: 'x'.repeat(200) }, null, 2);
let n = 0;
const folders = [];
for (let f = 0; n < total; f++) {
  const scenarios = [];
  for (let s = 0; s < scenariosPerFolder && n < total; s++) {
    const ids = [];
    for (let i = 0; i < idsPerScenario && n < total; i++) {
      const reqs = [];
      for (let r = 0; r < perId && n < total; r++, n++)
        reqs.push({
          name: `Req ${n}`,
          event: [{ listen: 'test', script: { type: 'text/javascript', exec: ["pm.test('ok', () => pm.response.to.have.status(200));", 'const b = pm.response.json();', "pm.collectionVariables.set('id', b.id);"] } }],
          request: { method: 'POST', header: [{ key: 'Content-Type', value: 'application/json' }, { key: 'Authorization', value: 'Bearer {{token}}' }], body: { mode: 'raw', raw: body, options: { raw: { language: 'json' } } }, url: { raw: `{{host}}/v1/recurso/${n}`, host: ['{{host}}'], path: ['v1', 'recurso', String(n)] } },
          response: [],
        });
      ids.push({ name: `CT${f}.${s}.${i}`, item: reqs });
    }
    scenarios.push({ name: `Cenário ${f}.${s}`, item: ids });
  }
  folders.push({ name: `Folder ${f}`, item: scenarios });
}
process.stdout.write(JSON.stringify({ info: { name: `Grande ${total}`, schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' }, item: folders, variable: [{ key: 'host', value: 'https://x' }] }, null, 2));
