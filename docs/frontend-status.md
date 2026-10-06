# Telas e integrações do frontend

Revisão em 06/10/2026, limitada ao [MVP vigente](specs/README.md).
O inventário considera rotas, componentes de apresentação e adaptadores; a
existência de um gateway em memória não comprova uma tela nem integração HTTP.

## Entrada conectada à API

A entrada principal usa o contrato HTTP de ACS: login, restauração da sessão
por cookie, logout confirmado e troca de senha, incluindo a obrigatória no
primeiro acesso. As capacidades são recebidas do servidor. Erros de dependência
não são tratados como sessão anônima, e uma resposta atrasada não restaura o
acesso após logout ou resposta 401.

CAD está conectado para consulta, busca global, cadastro/edição familiar e
individual, composição por data e histórico cadastral da família. ATV está
conectado para consulta e gestão de projetos, atividades e inscrições. A área de
qualidade cadastral preserva a revisão e unificação de registros; FRQ preserva
lista/detalhe/criação de encontros, chamada, correções, cancelamento, consulta
de frequência e declaração de cobertura. Os
formulários preservam revisões e a mesma chave/corpo após perda de resposta;
novos cadastros consultam candidatos e exigem motivo e confirmação de distinção.
O backend repete a análise na transação. Busca global usa consultas autorizadas
após dois caracteres e diálogo nativo com retorno de foco. A lista familiar
usa paginação e totais do servidor. A aptidão aparece como “Não consultada”,
sem presumir ausência de política. O início oferece acesso pelo menu, sem totais.
Adaptadores em memória continuam restritos ao protótipo e seus testes.

## Interfaces existentes e estado da integração

| Tela ou fluxo                              | Evidência                                        | Trabalho restante                                                                                                 |
| ------------------------------------------ | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Início                                     | `features/home/presentation/dashboard-page.tsx`  | Consultas autorizadas, totais com fonte e atividade recente pela API.                                             |
| Lista e busca de famílias                  | `connected-families-page.tsx`, `search-page.tsx` | HTTP entregue; falta integrar a avaliação de aptidão.                                                             |
| Criação, edição e perfil familiar          | `family-page.tsx`, `family-form.tsx`             | HTTP entregue com revisões, análise de duplicidades e idempotência.                                               |
| Membros da família                         | `FamilyMembersPage` em `family-page.tsx`         | Consulta HTTP e inclusão de nova pessoa entregues; faltam ações sobre vínculos existentes.                        |
| Perfil e cadastro individual               | `person-page.tsx`, `person-form-page.tsx`        | Dados, vínculos históricos e criação/edição HTTP entregues; falta edição do perfil de tamanhos.                   |
| Lista de projetos e atividades             | `projects-page.tsx`, `project-group.tsx`         | Consulta, criação, edição e encerramento HTTP entregues.                                                          |
| Detalhe de atividade e inscrições vigentes | `activity-page.tsx`, `enrollment-list.tsx`       | Consulta HTTP com projeção mínima, responsável e gestão de inscrições entregues; acesso aos encontros disponível. |
| Histórico cadastral familiar               | `family-audit-timeline.tsx`                      | Auditoria HTTP filtrada por `Family` e ID entregue; consulta transversal e histórico consolidado pendentes.       |
| Duplicidades e qualidade cadastral         | `data-quality-page.tsx`, `duplicate-review.tsx`  | Consulta/tratamento de ocorrências, prévia e confirmação de unificação HTTP entregues.                            |
| Encontros e frequência                     | `attendance-page.tsx`, `session-page.tsx`        | Lista/detalhe/criação, chamada, correções/cancelamento, frequência e cobertura HTTP entregues.                    |

Os arquivos de cadastro ficam em
`apps/web/src/features/registration/presentation/`; os de projetos, em
`apps/web/src/features/projects/presentation/`.

## Fluxos sem interface completa

Esses fluxos podem ser páginas, abas ou diálogos conforme o design existente;
cada linha não exige uma nova rota isolada.

| Área                       | Fluxos que faltam                                                                                                                                         | Situação do backend                                              |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| CAD — Pessoas e composição | Vincular existente; titularidade; transferência, correção e encerramento de vínculo, com data e motivo; perfil de tamanhos.                               | API entregue.                                                    |
| FIC — Ficha social         | Consultar/publicar versões e dados por membro; comparar a composição da versão; registrar ciência; selecionar campos e configurar as decisões permitidas. | API entregue; campos sensíveis dependem das decisões aplicáveis. |
| APT — Aptidão              | Configurar políticas versionadas; prévia e avaliação familiar; mostrar Pendente/Apta/Não apta, período, política, membro e evidências.                    | API entregue, sem parâmetros presumidos.                         |
| ACS — Administração        | Listar/criar/editar contas; atribuir perfis; ativar/desativar; reset administrativo de senha.                                                             | API entregue.                                                    |
| AUD — Consulta             | Consulta transversal com filtros, autor, data do fato/lançamento, motivo e valores anterior/novo conforme autorização.                                    | Auditoria dos módulos entregues disponível.                      |
| REL — Relatórios           | Consultas de alcance, frequência, aptidão, históricos e qualidade, com período, filtros, unidades e registros componentes.                                | API entregue; UI pendente.                                       |

## Ordem sugerida de integração

1. Integrar ficha social e aptidão.
2. Completar ações de composição, tamanhos, administração e auditoria transversal.
3. Integrar REL e os totais/atividade recente do início.

Atendimentos realizados, estoque, entregas, Bazar e migração não são telas
pendentes deste MVP. CSV/PDF e notificações não entram nesta lista de entregas
obrigatórias. A ajuda e o sino do protótipo não comprovam um serviço de
notificações.
