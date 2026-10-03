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

## Disponibilizar para a equipe

A ferramenta é um site estático (HTML/JS/CSS): não tem servidor nem banco de dados. Cada pessoa usa no próprio navegador, e os dados ficam no navegador dela.

```bash
npm ci
npm run build      # gera a pasta dist/
```

A pasta `dist/` pode ser publicada em qualquer servidor de arquivos estáticos, em qualquer caminho (o build usa caminhos relativos):

| Opção | Quando usar |
| --- | --- |
| **GitHub Pages** (Actions publicando `dist/`) | Repositório no GitHub; em repositório privado exige plano pago e o acesso pode ser restrito à organização (Enterprise) |
| **Servidor interno** (Nginx, Apache, IIS) ou bucket S3/Azure Blob/GCS | Acesso só pela rede da empresa / VPN |
| Netlify, Vercel, Cloudflare Pages | Publicação rápida com link; avalie a política de dados da empresa |
| `npm run dev` / `npm run preview` na máquina de cada QA | Sem infraestrutura; cada um clona o repositório |

**Compartilhar collections**: como os dados são locais, o fluxo de equipe é pelos arquivos — exporte o JSON, versione no Git (junto com o relatório de alterações como mensagem de commit/PR) e os colegas importam. A importação é fiel, então ida e volta não altera nada.

## Armazenamento e limites

- Os dados ficam no **IndexedDB** do navegador (por navegador e por endereço do site). A cota costuma ser de centenas de MB ou mais; o app pede ao navegador armazenamento persistente.
- As edições são gravadas com um pequeno atraso (agrupando digitação) e ao esconder/fechar a aba. Se a gravação falhar, aparece um aviso para exportar.
- Medido no Chromium: arquivo de **45 MB / 20.000 requisições** — análise 0,7 s, carga 2,4 s, digitação fluida; 5.000 requisições (11 MB) carregam em 0,3 s. A árvore é virtualizada.
- Limpar os dados do site no navegador apaga as collections: exporte o que for importante.

## Stack

React 19 + TypeScript · Vite · Zustand (+ immer; dados no IndexedDB, preferências no localStorage) · Monaco Editor (empacotado localmente) · Tailwind CSS v4 · lucide-react

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
- Barra lateral redimensionável (arraste a borda direita; setas do teclado com a borda focada; duplo clique volta ao padrão). A largura fica salva, e o nome completo aparece ao passar o mouse sobre um item
- Editores por nível: nome, descrição, prefixo de nomenclatura (Folder), variáveis, pré/pós-request
- Requisição: método, URL validada, body JSON (validação + formatar), headers, scripts, visualização com variáveis interpoladas
- Aviso de variáveis não definidas (considera variáveis criadas por `pm.*.set(...)` em scripts e dinâmicas `{{$guid}}`)
- Duplicar folder/cenário/ID/requisição; **Duplicar ID N vezes** com numeração automática por cenário; renumerar IDs do cenário
- **Importar** collections do Postman (v2.0/v2.1), mapeando as pastas para a hierarquia padrão
- **Mover itens**: arrastar e soltar na árvore, `Alt+↑/↓` ou o botão **Mover** (escolha do destino)
- **Buscar usos** de variáveis, funções dos scripts ou texto livre, com navegação até a linha
- **Renomear IDs em massa** (padrão TC, localizar/substituir com regex, prefixo/sufixo)
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
| Ctrl+Shift+F | Buscar usos |
| Ctrl+O | Importar collection |
| Alt+I | Renomear IDs em massa |
| Alt+↑ / Alt+↓ | Mover o item selecionado na árvore |
| Alt+M | Edição em massa do body |
| Alt+R | Relatório de alterações |
| Ctrl+B | Painel de variáveis |
| Ctrl+Shift+L | Alternar tema |
| ↑ ↓ ← → / F2 / Del | Navegar, expandir, renomear e excluir na árvore |

## Nomenclatura dos IDs

`TC-<código>-<NNN>`: o código (até 3 letras, A–Z) é definido em cada **cenário** e a numeração reinicia em `001` em cada cenário.

- Novo ID / duplicar / duplicar N vezes usam o próximo número livre do cenário, e os IDs do cenário são reordenados pelo número automaticamente.
- Ao mover um ID para outro cenário, ele assume o código e o próximo número do destino.
- Trocar o código do cenário renomeia automaticamente os IDs que seguiam o código anterior.
- O botão **Renumerar** reescreve os IDs do cenário em sequência na ordem atual.
- O botão de varinha sugere um código pelas iniciais do nome do cenário ("Login com credenciais válidas" → `LCV`).
- Se dois cenários usarem o mesmo código, o editor avisa (não bloqueia).

## Mover itens

- **Arrastar e soltar** na árvore: solte sobre um item do mesmo nível (antes/depois) ou sobre um pai válido (para dentro). Só destinos compatíveis com a hierarquia aceitam o item.
- **Teclado**: `Alt+↑` / `Alt+↓` sobe/desce o item selecionado entre os irmãos.
- **Botão Mover** no editor: lista os destinos possíveis com busca.
- Nomes repetidos no destino recebem sufixo "(cópia)"; IDs movidos para outro cenário são renomeados para o padrão do destino.

## Buscar usos

Aba **Buscar usos** na barra lateral (`Ctrl+Shift+F`), com três modos:

| Modo | Encontra |
| --- | --- |
| Texto | Qualquer trecho em nomes, descrições, URLs, headers, bodies, variáveis e scripts |
| Variável | `{{var}}` em URL/headers/body/scripts, `pm.*.get/set/unset/has('var')` (classificado como leitura/escrita/remoção) e declarações nas tabelas de variáveis |
| Função | Definições (`function f`, `const f = () =>`…) e chamadas nos scripts de pré/pós-request |

Clicar num resultado abre o item, a aba correspondente e posiciona o editor na linha. No painel de variáveis, o ícone de lupa abre a busca de usos daquela variável.

## Importar collection do Postman

Botão **Importar** (`Ctrl+O`): arraste o arquivo ou cole o JSON (Postman v2.0/v2.1). A importação é **fiel ao original**: nada é renomeado, reordenado ou convertido. Padronizações ficam a cargo de quem edita, pelas ações da ferramenta.

- **Encaixe na hierarquia**: pasta de 1º nível → Folder, 2º → Cenário, 3º → ID.
- **Pastas abaixo do 3º nível** continuam existindo dentro do ID (a requisição mostra o caminho) e são recriadas na exportação.
- **Contêineres sintéticos** (em itálico na árvore) acomodam requisições fora desse encaixe, por exemplo soltas na raiz. Eles não viram pastas na exportação, a menos que recebam descrição, scripts ou variáveis, ou que você use **Tornar pasta real**.
- **Preservado sem edição** e exportado igual: autenticação, exemplos de resposta, ids, `protocolProfileBehavior`, objetos de URL e descrição, bodies que não são raw (urlencoded, form-data…), métodos fora da lista, campos extras de headers e variáveis.
- **Exportação**: parte do JSON original e sobrescreve só o que foi editado. Importar e exportar sem mexer em nada devolve o mesmo arquivo (coberto por teste).
- Variáveis do campo `variable` de pastas voltam para esse campo; variáveis desativadas no Postman não entram na resolução.
- Ações da ferramenta respeitam nomes fora do padrão: duplicar um ID "CT01 - Login" gera "CT01 - Login (cópia)", e a reordenação automática só mexe em IDs no padrão `TC-<código>-NNN`.

## Renomear IDs em massa

Menu **Em massa → Renomear IDs** (`Alt+I`), com seleção de IDs igual à da edição de body:

- **Padrão TC-<código>-NNN**: renumera a partir de um número, por cenário, na ordem atual;
- **Localizar e substituir**: com expressão regular (`$1`…) e diferenciação de maiúsculas;
- **Prefixo / sufixo**.

A pré-visualização mostra antes → depois e bloqueia nomes repetidos no cenário. Depois de aplicar, os IDs são reordenados pelo número.

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

Cada collection tem uma **base** (criada automaticamente na primeira abertura ou importação). O botão **Relatório** compara o estado atual com a base e gera:

- **Markdown** para compartilhar com o time:
  - **Resumo** com a identificação de cada ID adicionado, modificado e excluído (ex.: `TC-LCV-003`) e dos folders/cenários afetados;
  - **IDs de teste**: uma seção por ID (`TC-LCV-010 — modificado (antes: TC-LCV-001)`), com onde ele está e o que mudou em cada requisição (URL, método, headers, campos do body, scripts…);
  - **Folders, cenários e collection**: mudanças de estrutura, com os IDs contidos em itens adicionados/excluídos;
  - **Alterações em lote no body**: a mesma mudança aplicada em várias requisições, com os IDs afetados.
- **Mensagem de commit**: `test(postman): atualiza <collection> (+1 ID, 3 IDs alterados, -1 ID)` + uma linha por ID (`TC-LCV-002: modificado — …`).

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

- **Templates:** modelos oficiais do time, aplicação automática ao criar itens, aplicação em lote
- **V3:** undo/redo, validações avançadas
- **V4:** sincronização em nuvem e versionamento
