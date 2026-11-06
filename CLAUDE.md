# retech-meufin-admin — regras de desenvolvimento

## Regra principal: componentes reutilizáveis, zero código morto

1. **Antes de escrever UI nova, procure em `src/components`.** Se o padrão vai aparecer em mais de um lugar, ele nasce lá (ou em `features/<x>/components` quando é do domínio), nunca inline numa página. Páginas e diálogos compõem componentes; não definem genéricos.
2. **Ao reaproveitar com componente, apague o que ele substituiu**: imports, constantes duplicadas, helpers copiados, estados sem uso. Código sem uso não fica no repositório. `npm run lint` com `--max-warnings 0` é a régua.
3. **Uma constante por conceito.** Nada de listas inline em JSX (`<MenuItem value="x">`), nem a mesma lista definida em dois módulos. Se dois módulos precisam da mesma lista, ela vive em um só lugar e o outro importa.

## Seleção em lista: sempre autocomplete

Nenhuma página usa `<TextField select>`, `<Select>` ou `<Autocomplete>` direto. Toda escolha em lista passa por `@/components/fields`:

| Componente | Quando | Fonte das opções |
|---|---|---|
| `AutocompleteField` | enum, catálogo, entidade limitada por natureza (cartões, contas, membros, laboratórios, grupos) | lista em memória: constante única ou **uma** busca de ativos (`listX()`), com cache do react-query |
| `MultiAutocompleteField` | seleção múltipla (grupos de usuário, marcadores de painel) | idem |
| `AsyncAutocompleteField` | lista que cresce sem limite (fornecedores, marcadores, catálogo de peças, veículos, imóveis) | **servidor**: `query` + `limit`, debounce, `resolve(id)` para o rótulo do valor já salvo |

Helpers: `optionsFromLabels(X_LABEL)` para enums que só têm mapa de rótulo; `numericOptions(...)` para mês/ano (o campo trabalha com `string`; converta na borda). Filtro "Todos"/"Não informar" é `emptyLabel`, nunca um `MenuItem` vazio.

## Fonte de verdade das listas

- **Enum de domínio** (status, kind, recorrência, forma de pagamento, tipo de documento…): pertence à API (código Go, não tabela). A API publica rótulos num endpoint de catálogo **não paginado** e cacheável; enquanto um enum não está lá, a fonte no admin é **uma** constante em `features/<x>/constants.ts` (`X_OPTIONS` + `X_LABEL`). Nunca duplique a lista noutro módulo.
- **Entidade limitada**: uma chamada `listX()` que devolve só **ativos** (`?active=true`). Inativo nunca entra em lista de opção; só serve para resolver nome de registro antigo (`listXIncludingInactive`, chave de cache própria).
- **Entidade que cresce**: endpoint paginado com `query`; o admin nunca baixa a lista inteira para filtrar no browser.
- **Só UI** (mês, ano, ordenação, período): constante no admin.

## Outras convenções

- Formulários com `react-hook-form` + `Controller`; os campos de `@/components/fields` aceitam `value`/`onChange` e entram direto no `render`.
- Dinheiro em centavos na API e `MoneyField` no form; percentuais em basis points na API e `DecimalField` no form.
- Datas `YYYY-MM-DD` na API; "hoje" é o fuso local, nunca `toISOString()`.
- Prettier só nos arquivos que você alterou e só no trecho alterado: não reformatar arquivos inteiros numa PR de outra coisa.
- Antes de commitar: `npm run type-check`, `npx eslint <pasta alterada>`, `npm run build`.

## Telefone (PWA): uma base, dois layouts

O admin é instalável como PWA e precisa funcionar em 390px sem prejudicar o desktop. O gatilho de TODA adaptação é largura (`useIsMobile()` = abaixo de `sm`), nunca `display-mode`; `useIsStandalone()` só para detalhes de app instalado.

- **Lista = `DataTable`** (`@/components/tables/DataTable`): colunas descritas uma vez; desktop renderiza `<Table>`, telefone renderiza cards. Papéis: `mobile: 'title' | 'value' | 'meta' | 'actions' | 'hidden'`, `mobileLabel` para metadado ambíguo, `mobileOnly` para a descrição que o desktop não mostra. Linha expansível = `leading` + `renderDetail` (detalhe com hooks vira componente próprio). Ordenação controlada = `sortable` + `sort`/`onSort`. Nunca escrever `<TableContainer><Table>` numa página de lista.
- **Filtros = `FilterBar`** (`@/components/common/FilterBar`): `primary` é a busca (sempre visível), o resto fica atrás do botão "Filtros" no telefone; `activeCount` = filtros fora do padrão.
- **Indicador = `StatCard`** (`@/components/common/StatCard`): único no repositório. Grid do card: `xs: 6` (duas colunas no telefone).
- **Diálogo**: já vira tela cheia no telefone pelo tema (`MuiDialog`/`MuiDialogActions` em `createAppTheme.ts`); não usar `fullScreen` à mão.
- **Rodapé mobile** (`MobileBottomNav`): atalhos fixos; "Lançar" abre Despesas com `?nova=1`. Permissão vem do menu principal, pela rota.
- Título de página pelo `PageHeader` (já compacto no telefone). Nada de `Typography h4` solto.
