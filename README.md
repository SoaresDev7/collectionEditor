# Collection Editor

Ferramenta web para **criar, editar e manter Postman Collections** de testes de API seguindo uma hierarquia padrão de roteirização:

```
Collection
└── Folder            contexto / funcionalidade
    └── Cenário       agrupa IDs relacionados (define o código dos IDs, ex.: SLF)
        └── ID        caso de teste: TC-SLF-001, TC-SLF-002… (agrupa requisições correlatas)
            └── Requisição
```

Ela acelera o trabalho repetitivo de QA (duplicar casos, renumerar IDs, alterar o mesmo campo do body em dezenas de requisições, achar onde uma variável é usada) e gera um **relatório das alterações** para o time e para o commit.

**Princípios**

- **Fiel ao Postman.** Importar e exportar sem editar devolve o arquivo idêntico. Só muda o que você editar.
- **Nada muda sem você pedir.** Padronizações (nomes TC, reorganizações) são ações explícitas, nunca automáticas na importação.
- **Local.** Roda inteiramente no navegador; não há servidor nem envio de dados. A ferramenta **não executa** requisições.

---

## Sumário

1. [Início rápido](#1-início-rápido)
2. [Conceitos](#2-conceitos)
3. [Guia de uso](#3-guia-de-uso)
4. [Atalhos de teclado](#4-atalhos-de-teclado)
5. [Regras de comportamento](#5-regras-de-comportamento)
6. [Armazenamento, desempenho e limites](#6-armazenamento-desempenho-e-limites)
7. [Disponibilizar na empresa](#7-disponibilizar-na-empresa)
8. [Trabalho em equipe](#8-trabalho-em-equipe)
9. [Solução de problemas](#9-solução-de-problemas)
10. [Desenvolvimento](#10-desenvolvimento)
11. [Limitações conhecidas e próximos passos](#11-limitações-conhecidas-e-próximos-passos)

---

## 1. Início rápido

**Requisitos:** [Node.js](https://nodejs.org) 20.19+ ou 22 LTS (há um `.nvmrc`), Git e um navegador atual (Chrome, Edge ou Firefox).

```bash
git clone <url-do-repositório>
cd collectionEditor
npm install
npm run dev          # abre em http://localhost:5173
```

Na primeira abertura aparece uma collection de exemplo. Para trabalhar com uma collection real, clique em **Importar** e escolha o `.json` exportado do Postman.

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento com recarga automática |
| `npm run build` | Verifica os tipos e gera a versão de produção em `dist/` |
| `npm run preview` | Serve o conteúdo de `dist/` em http://localhost:4173 |
| `npm test` | Testes automatizados (Vitest) |
| `npm run check` | Tipos + testes + build (o mesmo que a CI executa) |

---

## 2. Conceitos

### 2.1 Hierarquia e mapeamento para o Postman

| Ferramenta | Postman |
| --- | --- |
| Collection | Collection |
| Folder | Pasta de 1º nível |
| Cenário | Pasta de 2º nível |
| ID de Teste | Pasta de 3º nível |
| Requisição | Request |
| Pré-request / Pós-request | Aba *Pre-request Script* / *Tests* (`prerequest` / `test`) |

Pastas mais profundas que o 3º nível (dentro de um ID) são preservadas: a requisição mostra em qual pasta está e a exportação as recria.

### 2.2 Nomenclatura dos IDs

Formato **`TC-<código>-<NNN>`**:

- O **código** (até 3 letras A–Z) é definido em cada **cenário**. O botão de varinha sugere um código pelas iniciais do nome ("Login com credenciais válidas" → `LCV`).
- A **numeração é por cenário** e começa em `001` em cada um.
- Trocar o código renomeia os IDs que seguiam o código anterior (`TC-LCI-001` → `TC-INV-001`).
- **Renumerar** reescreve os IDs do cenário em sequência, na ordem atual.
- Se dois cenários usarem o mesmo código, o editor avisa (não bloqueia).
- IDs com nomes de outro padrão (ex.: `CT01 - Login`, vindos de uma importação) são respeitados: nada os renomeia sem uma ação sua.

### 2.3 Contêineres sintéticos

Ao importar, requisições que não se encaixam na hierarquia (soltas na raiz, num folder ou direto num cenário) são colocadas em contêineres **sintéticos**, exibidos **em itálico** na árvore. Eles existem só para navegação: na exportação, as requisições voltam ao lugar original.

Um contêiner sintético passa a ser uma **pasta real** no Postman quando você lhe dá identidade:

- renomeia (inclusive pelo *Renomear IDs em massa*);
- duplica;
- adiciona descrição, scripts ou variáveis;
- ou clica em **Tornar pasta real**.

Renomear apenas a requisição dentro dele não muda nada.

> Exemplo: requisições direto no cenário `SCENARIO_LOGIN_FLOW` entram como IDs sintéticos com o nome da própria requisição. Ao renomeá-los para `TC-SLF-001…`, eles viram pastas de TC no Postman, cada uma com a sua requisição.

### 2.4 Variáveis e escopos

| Escopo | Onde se define | Como vai para o Postman |
| --- | --- | --- |
| Global | Collection → aba *Variáveis* | Variáveis da collection |
| Folder / Cenário / ID | Aba *Variáveis* do nível | `pm.variables.set(...)` no pré-request do nível, entre marcadores `// @collection-editor:variables:*` |
| Importadas de pastas | Campo `variable` da pasta no Postman | Voltam para o mesmo campo (marcadas "do Postman") |

- **Precedência:** escopos internos sobrescrevem os externos (ID > Cenário > Folder > Global). O painel direito mostra o que vale no item selecionado e risca o que foi sobrescrito.
- **Variáveis de execução:** chaves criadas por scripts (`pm.collectionVariables.set('token', …)`) são reconhecidas e não geram aviso de "não definida".
- **Dinâmicas** do Postman (`{{$guid}}`, `{{$timestamp}}`…) são aceitas.
- **Nomes válidos:** começam com letra ou `_` e contêm letras, números, `_`, `-` ou `.`.
- Variáveis **desativadas** no Postman são preservadas, mas não entram na resolução.

### 2.5 Scripts

Cada nível tem **Pré-request** e **Pós-request** (testes). No Postman, os scripts rodam de fora para dentro: collection → folder → cenário → ID → requisição. O editor oferece:

- destaque de sintaxe, minimapa, busca (`Ctrl+F`) e formatação (`Shift+Alt+F`);
- autocomplete da API `pm` (`pm.test`, `pm.expect`, `pm.response`, `pm.variables`…) e de `{{variáveis}}`;
- validação de sintaxe em tempo real (indicador verde/vermelho na aba).

---

## 3. Guia de uso

### 3.1 A interface

- **Topo:** collection ativa, *Nova*, *Duplicar*, *Excluir*, *Importar*, menu *Em massa*, *Templates*, *Relatório*, *Exportar*, atalhos, tema e painel de variáveis.
- **Barra lateral (esquerda):** aba **Estrutura** (árvore) e aba **Buscar usos**. Redimensione arrastando a borda direita (setas do teclado com a borda focada; duplo clique volta ao padrão). Em telas estreitas vira uma gaveta (botão ☰).
- **Editor (centro):** breadcrumb, ações do item e abas do nível selecionado.
- **Painel de variáveis (direita):** variáveis visíveis no item, por escopo. Ícone de lupa = *ver usos*; ícone de cópia = copiar `{{nome}}`.

### 3.2 Criar uma collection do zero

1. **Nova** → nome.
2. Configure variáveis globais (ex.: `baseUrl`) e, se quiser, scripts globais.
3. **+ Folder** → **+ Cenário** (defina o código dos IDs) → **+ ID de Teste** → **+ Requisição**.
4. Na requisição: método, URL, headers, body, scripts.
5. **Exportar** e importe no Postman.

### 3.3 Importar uma collection existente

**Importar** (`Ctrl+O`): arraste o arquivo ou cole o JSON (Postman v2.0/v2.1). A pré-visualização mostra a estrutura, a quantidade de itens, os contêineres sintéticos e o que será preservado sem edição. A importação **cria uma collection nova** e não altera nada do arquivo (ver [2.3](#23-contêineres-sintéticos) e [5](#5-regras-de-comportamento)).

### 3.4 Editar uma requisição

- **Método** e **URL** (validada após substituir as variáveis conhecidas).
- **Body** com editor JSON, validação (aceita `{{var}}` sem aspas, como no Postman) e **Formatar JSON**.
- **Headers** chave/valor com sugestões comuns; desmarque para desativar sem apagar.
- **Pré-request** e **Pós-request / Testes**.
- **Visualizar:** a requisição com as variáveis substituídas pelos valores iniciais; o que só existe em execução aparece destacado.
- Avisos de **variáveis não definidas** aparecem abaixo da URL.
- Itens importados mostram o que está **preservado** (auth, exemplos de resposta, body não-raw, pastas internas).

### 3.5 Duplicar

- **Copiar / Duplicar** (`Ctrl+D`) em qualquer nível, levando todos os filhos.
- **Duplicar N vezes** (ID de teste): informe quantas cópias. IDs no padrão TC recebem os próximos números livres do cenário e o cenário é **reordenado pelo número**. IDs fora do padrão recebem "(cópia)", "(cópia 2)"…
- **Copiar cenário** mantém código e IDs; o editor avisa o código repetido para você ajustar.

### 3.6 Mover itens

- **Arrastar e soltar** na árvore: sobre um item do mesmo nível (antes/depois) ou sobre um pai válido (para dentro). Só destinos compatíveis aceitam o item.
- **`Alt+↑` / `Alt+↓`** sobe/desce o item entre os irmãos.
- **Mover** (no editor): lista de destinos com busca.
- Um ID no padrão TC movido para outro cenário assume o código e o próximo número do destino.

### 3.7 Buscar usos

Aba **Buscar usos** (`Ctrl+Shift+F`):

| Modo | Encontra |
| --- | --- |
| Texto | Qualquer trecho em nomes, descrições, URLs, headers, bodies, variáveis e scripts |
| Variável | `{{var}}`, `pm.*.get/set/unset/has('var')` (marcados como leitura/escrita/remoção) e declarações |
| Função | Definições (`function f`, `const f = () =>`…) e chamadas nos scripts |

Clicar num resultado abre o item na aba certa e posiciona o editor na linha. Para filtrar só a árvore por nome, use o campo de busca da aba **Estrutura** (`Ctrl+K`).

### 3.8 Editar body em massa

Menu **Em massa → Editar body** (`Alt+M`), ou no editor de folder/cenário/ID (já com os IDs dele selecionados):

1. Selecione os IDs (por folder, cenário ou individualmente).
2. Opcional: filtre as requisições por método ou texto no nome/URL.
3. Informe o **caminho** do campo (`user.email`, `items[0].id`; há sugestões tiradas dos bodies) e a operação:
   - **Remover campo**
   - **Editar valor** (só onde o campo existe)
   - **Renomear campo** (mantém a posição da chave)
   - **Adicionar campo** (só onde não existe; cria objetos intermediários)
4. Escolha o tipo do valor: texto, número, booleano, `null`, JSON ou variável sem aspas (`{{var}}`).
5. Confira a **pré-visualização** (alterar / ignorar com o motivo / erro) e aplique.

Os bodies alterados são reformatados com 2 espaços de indentação.

### 3.9 Renomear IDs em massa

Menu **Em massa → Renomear IDs** (`Alt+I`), com a mesma seleção de IDs:

- **Padrão `TC-<código>-NNN`**: renumera por cenário, a partir de um número, na ordem atual.
- **Localizar e substituir**: com expressão regular (`$1`, `$2`…) e opção de diferenciar maiúsculas.
- **Prefixo / sufixo**.

A pré-visualização mostra antes → depois e bloqueia nomes repetidos no cenário. Depois de aplicar, os IDs no padrão são reordenados pelo número.

### 3.10 Templates de documentação

Botão **Templates**: modelos em Markdown por nível (Folder, Cenário, ID). No editor do item, **Aplicar template…** preenche a descrição (que o Postman exibe como documentação). Os templates atuais são provisórios, até o time definir os modelos oficiais.

Placeholders usam colchetes duplos (para não conflitar com `{{variáveis}}`):

| Placeholder | Conteúdo | Níveis |
| --- | --- | --- |
| `[[nome]]` | Nome do item | todos |
| `[[descricaoAtual]]` | Descrição atual do item | todos |
| `[[collection]]`, `[[folder]]` | Nome da collection / do folder | todos |
| `[[cenario]]`, `[[codigo]]` | Nome / código do cenário | cenário, ID |
| `[[id]]` | Título do ID | ID |
| `[[qtdCenarios]]` | Quantidade de cenários | folder |
| `[[qtdIds]]` | Quantidade de IDs | folder, cenário |
| `[[listaIds]]` | Lista dos IDs | cenário |
| `[[requisicoes]]` | Lista "MÉTODO URL" | ID |
| `[[data]]` | Data atual | todos |

### 3.11 Exportar

**Exportar** (`Ctrl+E`) baixa `<nome>.postman_collection.json` (formato v2.1), pronto para importar no Postman. Itens importados partem do JSON original e só os campos editados são sobrescritos.

### 3.12 Relatório de alterações

Cada collection guarda uma **base** (o estado na primeira abertura/importação). **Relatório** (`Alt+R`) compara o estado atual com a base e gera:

- **Markdown** para o time:
  - **Resumo** com a identificação de cada ID adicionado, modificado e excluído (ex.: `TC-SLF-004`) e dos folders/cenários afetados;
  - **IDs de teste:** uma seção por ID (`TC-SLF-001 — modificado (antes: AUTH_001_Valid_Login)`) com o que mudou em cada requisição (URL, método, headers, campos do body, scripts) e se passou a ser pasta no Postman;
  - **Folders, cenários e collection:** mudanças de estrutura, com os IDs contidos;
  - **Alterações em lote no body:** a mesma mudança em várias requisições, com os IDs afetados.
- **Mensagem de commit:** `test(postman): atualiza <collection> (+9 IDs, 3 IDs alterados)` + uma linha por ID.

Use **Copiar** ou **Baixar**. Depois de compartilhar/commitar, **Marcar estado atual como base** inicia um novo ciclo.

---

## 4. Atalhos de teclado

| Atalho | Ação |
| --- | --- |
| `Ctrl+K` | Buscar na árvore |
| `Ctrl+Shift+F` | Buscar usos (variáveis, funções, texto) |
| `Alt+N` | Adicionar filho ao item selecionado |
| `Ctrl+D` | Duplicar item selecionado |
| `Alt+↑` / `Alt+↓` | Mover item entre os irmãos |
| `Ctrl+O` | Importar collection |
| `Ctrl+E` | Exportar collection |
| `Alt+M` | Editar body em massa |
| `Alt+I` | Renomear IDs em massa |
| `Alt+R` | Relatório de alterações |
| `Ctrl+B` | Mostrar/ocultar painel de variáveis |
| `Ctrl+Shift+L` | Tema claro/escuro |
| `↑ ↓ ← →` / `F2` / `Del` | Na árvore: navegar, expandir/recolher, renomear, excluir |

No Mac, use `Cmd` no lugar de `Ctrl`. Dentro do editor de código valem os atalhos do próprio editor (ex.: `Ctrl+D` seleciona a próxima ocorrência).

---

## 5. Regras de comportamento

**Importação e exportação**
- A importação não renomeia, não reordena e não converte nada.
- São preservados e exportados sem alteração: autenticação, exemplos de resposta, ids do Postman, `protocolProfileBehavior`, objetos de URL e de descrição, bodies que não são *raw* (urlencoded, form-data, GraphQL…), métodos fora da lista, campos extras de headers e variáveis.
- Um body não-*raw* não é editável; escrever um body na ferramenta o substitui por um body *raw*.
- Cópias de itens importados recebem novos ids no Postman (não duplicam o `id` original).

**Edição**
- **Salvamento automático** no navegador; não há botão salvar.
- **Nomes duplicados** no mesmo nível são bloqueados ao renomear.
- **Exclusões** pedem confirmação e informam quantos itens filhos serão apagados.
- **Validação em tempo real:** URL, JSON do body, sintaxe dos scripts, nomes de variáveis, chaves duplicadas e variáveis não definidas.
- A **reordenação automática** só mexe em IDs no padrão TC, e só entre as posições que eles já ocupam.

**Relatório**
- Compara com a base por identidade interna dos itens: renomear ou mover aparece como modificação, não como exclusão + inclusão.

---

## 6. Armazenamento, desempenho e limites

- Os dados ficam no **IndexedDB** do navegador, separados por navegador, por perfil e pelo endereço do site. As preferências de interface ficam no `localStorage`.
- As gravações são agrupadas (poucos centésimos de segundo após a última edição) e também acontecem ao esconder/fechar a aba. Se a gravação falhar, aparece um aviso para exportar.
- O app pede ao navegador armazenamento **persistente**. A tela de importação mostra o espaço usado e a cota.
- **Medido no Chromium:**

  | Collection | Análise | Carregar | Observações |
  | --- | --- | --- | --- |
  | 5.000 requisições (11 MB) | 0,2 s | 0,3 s | árvore virtualizada, digitação fluida |
  | 20.000 requisições (45 MB) | 0,7 s | 2,4 s | ~80 ms por tecla nos campos |

- A aplicação abre em ~0,3 s (379 KB de JavaScript inicial). O editor de código (Monaco) é baixado só quando aparece pela primeira vez.
- Coleções maiores devem funcionar, limitadas pela memória do computador (não testado acima de 45 MB).
- **Atenção:** limpar os dados do site no navegador apaga as collections. Exporte o que for importante.

---

## 8. Trabalho em equipe

Como os dados são locais, o compartilhamento é pelos arquivos:

1. Importe a collection oficial (do Git ou do Postman).
2. Faça as alterações.
3. **Exporte** e versione o JSON no Git.
4. Use o **Relatório** como mensagem de commit ou descrição do PR.
5. **Marque como base** para o próximo ciclo.

Os colegas importam o arquivo atualizado. Como a importação e a exportação são fiéis, o diff no Git mostra só o que foi editado.

---

## 9. Solução de problemas

| Situação | O que fazer |
| --- | --- |
| Pastas de TC não aparecem no Postman após exportar | Verifique se o ID está em itálico (sintético). Renomeie, adicione descrição ou use **Tornar pasta real** ([2.3](#23-contêineres-sintéticos)) |
| Variável aparece como "não definida", mas existe no Postman | Ela pode vir de um *environment*. Declare-a como global/escopo ou ignore o aviso — a exportação não é afetada |
| "Não foi possível salvar no navegador" | Exporte as collections; verifique espaço em disco e se o navegador não está em modo anônimo/privado |
| Collections sumiram | Os dados são por navegador e endereço. Confira se está no mesmo navegador/perfil e na mesma URL; reimporte o último JSON exportado |
| Erro ao importar | Apenas Postman v2.0/v2.1. No Postman: *Export → Collection v2.1* |
| Body "não é JSON válido" | Bodies com `{{var}}` sem aspas são aceitos; verifique vírgulas e chaves. *Formatar JSON* só funciona com JSON válido |
| Começar do zero | DevTools (`F12`) → *Application* → *Storage* → *Clear site data* (apaga tudo deste site) |

---

## 10. Desenvolvimento

### Stack

React 19 + TypeScript · Vite · Zustand (+ immer) · Monaco Editor (núcleo enxuto, carregado sob demanda) · Tailwind CSS v4 · lucide-react · idb-keyval · Vitest

### Estrutura

```
src/
├── types/                     # Modelo de domínio (collection.ts) e templates
├── data/mockCollection.ts     # Collection de exemplo da primeira execução
├── lib/
│   ├── tree.ts                # Navegação genérica na árvore (findPath, childrenOf, walk, nearest)
│   ├── factories.ts, clone.ts # Criação e cópia profunda de nós
│   ├── nomenclature.ts        # Padrão TC-<código>-NNN, sugestão de código, ordenação
│   ├── variables.ts           # Escopos, resolução, interpolação, variáveis não definidas
│   ├── validation.ts          # URL, JSON, JavaScript, nomes
│   ├── synthetic.ts           # Regras dos contêineres sintéticos
│   ├── search.ts              # Busca de usos
│   ├── bulkEdit.ts            # Edição em massa do body
│   ├── bulkRename.ts          # Renomeação em massa
│   ├── templates.ts           # Placeholders e renderização de templates
│   ├── storage.ts             # Persistência no IndexedDB
│   ├── json/                  # JSON tolerante a {{var}}, caminhos e diff estrutural
│   ├── changes/               # Diff entre versões e geração do relatório
│   ├── postman/               # Esquema, importação fiel e exportação
│   └── monaco/                # Núcleo enxuto do Monaco, configuração e autocomplete
├── store/                     # Zustand: collections, base do relatório, UI, templates, diálogos, avisos
├── hooks/                     # Seleção, ações de nós/collection, atalhos, hidratação
└── components/
    ├── layout/                # Shell, cabeçalho, breadcrumb, redimensionamento
    ├── sidebar/               # Árvore virtualizada e busca de usos
    ├── editors/               # Editores de grupo e de requisição
    ├── bulk/, rename/, move/, import/, report/, templates/   # Diálogos
    ├── variables/             # Painel de variáveis
    └── ui/                    # Primitivos, editor de código, menus, diálogos
```

### Modelo de dados

Definido em `src/types/collection.ts`. Pontos importantes:

- `Request.headers` é uma lista `{ key, value, enabled }` (preserva ordem e permite desativar).
- Itens importados guardam o JSON original em `postman` (e `extra` em headers/variáveis); a exportação mescla as edições sobre ele.
- `synthetic` / `syntheticName` marcam contêineres criados só para encaixar a hierarquia.
- `Request.folderPath` + `TestId.subfolders` preservam pastas abaixo do ID.
- Datas são strings ISO.

### Testes

`npm test` cobre nomenclatura, edição e renomeação em massa, busca, movimentação, relatório e, principalmente, a **fidelidade da importação/exportação** (`src/lib/__tests__/fixtures/company.postman_collection.json`: importar e exportar sem editar deve devolver o mesmo JSON).

### Utilitários

- `node scripts/gen-large.mjs 5000 > grande.json` — gera uma collection sintética grande para testes de capacidade.
- `python3 scripts/gen-monaco-core.py` — regenera `src/lib/monaco/core.js` (núcleo do Monaco só com JavaScript e JSON) após atualizar o `monaco-editor`.

---

## 11. Limitações conhecidas e próximos passos

- **Sem desfazer/refazer** (undo/redo) fora do editor de código. Antes de ações em massa, confira a pré-visualização; para voltar atrás, reimporte o último JSON exportado.
- Os dados são **por navegador**; não há sincronização entre máquinas.
- Autenticação, bodies não-*raw* e exemplos de resposta são preservados, mas **não editáveis**.
- A validação de scripts é de sintaxe (não executa o código).
- Apenas o formato Postman **v2.0/v2.1**.

Próximos passos: templates oficiais do time (e aplicação automática), desfazer/refazer, edição de autenticação, sincronização e versionamento em nuvem.
