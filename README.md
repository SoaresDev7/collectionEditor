# collectionEditor

Ferramenta web para criar, editar e exportar **Postman Collections** seguindo uma hierarquia padrão de roteirização de testes:

```
Collection
└── Folder            (contexto / funcionalidade)
    └── Cenário       (agrupa IDs relacionados; define o código dos IDs, ex.: LCV)
        └── ID        (TC-LCV-001, TC-LCV-002…; agrupa requisições correlatas)
            └── Requisição
```

## Como rodar

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + build de produção
npm test           # testes unitários (vitest)
```

## Stack

React 19 + TypeScript · Vite · Zustand (+ immer, persistência em localStorage) · Monaco Editor (empacotado localmente) · Tailwind CSS v4 · lucide-react

## Estrutura de pastas

```
src/
├── types/collection.ts        # Modelo de domínio (Collection, Folder, Scenario, TestId, Request, Variable)
├── data/mockCollection.ts     # Collection de exemplo carregada na 1ª execução
├── lib/
│   ├── factories.ts           # Criação de nós com valores padrão
│   ├── clone.ts               # Cópia profunda com novos ids
│   ├── tree.ts                # Navegação genérica na árvore (findPath, childrenOf, walk…)
│   ├── nomenclature.ts        # Padrão TC-<código>-NNN e numeração por cenário
│   ├── bulkEdit.ts            # Edição em massa de campos do body
│   ├── templates.ts           # Placeholders e renderização de templates de documentação
│   ├── json/                  # JSON tolerante a {{var}} sem aspas, caminhos e diff estrutural
│   ├── changes/               # Diff entre versões da collection e geração do relatório
│   ├── variables.ts           # Escopos, resolução, interpolação e variáveis não definidas
│   ├── validation.ts          # URL, JSON, JavaScript, nomes
│   ├── monaco.ts              # Workers, tipos da API `pm` e autocomplete de {{variáveis}}
│   └── postman/               # Formato Postman v2.1 e exportação
├── store/
│   ├── collectionStore.ts     # Dados + ações (adicionar, duplicar, duplicar N, excluir…)
│   ├── uiStore.ts             # Seleção, expansão, abas, tema, scroll (persistido)
│   ├── baselineStore.ts       # Base de comparação do relatório, por collection
│   ├── templateStore.ts       # Templates de documentação (compartilhados entre collections)
│   ├── dialogStore.ts         # Diálogos grandes abertos
│   └── feedbackStore.ts       # Toasts, confirmação e prompt
├── hooks/                     # Seleção, ações de nós/collection, atalhos de teclado
└── components/
    ├── layout/                # AppShell, Header, Breadcrumb
    ├── sidebar/               # Árvore virtualizada com busca, renomear inline e teclado
    ├── editors/               # GroupEditor (Collection/Folder/Cenário/ID), RequestEditor
    ├── variables/             # Painel lateral de variáveis disponíveis
    ├── bulk/                  # Edição em massa (seleção de IDs + operação + pré-visualização)
    ├── report/                # Relatório de alterações
    ├── templates/             # Gerenciador de templates
    └── ui/                    # Primitivos, CodeEditor (Monaco), diálogos
```

## O que já funciona

- Árvore expansível/colapsável, virtualizada (1000+ itens), com busca, renomear (duplo clique/F2) e navegação por teclado
- Editores por nível: nome, descrição, prefixo de nomenclatura (Folder), variáveis, pré/pós-request
- Requisição: método, URL validada, body JSON (validação + formatar), headers, scripts, visualização com variáveis interpoladas
- Aviso de variáveis não definidas (considera variáveis criadas por `pm.*.set(...)` em scripts e dinâmicas `{{$guid}}`)
- Duplicar folder/cenário/ID/requisição; **Duplicar ID N vezes** com numeração automática por cenário; renumerar IDs do cenário
- **Edição em massa do body**: seleciona IDs e aplica em um campo remover / editar valor / renomear / adicionar se não existir
- **Relatório de alterações** em Markdown e mensagem de commit
- **Templates de documentação** por nível (base pronta, aguardando os modelos do time)
- Várias collections: criar, duplicar, excluir, alternar
- Exportação para Postman v2.1
- Tema claro/escuro, painel de variáveis, breadcrumb, toasts, confirmação antes de excluir, layout responsivo (tablet: árvore em gaveta)

### Atalhos

| Atalho | Ação |
| --- | --- |
| Ctrl+K | Buscar na árvore |
| Alt+N | Adicionar filho ao item selecionado |
| Ctrl+D | Duplicar item selecionado |
| Ctrl+E | Exportar collection |
| Alt+M | Edição em massa do body |
| Alt+R | Relatório de alterações |
| Ctrl+B | Painel de variáveis |
| Ctrl+Shift+L | Alternar tema |
| ↑ ↓ ← → / F2 / Del | Navegar, expandir, renomear e excluir na árvore |

## Nomenclatura dos IDs

`TC-<código>-<NNN>`: o código (até 3 letras, A–Z) é definido em cada **cenário** e a numeração reinicia em `001` em cada cenário.

- Novo ID / duplicar / duplicar N vezes usam o próximo número livre do cenário.
- Trocar o código do cenário renomeia automaticamente os IDs que seguiam o código anterior.
- O botão **Renumerar** reescreve os IDs do cenário em sequência na ordem atual.
- O botão de varinha sugere um código pelas iniciais do nome do cenário ("Login com credenciais válidas" → `LCV`).
- Se dois cenários usarem o mesmo código, o editor avisa (não bloqueia).

## Edição em massa do body

Botão **Edição em massa** (cabeçalho) ou **Editar body em massa** (em folder/cenário/ID, já com os IDs daquele item selecionados).

1. Selecione os IDs (por folder, cenário ou individualmente; com busca).
2. Opcional: filtre as requisições por método ou por texto no nome/URL.
3. Informe o caminho do campo (`user.email`, `items[0].id`, com sugestões tiradas dos bodies) e a operação:
   - **Remover campo**
   - **Editar valor** (só onde o campo existe)
   - **Renomear campo** (mantém a posição da chave)
   - **Adicionar campo (se não existir)** (cria objetos intermediários)
4. Confira a pré-visualização (alterar / ignorar e o motivo / erro) e aplique.

Valores podem ser texto, número, booleano, null, JSON ou variável sem aspas (`{{var}}`). Bodies com `{{var}}` sem aspas são suportados. Os bodies alterados são reformatados com 2 espaços.

## Relatório de alterações

Cada collection tem uma **base** (criada automaticamente na primeira abertura). O botão **Relatório** compara o estado atual com a base e gera:

- **Markdown** para compartilhar com o time (resumo, adicionados, removidos, alterações em lote no body e modificados campo a campo);
- **Mensagem de commit** (`test(postman): atualiza <collection> (+3 IDs, 5 requisições alteradas)` + lista).

Depois de compartilhar ou commitar, use **Marcar estado atual como base** para começar um novo ciclo.

## Templates de documentação (em preparação)

Modelos em Markdown por nível (Folder, Cenário, ID) com placeholders `[[campo]]` (colchetes duplos para não conflitar com `{{variáveis}}`), ex.: `[[nome]]`, `[[codigo]]`, `[[id]]`, `[[listaIds]]`, `[[requisicoes]]`, `[[descricaoAtual]]`. Ficam no botão **Templates** e são aplicados pelo seletor "Aplicar template…" na descrição do item. Os três templates atuais são provisórios, até o time definir os modelos oficiais.

## Decisões sobre o modelo de dados

Diferenças em relação à especificação original:

- `Folder` também tem `variables` (o escopo `folder` existe na especificação).
- O prefixo de nomenclatura saiu do `Folder`: cada `Scenario` tem `idCode` (até 3 letras). Dados salvos na versão anterior são migrados automaticamente.
- `Request.headers` é `Header[]` (`{ id, key, value, enabled }`) em vez de `Record<string, string>`, para preservar a ordem, permitir chaves vazias durante a edição e desativar headers.
- `createdAt` / `updatedAt` são strings ISO, para serializar sem conversão.

## Mapeamento para o Postman

| Ferramenta | Postman v2.1 |
| --- | --- |
| Folder / Cenário / ID | Pastas aninhadas (`item` com `item`) |
| Requisição | `item` com `request` |
| Pré-request / Pós-request | `event` `prerequest` / `test` |
| Variáveis globais | `variable` da collection |
| Variáveis de Folder/Cenário/ID | `pm.variables.set(...)` no pré-request do nível, entre marcadores `// @collection-editor:variables:*` |

O Postman só aplica variáveis no nível da collection; por isso as variáveis dos outros escopos viram script, entre marcadores que a futura importação vai usar para reconhecê-las.

## Próximos passos

- **V2:** importação de collection Postman (mapeando a profundidade das pastas para a hierarquia e reconhecendo o bloco de variáveis gerado), arrastar e soltar para reordenar
- **Templates:** modelos oficiais do time, aplicação automática ao criar itens, aplicação em lote
- **V3:** undo/redo, validações avançadas
- **V4:** sincronização em nuvem e versionamento
