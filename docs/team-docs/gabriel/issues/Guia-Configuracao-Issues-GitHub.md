# Guia de configuração das issues no GitHub — Equipe Gabriel

Issues e especificações do projeto ficam no GitHub Issues de `luz-da-esperanca/ERP`. Este guia registra o procedimento usado para publicar as issues da equipe Gabriel, no mesmo padrão adotado pela equipe Fabricio, e o procedimento para os ciclos seguintes.

## Padrão adotado

O repositório tem um único padrão para as duas equipes, definido pelas issues da equipe Fabricio (#1 a #5). As issues da equipe Gabriel seguem exatamente o mesmo formato.

| Elemento | Padrão |
|---|---|
| Prefixo do título | `[Ciclo 1][TG-01-01]` — ciclo da equipe Gabriel |
| Equipe | `**Equipe:** Gabriel` |
| Período | `**Ciclo:** 1 — previsto de 19/10/2026 a 30/10/2026` |
| Âncora na grade geral | `**Corresponde a:** S1 e S2 gerais` |
| Responsável e revisor | `**Responsável:**` e `**Revisor:**` com o login no formato `(@login)` |
| Tipo de trabalho | `**Tipo de trabalho:** Execução` ou `Somente revisão técnica` |
| Origem | `**Origem:**` com os IDs dos cartões e dos itens comuns |
| Seções | Objetivo · Escopo e critérios de aceite · Dependências e limites · Verificação e evidências de conclusão · Fontes |
| Labels | Nenhuma |
| Épico | Nenhum |
| Sub-issues | Nenhuma |
| Dependências nativas | Nenhuma |
| Assignee | Somente o responsável; o revisor fica registrado no corpo |

A tarefa de revisão usa seções próprias, conforme a issue de revisão da equipe Fabricio: `Escopo da revisão` (itens narrativos) e `Critérios de aceite` (caixas de marcação).

### Por que o prefixo é `[Ciclo 1]`

A equipe Fabricio usa sprint e a equipe Gabriel usa ciclo. As contagens são iguais — sete unidades de planejamento e 35 tarefas por equipe — mas as durações não são: os sprints da equipe Fabricio são semanais, enquanto os ciclos da equipe Gabriel variam de 10 a 2 dias úteis.

A correspondência com a grade geral de integração fica no corpo da issue, na linha `**Corresponde a:**`, e não no título. Isso mantém o prefixo fiel à unidade real de planejamento de cada equipe, sem confundi-lo com o identificador de cartão comum `C-01` nem com a janela geral `S1`.

## Ferramental

O CLI `gh` é a ferramenta oficial do rastreador neste repositório. As instruções completas estão em `docs/agents/issue-tracker.md`.

```powershell
winget install --id GitHub.cli
gh auth login
gh auth status
```

## Procedimento por issue

Os corpos ficam versionados em `docs/team-docs/gabriel/issues/`. Para publicar uma issue:

```powershell
gh issue create `
  --title "[Ciclo 1][TG-01-02] Implementar catálogo de itens e unidades" `
  --body-file "docs/team-docs/gabriel/issues/tg-01-02.md" `
  --assignee "Erick-VP"
```

O `--body-file` preserva as quebras de linha; `--body` com texto inline não serve para corpos longos.

### Sequência de publicação

Publique na ordem dos identificadores, para que a numeração do GitHub acompanhe a numeração da tarefa. Após publicar todas, registre os vínculos cruzados em cada issue:

```powershell
gh issue comment 6 --body-file "docs/team-docs/gabriel/issues/links/tg-01-01.md"
```

O GitHub só converte `#6` em link quando o número já existe. Por isso os vínculos são um passo posterior à criação, e não parte do corpo inicial.

### Conferência

```powershell
gh issue list --state all --limit 20 --json number,title,labels,assignees,comments
gh issue view 7 --json number,title,body,labels,assignees,comments
```

Verifique se a issue tem exatamente um assignee, o responsável, e nenhuma label.

## Como a equipe Fabricio fez

Para referência, as cinco issues da equipe Fabricio foram publicadas em 22/10/2026 com os mesmos comandos, com uma diferença: a issue do TF-01-05 ficou sem assignee porque a conta do GitHub do Kauã ainda não estava identificada. Onde o login do responsável é desconhecido, a issue é publicada sem assignee e o corpo registra `Nome (conta do GitHub pendente de identificação)`, para ser completada depois que a conta existir.

## Vínculos entre as issues do ciclo

O ciclo 1 tem cinco tarefas, com um responsável principal por integrante e a revisão do líder. Os vínculos de dependência funcional estão descritos no corpo de cada issue; o registro estruturado no tracker é feito pelo comentário de vínculos.

| Issue | Tarefa | Responsável | Revisor | Tipo |
|---|---|---|---|---|
| #6 | TG-01-01 | Gabriel (líder) | — | Somente revisão técnica |
| #7 | TG-01-02 | Erick (@Erick-VP) | Felipe (@FelipeeMartinns) | Execução |
| #8 | TG-01-03 | Felipe (@FelipeeMartinns) | Gabriel (líder) | Execução |
| #9 | TG-01-04 | Samuel (@Zidan-09) | Paulo (@PaulEvezely) | Execução |
| #10 | TG-01-05 | Paulo (@PaulEvezely) | Erick (@Erick-VP) | Execução |

## Ciclos seguintes

O mesmo procedimento vale para os ciclos 2 a 7, com o prefixo `[Ciclo N]`, o período correspondente em `docs/team-docs/gabriel/Sprint-Planning-ERP-Gabriel.md` e a linha `**Corresponde a:**` preenchida com a janela geral.

Para os ciclos 4 e 5, que dividem a semana geral S5, a correspondência é `S5 geral, ciclo 5a` e `S5 geral, ciclo 5b`. Os corpos desses ciclos precisam registrar que a entrega de G-10 só é concluída após consumir a avaliação oficial de PB-20, e que a conclusão de C-04 depende do aceite real em 20/11.

Os identificadores de origem em cada corpo vêm da coluna `Origem` da tabela de tarefas do planejamento da equipe Gabriel. As âncoras de linha nos links de `Fontes` devem ser conferidas contra `main` no momento da publicação, porque o planejamento é revisado a cada ciclo.

## Fontes

- [Planejamento da equipe Gabriel — calendários e tarefas dos sete ciclos](https://github.com/luz-da-esperanca/ERP/blob/main/docs/team-docs/gabriel/Sprint-Planning-ERP-Gabriel.md)
- [Backlog da equipe Gabriel — cartões G-01 a G-15 e reservas](https://github.com/luz-da-esperanca/ERP/blob/main/docs/team-docs/gabriel/Product-Backlog-ERP-Gabriel.md)
- [Instruções do rastreador](https://github.com/luz-da-esperanca/ERP/blob/main/docs/agents/issue-tracker.md)
