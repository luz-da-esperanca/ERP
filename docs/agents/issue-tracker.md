# Rastreador de tarefas: GitHub

Issues e especificações deste repositório ficam no GitHub Issues de `luz-da-esperanca/ERP`. Use o CLI `gh` para operar o rastreador.

## Convenções

Execute os comandos dentro do clone; o `gh` identifica o repositório pelo remoto. Fora dele, informe `--repo luz-da-esperanca/ERP`.

- Criar uma issue: `gh issue create --title "<título>" --body-file <arquivo.md>`.
- Ler uma issue: `gh issue view <number> --json number,title,body,labels,comments`.
- Listar issues: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`. Ajuste os filtros `--label` e `--state` conforme a tarefa.
- Vincular uma sub-issue: `gh issue create --parent <parent> --title "<título>" --body-file <arquivo.md>`, ou `gh issue edit <parent> --add-sub-issue <child>` para uma issue existente.
- Comentar: `gh issue comment <number> --body-file <arquivo.md>`.
- Aplicar ou remover labels: `gh issue edit <number> --add-label "<label>"` ou `--remove-label "<label>"`.
- Encerrar: `gh issue close <number> --comment "<motivo>"`.

Para textos com várias linhas, grave o conteúdo em um arquivo temporário e use `--body-file`, preservando as quebras de linha.

Em versões antigas do CLI sem suporte a sub-issues, use `gh api --method POST repos/luz-da-esperanca/ERP/issues/<parent>/sub_issues -F sub_issue_id=<child-db-id>`. Se o recurso não estiver disponível no repositório, inclua `Part of #<parent>` no início da issue filha e um item na lista de tarefas da issue pai.

## Pull requests na triagem

**PRs as a request surface: no.**

Se essa configuração mudar para `yes`, use as mesmas labels e estados das issues:

- Ler um PR: `gh pr view <number> --comments` e `gh pr diff <number>`.
- Listar PRs externos: `gh api --paginate 'repos/luz-da-esperanca/ERP/pulls?state=open' --jq '.[] | select(.author_association | IN("OWNER","MEMBER","COLLABORATOR") | not) | {number, title, author: .user.login, author_association, labels: [.labels[].name]}'`.
- Comentar, aplicar labels e encerrar: `gh pr comment`, `gh pr edit --add-label` / `--remove-label` e `gh pr close`.

Issues e PRs compartilham a numeração. Para uma referência ambígua como `#42`, consulte `gh pr view 42`; se não for um PR, use `gh issue view 42`.

## Instruções das skills

- “Publicar no rastreador”: criar uma issue no GitHub.
- “Buscar o ticket relevante”: ler a issue com o comando indicado nas convenções.

## Operações de /wayfinder

O mapa é uma issue com tickets filhos.

- **Mapa**: issue com a label `wayfinder:map`, contendo notas, decisões acumuladas e incertezas. Crie com `gh issue create --label wayfinder:map --title "<título>" --body-file <arquivo.md>`.
- **Ticket filho**: sub-issue do mapa, com a label `wayfinder:<type>`, sendo o tipo `research`, `prototype`, `grilling` ou `task`. Se sub-issues não estiverem disponíveis, use a lista de tarefas do mapa e a referência `Part of #<map>`. Ao assumir o ticket, atribua-o ao desenvolvedor responsável.
- **Dependências**: use as dependências nativas do GitHub. Para registrar um bloqueador, execute `gh api --method POST repos/luz-da-esperanca/ERP/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`. Obtenha o identificador numérico de banco com `gh api repos/luz-da-esperanca/ERP/issues/<number> --jq .id`; esse identificador difere do número público da issue e do `node_id`. O campo `issue_dependencies_summary.blocked_by` conta bloqueadores abertos. Se dependências nativas não estiverem disponíveis, registre `Blocked by: #<number>, #<number>` no início do corpo. O ticket fica liberado quando todos os bloqueadores estiverem encerrados.
- **Próximo ticket**: liste os filhos abertos do mapa, pelas sub-issues ou pela lista de tarefas; descarte os atribuídos e aqueles com bloqueadores abertos. Escolha o primeiro restante na ordem do mapa.
- **Assumir**: `gh issue edit <number> --add-assignee @me` é a primeira escrita da sessão de execução do ticket.
- **Resolver**: publique a resposta com `gh issue comment <number> --body-file <arquivo.md>`, encerre a issue e acrescente uma síntese com link às decisões acumuladas no mapa.
