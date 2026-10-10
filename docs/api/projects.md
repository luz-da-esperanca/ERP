# Referência HTTP de projetos, atividades e inscrições

Esta referência descreve as **19 rotas de ATV implementadas no backend**. Leia primeiro as regras de sessão, origem, envelopes e idempotência no [guia comum](README.md). Para um fluxo de integração, consulte [Como integrar ATV](integrating-projects.md). A fonte funcional é [SPEC-ATV](../specs/04-projects-activities.md).

Prefixo de todas as rotas: `/api/v1`. Schemas e tipos públicos: [projects-api.ts](../../packages/contracts/src/projects-api.ts), importados por `@erp/contracts/projects-api`. `@erp/contracts/projects` continua sendo o contrato do protótipo em memória; seus payloads não substituem os contratos HTTP.

## Permissões

| Operação                                                                  | Capacidade exigida                         |
| ------------------------------------------------------------------------- | ------------------------------------------ |
| Todas as consultas de ATV                                                 | `projects.read`                            |
| Criar/editar catálogos, projetos e atividades; encerrar projeto/atividade | `projects.write`                           |
| Criar/corrigir/encerrar inscrição                                         | `attendance.write` **ou** `projects.write` |
| Consultar auditoria de ATV                                                | `audit.read` **e** `projects.read`         |

Coordenação lê e escreve todo ATV. Assistência social lê. Responsável por atividade lê e altera inscrições; não administra catálogos/projetos/atividades. Administrador isolado não acessa ATV. Atribuir `responsibleId` não altera os perfis da conta. A autorização é revalidada sob bloqueio do autor antes dos efeitos e também antes de replay.

Todas as escritas exigem `Idempotency-Key` UUID, `Content-Type: application/json`, origem permitida e `X-ERP-Request: 1`. IDs, autoria, timestamps, situação e revisão de saída são definidos no servidor. Não há DELETE, reabertura ou suspensão.

## DTOs

| DTO                              | Campos                                                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `InstituteDto`, `ServiceTypeDto` | `id`, `code`, `name`, `active`, `revision`                                                                                |
| `ProjectDto`                     | `id`, `name`, `instituteId`, `description`, `startsOn`, `endsOn`, `status`, `closedAt`, metadados                         |
| `ActivityDto`                    | `id`, `projectId`, `name`, `nature`, `serviceTypeId`, `plannedSchedule`, `responsibleId`, `status`, `closedAt`, metadados |
| `EnrollmentDto`                  | `id`, `activityId`, `personId`, `validFrom`, `validUntil`, `supersededById`, metadados                                    |

Metadados: `revision`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`. Autores são IDs de contas, não pessoas assistidas. `status` é `ACTIVE` ou `CLOSED`; `nature`, `PERIODIC` ou `ONE_OFF`. Campos opcionais desconhecidos são `null`.

Datas do projeto são civis (`YYYY-MM-DD`), inclusivas quando conhecidas. Instantes têm offset obrigatório e são normalizados em UTC com precisão de milissegundos. Inscrição usa `[validFrom, validUntil)`: o início inclui, o fim exclui; `null` representa fim aberto. O fuso civil usado para verificar os limites do projeto é `APP_TIMEZONE`.

Nome: 1–200 caracteres após trim. Descrição: até 4.000; horário previsto: até 500; motivo: 1–1.000. Texto opcional vazio, inclusive após trim, vira `null`. Em PATCH, omissão preserva; `null` remove somente campos opcionais. PATCH sem alteração de campos é inválido; reenviar valores iguais é um no-op válido. Chaves desconhecidas são rejeitadas.

## Catálogos

As migrations criam seis institutos, com códigos `CHILD`, `YOUTH`, `EDUCATION_FAMILY`, `CHARITY`, `COMMUNICATION`, `MEDIUMSHIP`. Descubra seus IDs pela API: os UUIDs variam entre bancos. A revisão inicial vem da migration; ela não inventa um operador ou evento de auditoria. Essa revisão permanece recuperável para replay de no-op, mesmo após renomeação.

Tipos pontuais começam **vazios** e são cadastrados pela coordenação. Código: 1–40 caracteres, iniciando com letra maiúscula, seguido de letras maiúsculas, números ou `_`; único, imutável e não reutilizado após inativação. Instituto e tipo inativos continuam disponíveis nas consultas e no histórico; não podem ser selecionados em nova associação.

| Método / caminho                 | Entrada                                          | Saída                           |
| -------------------------------- | ------------------------------------------------ | ------------------------------- |
| GET `/institutes`                | `active?`, `page?`, `pageSize?`                  | Página de `InstituteDto`        |
| PATCH `/institutes/:instituteId` | `expectedRevision`, `name?`, `active?`, `reason` | `{ data: InstituteDto }`        |
| GET `/service-types`             | `active?`, `page?`, `pageSize?`                  | Página de `ServiceTypeDto`      |
| POST `/service-types`            | `code`, `name`                                   | 201, `{ data: ServiceTypeDto }` |
| PATCH `/service-types/:typeId`   | `expectedRevision`, `name?`, `active?`, `reason` | `{ data: ServiceTypeDto }`      |

`active` na query aceita exatamente `true` ou `false`; ausência inclui ambos. Ordenação: nome crescente, depois ID. Paginação começa em 1, padrão 20, máximo 100.

```json
{ "code": "HOME_VISIT", "name": "Visita domiciliar" }
```

Cadastrar esse tipo não registra uma visita realizada nem aprova seu uso institucional. Não existe rota para criar novos institutos neste recorte.

## Projetos

| Método / caminho                    | Entrada                                                       | Saída                                            |
| ----------------------------------- | ------------------------------------------------------------- | ------------------------------------------------ |
| GET `/projects`                     | `q?`, `instituteId?`, `status?`, paginação                    | Página de `ProjectDto`                           |
| POST `/projects`                    | `name`, `instituteId`, `description?`, `startsOn?`, `endsOn?` | 201, `{ data: ProjectDto }`                      |
| GET `/projects/:projectId`          | Sem filtros                                                   | `{ data: { project, activities } }`              |
| PATCH `/projects/:projectId`        | `expectedRevision`, campos cadastrais opcionais               | `{ data: ProjectDto }`                           |
| POST `/projects/:projectId/closure` | `expectedRevision`, `effectiveAt`, `reason`                   | `{ data: { project, activities, enrollments } }` |

Projeto novo exige um instituto existente e ativo. Renomear um projeto cujo instituto foi inativado preserva a associação; mudar o instituto exige seleção ativa. Quando ambas as datas são conhecidas, `startsOn <= endsOn`.

`q` busca trecho do nome sem distinguir caixa/acentos, de 2–200 caracteres. Ordenação: nome, depois ID. O detalhe lista as atividades, incluindo encerradas, na mesma ordenação; não inclui participantes ou frequência.

```json
{
  "name": "Oficinas de demonstração",
  "instituteId": "00000000-0000-4000-8000-000000000001",
  "description": null,
  "startsOn": "2026-01-01",
  "endsOn": null
}
```

Alterar a vigência valida inscrições efetivas e encontros concluídos existentes. Se a mudança invalidar seus limites, retorna `409 DOMAIN_CONFLICT`, regra `PROJECT_PERIOD_CONFLICT`, com os IDs das inscrições/encontros afetados. Nenhum fato é deslocado automaticamente.

## Atividades

| Método / caminho                       | Entrada                                                                                             | Saída                                                     |
| -------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| GET `/activities`                      | `projectId?`, `nature?`, `status?`, `q?`, paginação                                                 | Página de `ActivityDto`                                   |
| POST `/projects/:projectId/activities` | `expectedProjectRevision`, `name`, `nature`, `serviceTypeId?`, `plannedSchedule?`, `responsibleId?` | 201, `{ data: ActivityDto }`                              |
| GET `/activities/:activityId`          | `asOf?`                                                                                             | `{ data: { activity, project, asOf, participantCount } }` |
| PATCH `/activities/:activityId`        | `expectedRevision`, campos cadastrais opcionais e `projectId?`                                      | `{ data: ActivityDto }`                                   |
| POST `/activities/:activityId/closure` | `expectedRevision`, `effectiveAt`, `reason`                                                         | `{ data: { activity, enrollments } }`                     |

Uma atividade nova pertence a projeto ativo. `PERIODIC` exige `serviceTypeId=null`; `ONE_OFF` exige tipo existente e ativo. Horário é texto, sem gerar agenda. `responsibleId` pode ser desconhecido; quando informado, referencia conta existente, sem criar cadastro assistencial ou conceder perfil. Desativar essa conta preserva a referência histórica.

```json
{
  "expectedProjectRevision": 1,
  "name": "Oficina de demonstração",
  "nature": "PERIODIC",
  "serviceTypeId": null,
  "plannedSchedule": "Terças, às 14h",
  "responsibleId": null
}
```

Em PATCH, trocar de periódica para pontual exige enviar também o tipo; trocar para periódica exige remover o tipo com `null`. Natureza e projeto só mudam em atividade ativa sem nenhuma inscrição ou encontro, incluindo inscrições encerradas/supersedidas e encontros cancelados. Uma atividade com histórico retorna `409 DOMAIN_CONFLICT`, com `details.rule=ACTIVITY_HAS_HISTORY`. Para novo contexto, crie outra atividade.

O detalhe usa `asOf` informado ou o instante atual do servidor. `participantCount` conta pessoas distintas com inscrição efetiva nessa referência. Não é presença, frequência ou aptidão. Inscrição aberta permanece aberta até comando explícito de encerramento; datas civis do projeto não geram encerramento automático. Listas ordenam por nome e ID. A consulta de inscrições possui paginação própria.

## Inscrições

| Método / caminho                           | Entrada                                                             | Saída                              |
| ------------------------------------------ | ------------------------------------------------------------------- | ---------------------------------- |
| GET `/activities/:activityId/enrollments`  | `asOf?`, `personId?`, paginação                                     | Página de `{ enrollment, person }` |
| POST `/activities/:activityId/enrollments` | `expectedActivityRevision`, `personId`, `validFrom?`, `validUntil?` | 201, `{ data: EnrollmentDto }`     |
| PATCH `/enrollments/:enrollmentId`         | `expectedRevision`, `validFrom?`, `validUntil?`, `reason`           | `{ data: EnrollmentDto }`          |
| POST `/enrollments/:enrollmentId/closure`  | `expectedRevision`, `validUntil`, `reason`                          | `{ data: EnrollmentDto }`          |

```json
{
  "expectedActivityRevision": 1,
  "personId": "00000000-0000-4000-8000-000000000002",
  "validFrom": "2026-01-01T10:00:00-03:00",
  "validUntil": null
}
```

Somente atividades periódicas aceitam inscrição. A pessoa precisa estar cadastrada e ter vínculo familiar conhecido no início do intervalo. Início futuro é rejeitado. Fim conhecido deve ser estritamente posterior ao início; deve respeitar o limite civil conhecido do projeto. Para atividade/projeto encerrado, o intervalo tardio precisa começar antes do corte e terminar até o corte; fim aberto é rejeitado nesse caso.

Mesmo par pessoa/atividade não aceita intervalos efetivos sobrepostos. Reinscrição adjacente é permitida e cria outro registro. Correção preserva o ID e grava antes/depois na auditoria. Mudar o início revalida o vínculo familiar. Encerramento exige fim não futuro e não amplia um intervalo já encerrado; ampliação exige correção explícita, respeitando os demais limites.

Na criação, `validFrom` omitido equivale ao instante do servidor.

Com `asOf`, a lista seleciona inscrições vigentes naquele instante. Sem `asOf`, lista todos os intervalos efetivos, inclusive encerrados; exclui supersedidos. Ordenação: `validFrom`, depois ID. A revisão de cada inscrição representa seu estado atual; para valores anteriores, consulte a auditoria.

A projeção de pessoa é sempre mínima, inclusive para coordenação:

```json
{
  "id": "00000000-0000-4000-8000-000000000002",
  "name": "Pessoa sintética",
  "family": { "id": "00000000-0000-4000-8000-000000000003", "code": "1" }
}
```

Família é calculada na referência `asOf`; sem esse filtro, no início da inscrição. Pode ser `null`. Nome é o cadastro atual da pessoa, não uma reconstrução de seu nome naquela data. CPF, nascimento, endereço, tamanhos e ficha social não são retornados. Para dados completos, consulte CAD com a permissão correspondente.

## Revisões, replay e encerramento

| Alteração efetiva                 | Revisões incrementadas                                             |
| --------------------------------- | ------------------------------------------------------------------ |
| Editar catálogo ou projeto        | Registro alterado                                                  |
| Criar atividade                   | Nova atividade em 1; projeto incrementa                            |
| Editar atividade                  | Atividade; ao mudar de projeto, incrementa também origem e destino |
| Criar/corrigir/encerrar inscrição | Inscrição e atividade; inscrição nova começa em 1                  |
| Encerrar atividade                | Atividade e inscrições truncadas                                   |
| Encerrar projeto                  | Projeto, atividades ainda ativas e inscrições truncadas            |

Renomear/editar atividade e alterar inscrição não incrementam a revisão do projeto. A transação bloqueia seu contexto e revalida os fatos atuais para alterações de vigência e encerramento. No-op preserva revisões e não gera auditoria; mantém a referência idempotente. Após escrita, recarregue os agregados afetados para obter as revisões atuais.

Encerramento é atômico. `effectiveAt` não pode estar no futuro. Antes de mudar qualquer registro, valida o conjunto afetado: início de inscrição ou encontro concluído a partir do corte, ou atividade já encerrada depois do novo corte do projeto, gera `409 DOMAIN_CONFLICT`, com `details.rule=CLOSURE_CONFLICT` e IDs para revisão. Nenhum intervalo é invertido nem fato eliminado para permitir o corte.

Trunca somente intervalos efetivos com início anterior e fim aberto/posterior ao corte. Intervalos já encerrados permanecem iguais. Projeto encerra suas atividades ativas; atividades já encerradas mantêm data e revisão. Arrays `activities`/`enrollments` na resposta contêm **somente registros alterados**. Repetir o mesmo corte com nova intenção e revisão atual é no-op, com arrays vazios; outro corte de registro encerrado é rejeitado.

Replay com mesma rota, autor, corpo normalizado e chave retorna exatamente as revisões da resposta original, inclusive arrays de cascata, mesmo após novos lançamentos históricos. Outra intenção/autor/alvo com a mesma chave produz `409 IDEMPOTENCY_CONFLICT`. Falha de auditoria desfaz alterações, revisões e operação, permitindo repetir a mesma chave.

## Erros específicos

| HTTP / código                 | `details.rule`                                                                         | Tratamento                                                                 |
| ----------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 400 `VALIDATION_ERROR`        | —                                                                                      | Corrigir formato, UUID, campo desconhecido ou PATCH vazio                  |
| 409 `REVISION_CONFLICT`       | —                                                                                      | Reconsultar; `details.currentRevision` informa a revisão atual             |
| 409 `DOMAIN_CONFLICT`         | `ENROLLMENT_OVERLAP`                                                                   | Revisar os intervalos identificados em `details.ids`                       |
| 409 `DOMAIN_CONFLICT`         | `ACTIVITY_HAS_HISTORY`                                                                 | Preservar natureza/projeto; criar outra atividade                          |
| 409 `DOMAIN_CONFLICT`         | `PROJECT_PERIOD_CONFLICT`, `CLOSURE_CONFLICT`                                          | Revisar corte/vigência ou corrigir explicitamente os registros indicados   |
| 409 `DOMAIN_CONFLICT`         | `CATALOG_CODE_EXISTS`                                                                  | Escolher outro código ou recuperar o tipo já cadastrado                    |
| 422 `BUSINESS_RULE_VIOLATION` | `INACTIVE_CATALOG`                                                                     | Selecionar catálogo ativo                                                  |
| 422 `BUSINESS_RULE_VIOLATION` | `INVALID_ACTIVITY_TYPE`                                                                | Conferir natureza/tipo e operação permitida                                |
| 422 `BUSINESS_RULE_VIOLATION` | `INVALID_PROJECT_PERIOD`, `INVALID_ENROLLMENT_INTERVAL`, `ENROLLMENT_OUTSIDE_VALIDITY` | Corrigir datas e limites                                                   |
| 422 `BUSINESS_RULE_VIOLATION` | `PERSON_WITHOUT_MEMBERSHIP`                                                            | Regularizar o vínculo em CAD na data inicial                               |
| 422 `BUSINESS_RULE_VIOLATION` | `FUTURE_EFFECTIVE_DATE`                                                                | Informar início/corte não futuro                                           |
| 422 `BUSINESS_RULE_VIOLATION` | `RECORD_CLOSED`                                                                        | Preservar encerramento; usar correção histórica permitida ou novo cadastro |

401, 403, 404, 415, 422 por habilitação e 503 seguem o [guia comum](README.md). IDs de conflitos não incluem campos pessoais restritos. Nenhuma mensagem técnica deve ser exibida como texto institucional sem tradução.

## Auditoria e integração entre módulos

`entityType` aceita `Institute`, `ServiceType`, `Project`, `Activity`, `ParticipantEnrollment`. Classificação `PROJECTS`; ações `CREATE`, `UPDATE`, `CLOSE`, `CORRECT`. Escritas compostas correlacionam eventos por `operationId`. Inscrições registram início/corte em `occurredAt`; `recordedAt` permanece a data do servidor. Criações cadastrais sem fato temporal usam `occurredAt=null`.

ATV usa pessoas e vínculos persistentes de CAD. Não cria pessoas, presenças, encontros ou avaliação de aptidão. Não acessa Redis como fonte de negócios. A API está composta em `src/runtime.ts`, com regras puras em `domain`, orquestração em `application`, HTTP em `presentation` e Prisma em `infra` da feature `projects`.

FRQ compartilha os bloqueios de projeto/atividade com ATV. Histórico de encontro, inclusive cancelado, impede troca de natureza/projeto; encontros concluídos também limitam vigência/corte. Criar, corrigir ou encerrar inscrição invalida cobertura no trecho civil cuja pertinência mudou, na mesma transação. Marcação avulsa permanece factual mesmo sem inscrição: remover inscrição não apaga presença nem muda seu contexto. As corridas entre criação de encontro e encerramento estão testadas com PostgreSQL. Consulte a [referência FRQ](attendance.md) para chamada, frequência e cobertura. Unificação de CAD ainda deverá reconciliar inscrições por pessoa canônica.

## Validação e cobertura

```bash
pnpm test test/features/projects packages/contracts/test/projects-api.test.ts
TEST_DATABASE_URL=postgresql://erp:erp_test_only@localhost:55432/erp_test \
TEST_REDIS_URL=redis://localhost:56379 \
pnpm test:integration test/features/projects
```

Prepare os serviços exclusivos de teste conforme o [README](../../README.md#validar). A suíte usa migrations reais e dados sintéticos. Não execute com banco operacional.

| Aceite ATV | Evidência nesta etapa backend                                                                   |
| ---------- | ----------------------------------------------------------------------------------------------- |
| AC01/09/13 | Catálogos, inativação, associação histórica, código imutável e instituto obrigatório            |
| AC02/03    | Cadastro periódico/pontual, inscrição independente e rejeição de inscrição pontual              |
| AC04/05    | Histórico de inscrição bloqueia natureza/projeto; corrida natureza versus inscrição             |
| AC06/11/12 | Cascata, corte conflitante, preservação de encerramentos anteriores e rollback de auditoria     |
| AC08       | Intervalos adjacentes/sobrepostos, correção e fechamento com histórico                          |
| AC07/10    | Limites e lançamentos tardios de inscrição e encontros; cortes conflitantes verificados com FRQ |

Os testes também verificam projeção mínima, revogação do autor, schemas, no-op, replay e concorrência por chave. As verificações de histórico, cortes e corrida com encontro ficam em [test/features/attendance](../../test/features/attendance). A UI permanece pendente; esta entrega não declara o MVP completo nem libera dados reais.
