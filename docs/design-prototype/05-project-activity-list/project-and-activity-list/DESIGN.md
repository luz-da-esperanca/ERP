---
name: Esperança Serena
colors:
  surface: '#fbf9f8'
  surface-dim: '#dbd9d9'
  surface-bright: '#fbf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f3f3'
  surface-container: '#efeded'
  surface-container-high: '#eae8e7'
  surface-container-highest: '#e4e2e2'
  on-surface: '#1b1c1c'
  on-surface-variant: '#42493c'
  inverse-surface: '#303030'
  inverse-on-surface: '#f2f0f0'
  outline: '#72796b'
  outline-variant: '#c2c9b8'
  surface-tint: '#3b6a20'
  primary: '#39671d'
  on-primary: '#ffffff'
  primary-container: '#508134'
  on-primary-container: '#f8ffed'
  inverse-primary: '#a0d57e'
  secondary: '#765934'
  on-secondary: '#ffffff'
  secondary-container: '#fed6a7'
  on-secondary-container: '#795b36'
  tertiary: '#5d5c58'
  on-tertiary: '#ffffff'
  tertiary-container: '#767471'
  on-tertiary-container: '#fbffe4'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#bbf297'
  primary-fixed-dim: '#a0d57e'
  on-primary-fixed: '#092100'
  on-primary-fixed-variant: '#245107'
  secondary-fixed: '#ffddb6'
  secondary-fixed-dim: '#e6c093'
  on-secondary-fixed: '#2a1800'
  on-secondary-fixed-variant: '#5c421f'
  tertiary-fixed: '#e5e2dd'
  tertiary-fixed-dim: '#c8c6c2'
  on-tertiary-fixed: '#1c1c19'
  on-tertiary-fixed-variant: '#474743'
  background: '#fbf9f8'
  on-background: '#1b1c1c'
  surface-variant: '#e4e2e2'
typography:
  display-lg:
    fontFamily: Source Serif 4
    fontSize: 36px
    fontWeight: '600'
    lineHeight: 44px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Source Serif 4
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Source Serif 4
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Source Serif 4
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 30px
    letterSpacing: 0em
  headline-md:
    fontFamily: Source Serif 4
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 30px
    letterSpacing: 0em
  headline-sm:
    fontFamily: Source Serif 4
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: 0em
  title-md:
    fontFamily: Nunito Sans
    fontSize: 16px
    fontWeight: '700'
    lineHeight: 24px
    letterSpacing: 0em
  title-sm:
    fontFamily: Nunito Sans
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 20px
    letterSpacing: 0.01em
  body-lg:
    fontFamily: Nunito Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-md:
    fontFamily: Nunito Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Nunito Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.01em
  data-mono:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: -0.01em
  label-lg:
    fontFamily: Nunito Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Nunito Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Nunito Sans
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.04em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-md: 1.5rem
  gutter-lg: 2rem
  margin: 1rem
  margin-md: 2rem
  margin-lg: 3rem
  space-xxs: 0.125rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 3rem
  space-3xl: 4rem
---

## Ações de cadastro — interface atual e evolução

O cabeçalho de “Projetos e atividades” mantém os dois pontos de entrada do protótipo: **Novo projeto** como ação primária e **Nova atividade** como secundária. Eles continuam visíveis no estado sem projetos para perfis com `projects.read` e `projects.write`. Perfis de consulta não recebem ações de cadastro. Em telas estreitas, os botões podem quebrar linha.

Na interface React atual, os formulários ainda não estão implementados. Os dois botões ficam desabilitados, associados por `aria-describedby` ao texto visível “Cadastros de projetos e atividades em breve.” Não navegam para rotas inexistentes nem simulam salvamento. A API e o adaptador em memória já oferecem operações de criação; habilitar os formulários e integrar HTTP são trabalhos posteriores.

### Fluxos previstos para implementação

- **Novo projeto:** formulário com nome e um instituto ativo obrigatórios; descrição, início e fim opcionais, preservando datas desconhecidas e validando início anterior ou igual ao fim quando ambos informados. Ações “Cadastrar projeto” e “Cancelar”; após sucesso, retornar à lista com o projeto criado.
- **Nova atividade:** reutilizar a [referência de cadastro de atividade](../../06-activity-registration/new-activity/code.html). Selecionar projeto ativo, nome e natureza; exigir tipo ativo somente para natureza pontual. Horário planejado é opcional. Ações “Cadastrar atividade” e “Cancelar”; após sucesso, retornar à lista com o projeto correspondente expandido. Sem projeto ativo, orientar a cadastrar um projeto antes de liberar o envio.
- **Acesso contextual futuro:** no detalhe do projeto, disponibilizar “Nova atividade” com o projeto de origem já selecionado. Manter o atalho global da lista; não exigir a navegação ao detalhe para iniciar um cadastro. Projetos encerrados preservam consulta e histórico, sem ação para criar atividade.

Esses fluxos seguem [SPEC-ATV](../../../specs/04-projects-activities.md), incluindo autorização no backend, revisão do projeto na criação da atividade, idempotência e auditoria. A natureza pontual cadastra apenas a atividade, sem introduzir registro de atendimento realizado. A referência existente de atividade deve ser conciliada com o recorte vigente antes da implementação.

Esta atualização documental define os pontos de entrada e o fluxo futuro; não introduz um novo mockup de formulário de projeto. Não foram criados testes para fixar a redação. A presença e o estado das ações na interface são verificados nos testes da tela React.

## Brand & Style

### Identidade e Filosofia
A identidade deste sistema apoia-se na interseção de dois arquétipos fundamentais: o **Cuidador** (acolhimento, proteção, empatia incondicional) e o **Sábio** (sobriedade técnica, precisão documental, discernimento e verdade factual). Projetado para a operação diária da assistência social em Parnaíba (PI), o design equilibra o calor humano necessário para lidar com histórias de vulnerabilidade social à precisão analítica exigida pela gestão de estoques, auditoria contábil e concessão de benefícios.

### Resposta Emocional
A interface transmite serenidade, confiabilidade e respeito. Elimina o aspecto burocrático hostil tradicional de softwares legados do setor público e do terceiro setor, substituindo-o por um ambiente calmo, livre de estímulos cognitivos excessivos, com legibilidade impecável sob qualquer condição de iluminação e conforto visual durante jornadas operacionais extensas.

### Estilo Visual: Humanismo Estruturado
O estilo funde o minimalismo funcional contemporâneo com uma abordagem tátil e orgânica:
- **Superfícies Quentes:** O branco puro (#FFFFFF) é restrito a contêineres de dados e cartões de foco ativo, ancorados sobre um fundo quente osso (#FAF7F2) que reduz a fadiga ocular.
- **Hierarquia Nobre:** Títulos editoriais transmitem dignidade institucional e peso histórico, enquanto os componentes de entrada e leitura densa mantêm clareza geométrica e acessibilidade estrita.
- **Sóbrio e Transparente:** Cores de status operam estritamente como indicadores semânticos, nunca como ornamentação decorativa superficial. A densidade de dados é equilibrada através de espaçamento modular e contraste deliberado.

## Colors

A paleta é orientada pela conformidade WCAG 2.2 AA (mínimo de 4.5:1 para texto normal, 3:1 para componentes gráficos e texto display).

### 1. Tons Fundamentais e Estruturais
- **Primária (Verde Esperança - `#5B8C3E`):** Representa renovação, acolhimento e confirmação. Aplicada em ações primárias, botões de submissão, seleção de navegação principal e confirmação de elegibilidade.
  - Variações: `#375823` (Dark/Hover ativo), `#466E2E` (Pressed), `#EBF3E6` (Soft Background).
- **Secundária (Dourado Terra - `#8C6D46`):** Evoca a terra fértil do Piauí, sustentação e nobreza da caridade. Empregada em metadados contextuais, cabeçalhos de seções de histórico social e badges de auditoria.
  - Variações: `#5E472B` (Hover/Dark), `#D9C7B2` (Bordas nobres), `#F7F2EB` (Background sutil).
- **Superfície Base (Branco-osso - `#FAF7F2`):** Fundo global do viewport, reduzindo o ofuscamento característico do branco digital padrão.
- **Superfície Elevada (Branco Puro - `#FFFFFF`):** Usada estritamente em cartões, linhas de tabelas ativas, modais e gavetas para criar separação óptica.
- **Texto Principal (Cinza-texto - `#292929` refinado a partir de `#4A4A4A` para conformidade estrita AA em fundos neutros):**
  - `#292929` (Título e corpo principal, contraste > 10.5:1 contra `#FAF7F2`).
  - `#525252` (Texto secundário, rótulos de formulários, contraste > 5.5:1).
  - `#757575` (Metadados terciários e textos desabilitados, contraste controlado).

### 2. Sinais Semânticos e Estados de Ficha Social
- **Aptidão Social:**
  - **Apta:** Fundo `#EAF5E9`, Borda `#5B8C3E`, Texto `#264A15` (Símbolo de aprovação clara).
  - **Não Apta:** Fundo `#FDF0ED`, Borda `#E85D4C`, Texto `#7D1F14` (Símbolo de impedimento com exigência de justificativa técnica).
  - **Pendente:** Fundo `#FEF8EC`, Borda `#F2994A`, Texto `#8A4C07` (Aguardando documentação ou vistoria).
- **Integridade de Estoque & Fatos Críticos:**
  - **Vencimento Crítico / Ruptura:** Coral `#E85D4C`.
  - **Atenção / Quarentena de Lote:** Laranja `#F2994A`.
  - **Saldo Reservado / Em Trânsito:** Amarelo `#C79800` (escurecido para manter legibilidade sobre claro).
  - **Fato Social Registrado / Informativo:** Azul `#217CA3` (modificado do `#3D9BD1` para contraste acessível de 4.8:1 sobre branco).
  - **Acompanhamento Especializado / Proteção Legal:** Roxo `#6F4299` (baseado no acento `#9B6FC4`, ajustado para leitura técnica).

## Typography

A tipografia estabelece uma clara divisão entre narrativa e operação:
- **Títulos e Narrativa (Serifada / Humanista):** Utilizada no nível de páginas, fichas familiares e títulos de blocos de prontuário social. Confere autoridade e serenidade às histórias de vida registradas.
- **Interface, Dados e Formulários (Nunito Sans):** Com curvas humanizadas e excelente x-height, Nunito Sans garante leitura fluida em formulários extensos, tabelas operacionais e chips de auditoria sem a rigidez mecânica excessiva dos sem-serifas industriais.
- **Identificadores Numéricos e Fiscais (`data-mono`):** Utilizado para CPFs, códigos NIS, códigos de lote de suprimentos, carimbos de data/hora (ISO) e saldos físicos de estoque para evitar ambiguidades entre caracteres (como 0 e O, 1 e l).

## Layout & Spacing

### Modelo Estrutural
O sistema utiliza um layout baseado em grade de 12 colunas no desktop com barra lateral fixa de 260px para navegação operacional e área de trabalho contida com largura máxima recomendada de 1600px para leitura de relatórios.

### Adaptação por Dispositivo
- **Mobile (< 768px):** Grade fluida de 4 colunas. Margem externa de `1rem`, gutter de `1rem`. Formulários empilham em 1 coluna única. Tabelas densas ativam modo de cartão de resumo expansível com drawer lateral para edição.
- **Tablet (768px a 1199px):** Grade fluida de 8 colunas. Margem de `2rem`, gutter de `1.5rem`. A barra lateral recolhe-se em modo mini-ícone (64px) ou menu gaveta.
- **Desktop (≥ 1200px):** Grade de 12 colunas com suporte a visões duplas: Ficha Social à esquerda (7 colunas) e Histórico de Visitas/Concessões à direita (5 colunas).

### Modos de Densidade (ERP Toggle)
- **Densidade Confortável (Padrão):** Linhas de tabela com 48px de altura, inputs com 44px de altura mínima (garantindo alvo tátil recomendado), padding de células de `0.75rem 1rem`. Ideal para triagem, cadastro de famílias e atendimento.
- **Densidade Compacta:** Linhas de tabela com 36px, inputs com 36px, padding de `0.375rem 0.75rem`. Ideal para conferência de estoque de lotes, importação de dados e conferência de frequência em massa.

## Elevation & Depth

### Princípios de Profundidade: Camadas Tonais e Luz Suave
O sistema dispensa sombras pesadas ou artificiais. A hierarquia é obtida primordialmente por estratificação de cores de superfície e bordas de contenção:

1. **Superfície Nível 0 (Lona Global):** `#FAF7F2` (Branco-osso quente). Onde repousam os agrupamentos e cabeçalhos de visualização.
2. **Superfície Nível 1 (Cartões e Painéis):** `#FFFFFF` com contorno de contenção de 1px em `#E8E3DA`. Separa blocos de informação (ex.: Ficha de Identificação vs. Composição Familiar).
3. **Superfície Nível 2 (Elementos Interativos e Dropdowns):** `#FFFFFF` com sombra de contato ultra-difusa:
   - `box-shadow: 0 4px 16px -2px rgba(92, 75, 50, 0.08), 0 1px 3px 0 rgba(92, 75, 50, 0.04);`
   - O tom da sombra é matizado pelo marrom-terra, eliminando o efeito acinzentado frio.
4. **Superfície Nível 3 (Diálogos Modais, Painéis de Auditoria e Gavetas Laterais):** `#FFFFFF` com borda de `1px solid #D9C7B2` e sombra de profundidade:
   - `box-shadow: 0 12px 32px -4px rgba(60, 48, 30, 0.12), 0 4px 8px -2px rgba(60, 48, 30, 0.06);`
   - Backdrop com desfoque moderado: `rgba(41, 41, 41, 0.4)` acompanhado de `backdrop-filter: blur(4px)`.

## Shapes

O sistema adota uma linguagem de contorno **Soft (Nível 1)**, priorizando a retidão e precisão funcional exigidas por interfaces de alta densidade técnica, amenizada por micro-arredondamentos nas extremidades:

- **Bordas Base (Inputs, Botões, Células destacadas):** `0.25rem` (4px). Garante alinhamento rigoroso em grelhas e tabelas.
- **Cartões e Painéis de Conteúdo (`rounded-lg`):** `0.5rem` (8px). Proporciona acabamento acolhedor sem dispersar a área útil de tela.
- **Modais e Gavetas de Auditoria (`rounded-xl`):** `0.75rem` (12px).
- **Badges, Tags e Chips de Aptidão:** `0.25rem` (4px) para dados estruturados, ou `9999px` (Pill) exclusivamente quando o chip representa uma pessoa ou estado de frequência rápida (Presente/Ausente).

## Components

### 1. Botões
- **Primário:** Fundo `#5B8C3E`, texto `#FFFFFF`, peso `600`, raio `4px`. No hover: `#466E2E`. No foco: anel duplo (`2px` branco interno, `2px` `#5B8C3E` externo).
- **Secundário (Terra):** Fundo `#F7F2EB`, borda `1px solid #8C6D46`, texto `#5E472B`. Hover: `#EFE6DA`.
- **Destrutivo Controlado:** Fundo `#FFFFFF`, borda `1px solid #E85D4C`, texto `#B83222`. Ao confirmar com duplo clique/trava de auditoria: fundo `#E85D4C`, texto `#FFFFFF`.

### 2. Badges de Estado e Aptidão Social
Devem sempre incluir um ícone distintivo além da cor para atender às diretrizes WCAG:
- **Apta:** Ícone de check circular, fundo `#EAF5E9`, texto `#264A15`, borda `#94C87A`.
- **Não Apta:** Ícone de alerta octogonal, fundo `#FDF0ED`, texto `#7D1F14`, borda `#F4A499`.
- **Pendente:** Ícone de relógio/espera, fundo `#FEF8EC`, texto `#8A4C07`, borda `#F8C68C`.

### 3. Formulários & Campos de Entrada (Ficha Social)
- **Estados:** Padrão com fundo `#FFFFFF`, borda `1px solid #D1C9BE`. Foco: borda `2px solid #5B8C3E` sem deslocamento de layout.
- **Campos Imutáveis / Fatos Históricos:** Fundo `#F3EFEA`, borda pontilhada `1px solid #C4BCB0`, texto `#525252`, acompanhado de ícone de cadeado e tooltip: *"Dado auditado e selado em [Data/Hora] por [Assistente Social]"*.

### 4. Tabelas de Operação e Estoque
- **Cabeçalho:** Fundo `#F2ECE2`, texto `#5E472B`, peso `700`, com linha divisória de `2px solid #D9C7B2`.
- **Diferenciação de Saldos:**
  - *Saldo Físico:* Apresentado em tipografia regular (`13px JetBrains Mono`).
  - *Saldo Disponível:* Exibido em destaque ponderado; caso haja reserva pendente de entrega, exibe indicador de retenção ao lado com badge amarelo suave (`#FEF8EC`).
- **Alertas de Validade:** Lotes a menos de 30 dias do vencimento recebem flag sutil com a cor Coral (`#E85D4C`) na coluna de validade.

### 5. Histórico Social & Trilha de Auditoria (Timeline)
- Linha de conexão vertical sólida de `2px` em `#D9C7B2`.
- Marcadores temporais com círculos de status coloridos segundo a natureza do evento (visita domiciliar, entrega de cesta básica, parecer psicológico, atualização cadastral).
- Caixa de conteúdo com registro irredutível: autor do lançamento, timestamp indelével e versão da ficha social.
