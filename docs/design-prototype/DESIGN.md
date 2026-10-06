---
version: "alpha"
name: "Luz da Esperança — Gestão Social"
description: "Design system para ERP social interno, com foco em clareza, acolhimento e baixa carga visual."
colors:
  primary: "#5B8C3E"
  primary-action: "#4F7A35"
  secondary: "#8C6D46"
  background: "#FAF7F2"
  surface: "#FFFFFF"
  text: "#4A4A4A"
  text-strong: "#222222"
  text-muted: "#6B6B6B"
  border: "#DDD8CF"
  focus: "#2F6F9F"
  coral: "#E85D4C"
  orange: "#F2994A"
  yellow: "#F2C94C"
  blue: "#3D9BD1"
  purple: "#9B6FC4"
typography:
  page-title:
    fontFamily: "Lora"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.2
  section-title:
    fontFamily: "Lora"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Nunito Sans"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: "Nunito Sans"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Nunito Sans"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.35
  metadata:
    fontFamily: "Nunito Sans"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.35
rounded:
  sm: "6px"
  md: "10px"
  lg: "14px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.primary-action}"
    textColor: "#FFFFFF"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
    height: "40px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-strong}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
    height: "40px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    height: "44px"
  status-tag:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text-strong}"
    typography: "{typography.metadata}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
---

## Overview

ERP web interno para o Centro Espírita e Obras Sociais Luz da Esperança. A interface deve transmitir acolhimento, serenidade, clareza e confiança sem parecer uma landing page, um produto financeiro ou um painel corporativo genérico.

A prioridade é a tarefa operacional atual. Regras de negócio, auditoria, permissões e validações devem orientar o comportamento da interface. Elas não devem virar parágrafos visíveis, cards explicativos ou alertas permanentes sem necessidade.

## Colors

Use o Verde Esperança #5B8C3E como assinatura institucional em navegação ativa, ícones e detalhes. Para botões preenchidos com texto branco, use o verde derivado acessível #4F7A35. O Dourado Terra #8C6D46 é secundário e deve aparecer com moderação.

O fundo principal é Branco-osso #FAF7F2. Superfícies de trabalho podem usar branco. O texto padrão é #4A4A4A, com #222222 para títulos e conteúdo que exige maior contraste.

A paleta multicolorida do logotipo é de acento. Use no máximo duas cores de acento por tela, apenas quando tiverem significado funcional. Não distribua as cores das pétalas entre cards ou módulos como decoração.

## Typography

Use Lora apenas em títulos de página e títulos de seção. Use Nunito Sans em campos, tabelas, botões, navegação, textos e metadados. Não use tipografia manuscrita no ERP operacional.

Mantenha títulos curtos. Evite subtítulos explicativos quando o próprio layout já deixa a tarefa clara. Corpo de texto visível deve ser curto e contextual.

## Layout

Desktop-first. Trabalhe em largura de referência de 1440 px. Use sidebar recolhível entre 220 e 240 px e topbar compacta. O conteúdo principal deve ter largura confortável e margens amplas.

Use uma coluna para formulários e tarefas lineares. Use duas colunas apenas para comparação, revisão ou painel master-detail. Não use mosaicos de cards como estrutura padrão.

Aplique progressive disclosure. Informações frequentes ficam no primeiro nível. Histórico, auditoria, evidências, filtros avançados e detalhes raros ficam em drawer, accordion, aba secundária ou “Mais ações”. Não ultrapasse dois níveis de revelação.

Tabelas devem mostrar de quatro a seis colunas úteis. Filtros visíveis ficam limitados a busca e dois ou três filtros frequentes. Formulários longos usam etapas, com quatro a sete campos visíveis por vez.

## Elevation & Depth

Prefira bordas leves e separação por espaçamento. Use sombras apenas em overlays, modais e drawers, com baixa intensidade. Não use elevação para transformar cada seção em um card.

## Shapes

Cantos suaves, sem aparência infantil. Use raio médio nos controles e pequeno em tags. Ícones devem ser simples, de linha, consistentes e funcionais.

## Components

Reutilize um conjunto pequeno e consistente de componentes: Sidebar, Topbar, PageHeader, Button, IconButton, Input, Select, SearchField, FilterBar, DataTable, StatusTag, EmptyState, Tabs, Stepper, Accordion, Drawer, Modal, Toast e Pagination.

Uma tela tem no máximo uma ação primária preenchida por contexto. Ações secundárias usam estilo neutro. Ações raras ou destrutivas ficam em “Mais ações” e pedem confirmação quando a regra de negócio exigir.

Alertas aparecem somente quando exigem decisão, correção ou bloqueio. Use no máximo um alerta de destaque no primeiro nível da tela. Mensagens comuns usam validação inline, texto auxiliar curto ou toast.

## Do's and Don'ts

Faça:
- use espaço vazio como parte do design;
- priorize nome, status e próxima ação;
- agrupe campos por proximidade e sequência de trabalho;
- mantenha labels persistentes;
- use ícone e texto em status importantes;
- revele histórico, auditoria e evidências sob demanda;
- preserve estados vazios e de acesso negado sem mostrar vários estados ao mesmo tempo;
- use dados sintéticos em português do Brasil.

Não faça:
- não transforme regras do prompt em textos visíveis na interface;
- não repita a mesma informação em título, card, tabela e alerta;
- não use KPI cards, gráficos ou métricas decorativas fora das telas que realmente precisam;
- não use mais de três blocos principais no primeiro nível da tela;
- não use parágrafos longos de ajuda;
- não use gradiente, neon, glassmorphism, 3D ou dark mode;
- não use imagens de banco de “caridade”;
- não use todas as cores do logotipo ao mesmo tempo;
- não invente regras, prazos, percentuais, prioridades ou parâmetros de negócio.
