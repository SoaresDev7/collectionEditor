#!/usr/bin/env python3
"""Gera src/lib/monaco/core.js: núcleo do Monaco só com JavaScript e JSON.

Uso (na raiz do projeto, após atualizar o monaco-editor):
    python3 scripts/gen-monaco-core.py
"""
src = open('node_modules/monaco-editor/esm/vs/index.js').read().splitlines()
out = [
    "// GERADO a partir de monaco-editor/esm/vs/index.js: núcleo do editor só com JavaScript e JSON.",
    "// Reduz o bundle (sem dezenas de linguagens nem os workers de CSS/HTML).",
    "// Para regenerar após atualizar o monaco-editor: python3 scripts/gen-monaco-core.py",
]
for line in src:
    l = line.strip()
    if 'languages/definitions/' in l and 'javascript' not in l and 'typescript' not in l:
        continue
    if 'features/css' in l or 'features/html' in l:
        continue
    if 'monaco-lsp-client' in l or l.startswith('export { index as lsp'):
        continue
    if l.startswith('export {') and "from './editor/editor.api.js'" in l:
        out.append(l.replace("'./", "'monaco-esm/"))
        continue
    if 'features/json/register' in l or 'features/typescript/register' in l:
        out.append(l.replace("'./", "'monaco-esm/"))
        continue
    if l.startswith('export {') and ('json' in l or 'typescript' in l):
        out.append(l)
        continue
    if l.startswith('export'):
        continue
    if l.startswith('import'):
        out.append(l.replace("'./", "'monaco-esm/"))
open('src/lib/monaco/core.js', 'w').write('\n'.join(out) + '\n')
print(f'{len(out)} linhas geradas em src/lib/monaco/core.js')
