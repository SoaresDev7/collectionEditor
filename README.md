# collectionEditor

Ferramenta web para criar, editar e exportar **Postman Collections** seguindo uma hierarquia padrão de roteirização de testes:

```
Collection
└── Folder            (contexto / funcionalidade, define o prefixo dos IDs)
    └── Cenário       (agrupa IDs relacionados)
        └── ID        (USER_001, USER_002…; agrupa requisições correlatas)
            └── Requisição
```

## Como rodar

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + build de produção
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
│   ├── nomenclature.ts        # Prefixos e numeração sequencial de IDs
│   ├── variables.ts           # Escopos, resolução, interpolação e variáveis não definidas
│   ├── validation.ts          # URL, JSON, JavaScript, nomes
│   ├── monaco.ts              # Workers, tipos da API `pm` e autocomplete de {{variáveis}}
│   └── postman/               # Formato Postman v2.1 e exportação
├── store/
│   ├── collectionStore.ts     # Dados + ações (adicionar, duplicar, duplicar N, excluir…)
│   ├── uiStore.ts             # Seleção, expansão, abas, tema, scroll (persistido)
│   └── feedbackStore.ts       # Toasts, confirmação e prompt
├── hooks/                     # Seleção, ações de nós/collection, atalhos de teclado
└── components/
    ├── layout/                # AppShell, Header, Breadcrumb
    ├── sidebar/               # Árvore virtualizada com busca, renomear inline e teclado
    ├── editors/               # GroupEditor (Collection/Folder/Cenário/ID), RequestEditor
    ├── variables/             # Painel lateral de variáveis disponíveis
    └── ui/                    # Primitivos, CodeEditor (Monaco), diálogos
```

## O que já funciona

- Árvore expansível/colapsável, virtualizada (1000+ itens), com busca, renomear (duplo clique/F2) e navegação por teclado
- Editores por nível: nome, descrição, prefixo de nomenclatura (Folder), variáveis, pré/pós-request
- Requisição: método, URL validada, body JSON (validação + formatar), headers, scripts, visualização com variáveis interpoladas
- Aviso de variáveis não definidas (considera variáveis criadas por `pm.*.set(...)` em scripts e dinâmicas `{{$guid}}`)
- Duplicar folder/cenário/ID/requisição; **Duplicar ID N vezes** com numeração automática por folder; renumerar IDs do folder
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
| Ctrl+B | Painel de variáveis |
| Ctrl+Shift+L | Alternar tema |
| ↑ ↓ ← → / F2 / Del | Navegar, expandir, renomear e excluir na árvore |

## Decisões sobre o modelo de dados

Diferenças em relação à especificação original:

- `Folder` também tem `variables` (o escopo `folder` existe na especificação).
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
- **V3:** undo/redo, validações avançadas
- **V4:** sincronização em nuvem e versionamento
