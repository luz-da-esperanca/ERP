# SPEC-ATV — Institutos, projetos, atividades e participantes

Versão 1.0 · Dependências: [CORE](00-foundation.md), [CAD](02-registration.md), [ACS](01-access.md) e [AUD](08-audit.md). Fontes: PRD 1.1 OBJ-03, CAP-03, RN-04/08/09 e DEC-04; ERS RF-ATV-01–08, LAC-04, RNF-MAN-01; modelagem D-01/D-02/D-03. Turmas, vagas, espera e agenda RF-ATV-09 ficam fora.

**Implementação backend em 05/10/2026:** catálogos, projetos, atividades, inscrições temporais, correções, encerramentos e auditoria estão entregues. Contratos concretos, limites, revisões e comandos estão na [referência HTTP](../api/projects.md); o [guia de integração](../api/integrating-projects.md) orienta a frente de interface. UI e verificações sobre encontros/marcações/cobertura permanecem para FRQ e frontend, conforme o índice. Esta etapa não declara os cenários de encontro AC07/AC10 concluídos.

Derivações técnicas desta entrega: códigos de tipos usam até 40 caracteres em `A-Z`, `0-9`, `_`, iniciando por letra; tipos começam vazios e são administrados pela coordenação; inscrição tardia em contexto encerrado informa fim até o corte; correção mantém ID e antes/depois na auditoria. Datas civis declaradas não geram encerramento automático. A projeção de participantes em ATV é sempre mínima; sem `asOf`, a lista inclui intervalos efetivos históricos e interpreta a família no início de cada inscrição. As revisões adicionais dos agregados são especificadas na referência HTTP. Essas escolhas concretizam a integração técnica sem aprovar novas políticas institucionais.

## 1. Resultado e modelo

Organizar atividades em projetos e manter uma lista temporal simples de participantes de atividades periódicas. Cadastros pontuais representam sua natureza/tipo, sem registrar atendimento realizado.

| Entidade                | Campos                                                                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `Institute`             | `id`, `code`, `name`, `active`, `revision`; código único                                                                                |
| `Project`               | `id`, `name`, `description?`, `instituteId`, `startsOn?`, `endsOn?`, `status`, `closedAt?`, `revision`, autoria                         |
| `Activity`              | `id`, `projectId`, `name`, `nature`, `serviceTypeId?`, `plannedSchedule?`, `responsibleId?`, `status`, `closedAt?`, `revision`, autoria |
| `ServiceType`           | `id`, `code`, `name`, `active`, `revision`; código único, catálogo sem enum fechado                                                     |
| `ParticipantEnrollment` | `id`, `activityId`, `personId`, `validFrom`, `validUntil?`, `revision`, `supersededById?`, autoria                                      |

`status`: `ACTIVE` ou `CLOSED`. `nature`: `PERIODIC` ou `ONE_OFF`. Nome e descrição seguem CORE; `plannedSchedule` é texto até 500, não um gerador de agenda. Responsável aponta a conta do operador que assume a atividade, sem criar pessoa assistida para representá-lo. Pode ser desconhecido até designação; para registrar encontro, indicar executor/responsável conhecido conforme SPEC-FRQ.

Um projeto pertence a exatamente um instituto, e atividades periódicas mantêm lista simples de participantes, conforme a decisão do MVP [MVP-D05](README.md). `instituteId` é obrigatório e referencia instituto existente; novo projeto não seleciona instituto inativo. Essa adoção concretiza o tratamento provisório da ERS; ratificação institucional de DEC-04/LAC-04 permanece separada.

## 2. Catálogos iniciais

RF-ATV-01 exige manter os seis institutos: Criança (`CHILD`), Jovem (`YOUTH`), Esclarecimento e Família (`EDUCATION_FAMILY`), Caridade (`CHARITY`), Divulgação (`COMMUNICATION`) e Mediunidade (`MEDIUMSHIP`). A Escola Espírita não é incluída por associação ao catálogo. Coordenação pode corrigir nomes/ativo, com revisão/auditoria; código não muda nem é reutilizado. Inativação não apaga projetos históricos.

Tipos pontuais candidatos: doação de itens, médico, psicológico, fisioterapia, visita domiciliar e outro cadastrado. A classificação visita segue LAC-13; sem aprovação real não representa ocorrência de visita. `ServiceType` pode ser administrado pela coordenação para cadastrar novos tipos; código técnico estável, label pt-BR. Tipo inativo permanece legível em atividade antiga e não é selecionado em novo cadastro.

`PERIODIC` exige `serviceTypeId=null`. `ONE_OFF` requer tipo selecionado, e não aceita inscrição periódica/encontro. Uma atividade pontual cadastrada não gera frequência, aptidão ou alcance de pessoas atendidas neste MVP.

## 3. Estados, vigência e integridade

- Criar projeto/atividade em `ACTIVE`. Datas civis do projeto, quando ambas conhecidas, obedecem `startsOn <= endsOn`. A vigência declarada limita fatos quando conhecida; data ausente não é preenchida com data fictícia.
- Atividade pertence a um projeto; depois de qualquer registro vinculado, o projeto da atividade não é trocado para transportar histórico. Criar outra atividade para novo contexto.
- Alterar natureza somente se não existir inscrição, encontro, marcação ou outro fato vinculado, inclusive cancelado/supersedido. A checagem é transacional, com revisão/bloqueio contra registro concorrente.
- Encerrar exige motivo e `effectiveAt` não futuro; preserva registros. Encerrar projeto encerra somente suas atividades ainda ativas na data escolhida, auditando cada mudança. Atividades já encerradas conservam `closedAt` e seus intervalos históricos; não há ampliação silenciosa da vigência.
- Atividade encerrada admite consulta e correção de fatos anteriores. Novo lançamento tardio só é aceito se `occurredAt < closedAt` e dentro da vigência conhecida do projeto; o lançamento atual permanece identificado.
- Não há reabertura, suspensão, geração automática de encontros nem cancelamento em cascata de fatos realizados no MVP. Mudar datas do projeto não pode tornar fatos existentes inválidos sem reconciliação explícita; retorna conflito com os IDs afetados.

Inscrição exige pessoa cadastrada com vínculo familiar conhecido no instante inicial; vale em `[validFrom, validUntil)`. Mesmo par canônico pessoa/atividade não pode ter inscrições efetivas sobrepostas. Reinscrição posterior é novo intervalo. Encerrar inscrição não exclui encontros/presenças passados nem cria ausência futura; ao encerrar atividade/projeto, intervalos de inscrição vigentes são encerrados no mesmo instante, com auditoria.

Antes de encerrar, validar transacionalmente encontros válidos e inscrições efetivas de todo o conjunto afetado. Encontro com `occurredAt >= effectiveAt`, inscrição com início a partir do corte, ou atividade já encerrada depois do novo corte do projeto produz `409 DOMAIN_CONFLICT` com IDs autorizados para revisar data ou corrigir o registro pertinente. Truncar somente inscrições com `validFrom < effectiveAt` e fim aberto/posterior; intervalos já encerrados permanecem iguais. Não inverter intervalos, apagar ou cancelar fatos automaticamente para permitir o encerramento. O corte exclusivo é o mesmo usado para novos lançamentos tardios.

Uma visita avulsa na chamada não cria inscrição automaticamente. Número de participantes em `asOf` conta pessoas distintas inscritas naquele instante, diferente de presentes em um encontro. Pessoas sem vínculo atual podem manter histórico de participação anterior.

## 4. API e interface

| Método / caminho                           | Entrada / resultado                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `GET /institutes`                          | `active?`, paginação; catálogo conforme perfil                                                               |
| `PATCH /institutes/:instituteId`           | `expectedRevision`, nome/ativo, motivo                                                                       |
| `GET /service-types`                       | `active?`, paginação                                                                                         |
| `POST /service-types`                      | `code`, nome; coordenação                                                                                    |
| `PATCH /service-types/:typeId`             | Revisão, nome/ativo, motivo; código imutável                                                                 |
| `GET /projects`                            | `q?`, `instituteId?`, `status?`, paginação                                                                   |
| `POST /projects`                           | Nome, instituto, descrição/datas opcionais                                                                   |
| `GET /projects/:projectId`                 | Cadastro, atividades e situação                                                                              |
| `PATCH /projects/:projectId`               | Revisão e dados cadastrais; valida fatos ao mudar vigência                                                   |
| `POST /projects/:projectId/closure`        | Revisão, `effectiveAt`, motivo; valida fatos posteriores e encerra atividades ativas/inscrições atomicamente |
| `GET /activities`                          | `projectId?`, `nature?`, `status?`, `q?`, paginação                                                          |
| `POST /projects/:projectId/activities`     | Revisão do projeto, nome, natureza, tipo/horário/responsável conforme natureza                               |
| `GET /activities/:activityId`              | Cadastro e projeção autorizada                                                                               |
| `PATCH /activities/:activityId`            | Revisão, campos permitidos; natureza/projeto obedecem bloqueio de histórico                                  |
| `POST /activities/:activityId/closure`     | Revisão, `effectiveAt`, motivo; valida encontros/intervalos posteriores ao corte                             |
| `GET /activities/:activityId/enrollments`  | `asOf?`, `personId?`, paginação                                                                              |
| `POST /activities/:activityId/enrollments` | Pessoa, `validFrom`, `validUntil?`, revisão da atividade; natureza periódica                                 |
| `PATCH /enrollments/:enrollmentId`         | Revisão, correção de datas, motivo; conflitos com chamada/cobertura são expostos                             |
| `POST /enrollments/:enrollmentId/closure`  | Revisão, `validUntil`, motivo                                                                                |

Todas as escritas de catálogo/projeto requerem `projects.write`; inscrições requerem `attendance.write` ou `projects.write`. Leituras requerem `projects.read`, e retorno de pessoas usa projeção mínima ou cadastro conforme autorização. `responsibleId` não equivale a concessão de perfil na conta.

`/projects`, `/projects/:id` e `/activities/:id` mostram instituto, natureza, status, datas, participantes em data escolhida e encontros. Cadastro pontual exibe tipo e informa que registros de realização pertencem a outra fase. Encerramento apresenta efeitos sobre atividades/inscrições e mantém acesso ao histórico. Somente periódicas oferecem “Registrar encontro”.

## 5. Critérios de aceite

| ID       | Cenário                                                                                                                           |
| -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| ATV-AC01 | Os seis institutos documentados aparecem, sem incluir gestão da Escola Espírita                                                   |
| ATV-AC02 | Atividade periódica pertence a projeto e aceita lista simples; inscrição não gera presença                                        |
| ATV-AC03 | Pontual exige tipo e rejeita inscrição/encontro, sem criar atendimento ou aptidão                                                 |
| ATV-AC04 | Natureza pode mudar antes de fatos; inscrição/encontro mesmo cancelado bloqueia a troca                                           |
| ATV-AC05 | Criação de registro e troca de natureza concorrentes não deixam estado incompatível                                               |
| ATV-AC06 | Projeto encerrado preserva fatos e encerra atividades/inscrições, tudo ou nada                                                    |
| ATV-AC07 | Lançamento/correção tardia de encontro anterior ao encerramento é admitido; fato posterior é rejeitado                            |
| ATV-AC08 | Reinscrição mantém dois intervalos não sobrepostos e preserva presença anterior                                                   |
| ATV-AC09 | Catálogo renomeado/inativo preserva interpretação do histórico e impede nova seleção inativa                                      |
| ATV-AC10 | Alterar vigência conflitante com fatos exige resolução; nenhuma presença é movida silenciosamente                                 |
| ATV-AC11 | Encerramento retroativo com encontro ou início de inscrição posterior conflita; não cria intervalo invertido nem cancela fato     |
| ATV-AC12 | Encerrar projeto preserva encerramento anterior de atividade; audita somente as mudanças efetivas                                 |
| ATV-AC13 | Projeto exige exatamente um instituto existente e ativo na criação; instituto inativado depois não apaga sua associação histórica |
