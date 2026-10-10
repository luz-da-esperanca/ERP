# Guia de estilo do frontend

Este é o guia de implementação visual para `apps/web`. Ele traduz para React,
TSX e Tailwind CSS as regras definidas em
[`docs/design-prototype/DESIGN.md`](../../docs/design-prototype/DESIGN.md).

O documento em `docs/design-prototype/` é a fonte de verdade do design. Ao
alterar uma decisão visual, atualize primeiro a fonte e mantenha este guia
alinhado. Este guia não autoriza criar regras de negócio, permissões, prazos,
prioridades ou parâmetros que não estejam definidos nas specs.

## Objetivo

O ERP Social Luz da Esperança é uma ferramenta interna. A interface deve ser
acolhedora, serena, clara e confiável, sem se parecer com uma landing page, um
produto financeiro ou um painel corporativo genérico.

A tarefa operacional atual vem primeiro. Regras de negócio, auditoria,
permissões e validações orientam o comportamento dos componentes, mas não
devem ser apresentadas como parágrafos, cards explicativos ou alertas
permanentes sem necessidade.

## Tokens visuais

Use os valores abaixo em classes Tailwind, variáveis de tema ou componentes
compartilhados. Não introduza valores semelhantes por conveniência.

### Cores

| Token            | Valor     | Uso                                                           |
| ---------------- | --------- | ------------------------------------------------------------- |
| `primary`        | `#5B8C3E` | Assinatura institucional: navegação ativa, ícones e detalhes. |
| `primary-action` | `#4F7A35` | Botões preenchidos com texto branco.                          |
| `secondary`      | `#8C6D46` | Acento secundário, usado com moderação.                       |
| `background`     | `#FAF7F2` | Fundo principal branco-osso.                                  |
| `surface`        | `#FFFFFF` | Superfícies de trabalho.                                      |
| `text`           | `#4A4A4A` | Texto padrão.                                                 |
| `text-strong`    | `#222222` | Títulos e conteúdos que exigem maior contraste.               |
| `text-muted`     | `#6B6B6B` | Metadados e informações secundárias.                          |
| `border`         | `#DDD8CF` | Bordas e separadores discretos.                               |
| `focus`          | `#2F6F9F` | Foco visível.                                                 |
| `coral`          | `#E85D4C` | Acento funcional.                                             |
| `orange`         | `#F2994A` | Acento funcional.                                             |
| `yellow`         | `#F2C94C` | Acento funcional.                                             |
| `blue`           | `#3D9BD1` | Acento funcional.                                             |
| `purple`         | `#9B6FC4` | Acento funcional.                                             |

O verde `#5B8C3E` é a assinatura institucional. Para ações preenchidas com
texto branco, use `#4F7A35`, que oferece contraste adequado. O dourado-terra é
secundário e não compete com a ação principal.

As cores multicoloridas do logotipo são acentos funcionais: use no máximo duas
em uma tela e apenas quando transmitirem um significado. Não distribua cores
pelos cards ou módulos como decoração.

### Tipografia

| Token           | Família     | Tamanho    | Peso | Entrelinha | Uso                         |
| --------------- | ----------- | ---------- | ---- | ---------- | --------------------------- |
| `page-title`    | Lora        | `2rem`     | 600  | 1.2        | Título da página.           |
| `section-title` | Lora        | `1.25rem`  | 600  | 1.3        | Título de seção.            |
| `body`          | Nunito Sans | `1rem`     | 400  | 1.5        | Texto padrão.               |
| `body-sm`       | Nunito Sans | `0.875rem` | 400  | 1.45       | Texto auxiliar curto.       |
| `label`         | Nunito Sans | `0.875rem` | 600  | 1.35       | Labels, botões e navegação. |
| `metadata`      | Nunito Sans | `0.75rem`  | 400  | 1.35       | Metadados e tags.           |

Use Lora somente em títulos de página e de seção. Use Nunito Sans nos demais
elementos, incluindo campos, tabelas, botões, navegação e metadados. Não use
tipografia manuscrita no ERP. Mantenha títulos curtos e evite subtítulos que o
layout já torna desnecessários; textos visíveis devem ser breves e contextuais.

### Espaçamento e formas

| Token         | Valor  |
| ------------- | ------ |
| `spacing-xs`  | `4px`  |
| `spacing-sm`  | `8px`  |
| `spacing-md`  | `16px` |
| `spacing-lg`  | `24px` |
| `spacing-xl`  | `32px` |
| `spacing-2xl` | `48px` |
| `radius-sm`   | `6px`  |
| `radius-md`   | `10px` |
| `radius-lg`   | `14px` |

Use cantos suaves, sem aparência infantil: `radius-md` em controles e
`radius-sm` em tags. Ícones são simples, de linha, consistentes e sempre têm
função. Prefira bordas leves e espaçamento para separar conteúdo. Sombras,
sempre discretas, ficam restritas a overlays, modais e drawers; não use sombra
para converter cada seção em um card.

## Layout e hierarquia

- Desenvolva desktop-first, usando 1440 px como largura de referência.
- A sidebar recolhível mede entre 220 px e 240 px; a topbar é compacta.
- Dê ao conteúdo principal largura confortável e margens amplas.
- Use uma coluna em formulários e tarefas lineares. Duas colunas só cabem em
  comparação, revisão ou master-detail.
- Não use mosaicos de cards como estrutura padrão.
- Limite o primeiro nível da tela a três blocos principais.
- Aplique progressive disclosure: dados frequentes ficam visíveis; histórico,
  auditoria, evidências, filtros avançados e detalhes raros ficam em drawer,
  accordion, aba secundária ou em “Mais ações”. Não exceda dois níveis de
  revelação.

Tabelas exibem de quatro a seis colunas úteis. Deixe visíveis apenas a busca e
dois ou três filtros frequentes. Formulários longos devem ser divididos em
etapas, mostrando de quatro a sete campos por vez.

## Componentes React e TSX

Construa telas compondo um conjunto pequeno e consistente. Antes de criar um
novo componente, verifique se um destes resolve a necessidade:

- `Sidebar`, `Topbar` e `PageHeader` para a estrutura da aplicação;
- `Button` e `IconButton` para ações;
- `Input`, `Select` e `SearchField` para entrada;
- `FilterBar`, `DataTable` e `Pagination` para coleções;
- `StatusTag`, `EmptyState`, `Toast` e validação inline para feedback;
- `Tabs`, `Stepper`, `Accordion`, `Drawer` e `Modal` para revelar conteúdo ou
  concentrar fluxos.

Ao escrever TSX:

- escolha componentes semânticos (`main`, `nav`, `header`, `section`, `form`,
  `label`, `button` e tabela) antes de adicionar `div`;
- mantenha cada componente responsável por uma região ou interação; extraia
  subcomponentes quando isso deixar a intenção e os estados mais claros;
- receba conteúdo variável por props tipadas e use `ReactNode` somente quando
  a prop realmente representar conteúdo arbitrário;
- represente estados de carregamento, vazio, erro, sucesso e acesso negado de
  maneira explícita, sem empilhar mais de um estado na mesma região;
- associe todo campo ao seu label persistente; não use placeholder como label;
- forneça nome acessível em botões exclusivamente visuais (`aria-label`) e
  mantenha foco visível;
- use ícone junto a texto em status importantes; ícones não substituem uma
  mensagem necessária;
- escreva textos da interface em português do Brasil e use somente dados
  sintéticos em demonstrações e testes visuais.

As regras de domínio, autorização, auditoria e validação de dados permanecem
fora dos componentes React. A interface consome a API e apresenta apenas os
estados e contratos que ela recebe.

## Ações, mensagens e estados

Cada contexto tem, no máximo, uma ação primária preenchida. As ações
secundárias usam aparência neutra. Ações raras ou destrutivas ficam em “Mais
ações” e solicitam confirmação quando a regra de negócio exigir.

Os componentes-base seguem estas medidas:

| Componente       | Regras                                                                                                         |
| ---------------- | -------------------------------------------------------------------------------------------------------------- |
| Botão primário   | Fundo `primary-action`, texto branco, tipografia `label`, `radius-md`, `40px` de altura e padding `10px 16px`. |
| Botão secundário | Fundo `surface`, texto `text-strong`, tipografia `label`, `radius-md`, `40px` de altura e padding `10px 16px`. |
| Input            | Fundo `surface`, texto `text`, tipografia `body`, `radius-md` e `44px` de altura.                              |
| StatusTag        | Fundo `background`, texto `text-strong`, tipografia `metadata`, `radius-sm` e padding `4px 8px`.               |

Mostre alertas somente quando houver decisão, correção ou bloqueio. O primeiro
nível da tela contém no máximo um alerta de destaque. Para retornos comuns,
prefira validação inline, texto auxiliar curto ou toast. Estados vazios e de
acesso negado são exclusivos: não apresente vários estados concorrentes na
mesma área.

## Checklist de revisão visual

Antes de considerar uma tela concluída, confirme:

- a tarefa prioritária, o nome, o status e a próxima ação são identificáveis
  sem percorrer a tela inteira;
- há espaço vazio suficiente, campos estão agrupados pela sequência de
  trabalho e labels permanecem visíveis;
- a tela respeita os limites de blocos, filtros, colunas e campos definidos
  neste guia;
- detalhes raros estão disponíveis sob demanda e não escondem a informação
  necessária para a tarefa principal;
- a cor é funcional, a ação primária é única e não há acentos decorativos em
  excesso;
- nenhum texto inventa regra de negócio, prazo, percentual, prioridade ou
  parâmetro;
- não há gradiente, neon, glassmorphism, 3D, dark mode, imagens de banco de
  “caridade”, nem todas as cores do logotipo em uma única tela.
