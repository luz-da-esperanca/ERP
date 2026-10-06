# Telas e integrações do frontend

Revisão em 05/10/2026, limitada ao [MVP vigente](specs/README.md).
O inventário considera rotas, componentes de apresentação e adaptadores; a
existência de um gateway em memória não comprova uma tela nem integração HTTP.

## Entrada conectada à API

A entrada principal usa o contrato HTTP de ACS: login, restauração da sessão
por cookie, logout confirmado e troca de senha, incluindo a obrigatória no
primeiro acesso. As capacidades são recebidas do servidor. Erros de dependência
não são tratados como sessão anônima, e uma resposta atrasada não restaura o
acesso após logout ou resposta 401.

Durante a transição, as demais rotas mostram a indisponibilidade da integração.
Os componentes do protótipo e seus testes permanecem no código, sem alimentar
a sessão HTTP com dados em memória. Essa é a premissa adotada para esta entrega;
não foi adicionada uma segunda entrada de demonstração.

## Interfaces já existentes no protótipo

| Tela ou fluxo                              | Evidência                                       | Trabalho restante                                                                                                                             |
| ------------------------------------------ | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Início                                     | `features/home/presentation/dashboard-page.tsx` | Consultas autorizadas, totais com fonte e atividade recente pela API.                                                                         |
| Lista e busca de famílias                  | `families-page.tsx`, `search-page.tsx`          | Busca/paginação HTTP e estados de erro; a aptidão exibida ainda é fixa como Pendente.                                                         |
| Criação, edição e perfil familiar          | `family-page.tsx`, `family-form.tsx`            | Adaptar os DTOs HTTP, revisões, conflitos e idempotência; conectar composição por data e histórico autorizado.                                |
| Membros da família                         | `FamilyMembersPage` em `family-page.tsx`        | Consultar a API e implementar as ações de composição. O link “Adicionar pessoa” aponta para `/people/new`, mas falta a página correspondente. |
| Perfil individual                          | `person-page.tsx`                               | Integrar os dados atuais e vínculos históricos; não existe formulário de criação/edição individual.                                           |
| Lista de projetos e atividades             | `projects-page.tsx`, `project-group.tsx`        | Consultar a API. “Novo projeto” e “Nova atividade” estão desabilitados.                                                                       |
| Detalhe de atividade e inscrições vigentes | `activity-page.tsx`, `enrollment-list.tsx`      | Integrar o detalhe e participantes; responsável e encontros recentes estão indisponíveis; faltam ações de inscrição.                          |
| Histórico familiar                         | `family-audit-timeline.tsx`                     | Integrar a consulta de auditoria com filtros e projeção autorizada.                                                                           |

Os arquivos de cadastro ficam em
`apps/web/src/features/registration/presentation/`; os de projetos, em
`apps/web/src/features/projects/presentation/`.

## Fluxos sem interface completa

Esses fluxos podem ser páginas, abas ou diálogos conforme o design existente;
cada linha não exige uma nova rota isolada.

| Área                           | Fluxos que faltam                                                                                                                                         | Situação do backend                                                |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| CAD — Pessoas e composição     | Criar/editar pessoa; vincular existente; titularidade; transferência, correção e encerramento de vínculo, com data e motivo.                              | API entregue.                                                      |
| CAD — Duplicidades e qualidade | Analisar candidatos antes do cadastro; consultar/tratar ocorrências; prévia e confirmação da unificação de pessoas/famílias com conflitos e motivo.       | API entregue; geração automática de `MISSING_DATA` ainda pendente. |
| ATV — Gestão                   | Criar, editar e encerrar projetos/atividades; cadastrar, corrigir e encerrar inscrições, preservando o histórico.                                         | API entregue.                                                      |
| FRQ — Encontros e frequência   | Lista/detalhe/criação de encontros; chamada parcial e avulsa; correção/cancelamento com motivo; consulta de frequência e declaração de cobertura.         | API entregue.                                                      |
| FIC — Ficha social             | Consultar/publicar versões e dados por membro; comparar a composição da versão; registrar ciência; selecionar campos e configurar as decisões permitidas. | API entregue; campos sensíveis dependem das decisões aplicáveis.   |
| APT — Aptidão                  | Configurar políticas versionadas; prévia e avaliação familiar; mostrar Pendente/Apta/Não apta, período, política, membro e evidências.                    | API entregue, sem parâmetros presumidos.                           |
| ACS — Administração            | Listar/criar/editar contas; atribuir perfis; ativar/desativar; reset administrativo de senha.                                                             | API entregue.                                                      |
| AUD — Consulta                 | Consulta transversal com filtros, autor, data do fato/lançamento, motivo e valores anterior/novo conforme autorização.                                    | Auditoria dos módulos entregues disponível.                        |
| REL — Relatórios               | Consultas de alcance, frequência, aptidão, históricos e qualidade, com período, filtros, unidades e registros componentes.                                | UI e API específica ainda pendentes.                               |

## Ordem sugerida de integração

1. Concluir a base ACS e validar a execução local.
2. Conectar lista/busca de famílias, perfil familiar, membros e perfil individual.
3. Conectar criação/edição familiar e completar cadastro individual/composição.
4. Conectar projetos, detalhe de atividade e inscrições; completar sua gestão.
5. Entregar encontros/chamada/frequência, ficha social e aptidão.
6. Completar administração, duplicidades/unificação e consulta de auditoria.
7. Integrar REL quando os contratos de backend forem entregues.

Atendimentos realizados, estoque, entregas, Bazar e migração não são telas
pendentes deste MVP. CSV/PDF e notificações não entram nesta lista de entregas
obrigatórias. A ajuda e o sino do protótipo não comprovam um serviço de
notificações.
