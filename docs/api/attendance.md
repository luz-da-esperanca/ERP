# Referência HTTP de encontros, chamada e frequência

Backend de [SPEC-FRQ](../specs/05-attendance.md). Os schemas públicos estão em [attendance-api.ts](../../packages/contracts/src/attendance-api.ts), disponíveis por `@erp/contracts/attendance-api`. Leia as convenções de sessão, cabeçalhos, envelopes e idempotência no [guia comum](README.md). O [guia de integração de FRQ](integrating-attendance.md) mostra como confirmar uma chamada.

## Rotas e autorização

Prefixo `/api/v1`. Coordenação e Responsável por Atividade têm `attendance.read` e `attendance.write`. Assistência Social e Administrador isolados não recebem essas capacidades. Perfis combinam capacidades; consulte `/auth/session`. Os dados de participantes são mínimos, sem CPF, endereço ou ficha social.

| Método / caminho                                      | Capacidade         | Resposta                                 |
| ----------------------------------------------------- | ------------------ | ---------------------------------------- |
| `GET /activities/:activityId/attendance-context`      | `attendance.read`  | 200, `AttendanceContextDto`              |
| `POST /activities/:activityId/sessions`               | `attendance.write` | 201, `{ session, attendances }`          |
| `GET /activities/:activityId/sessions`                | `attendance.read`  | 200, página de encontros                 |
| `GET /sessions/:sessionId`                            | `attendance.read`  | 200, `{ session, attendances, context }` |
| `PUT /sessions/:sessionId/attendance`                 | `attendance.write` | 200, `{ session, attendances }`          |
| `PATCH /sessions/:sessionId`                          | `attendance.write` | 200, `{ session, attendances }`          |
| `POST /attendances/:attendanceId/context-corrections` | `attendance.write` | 200, `{ session, attendances }`          |
| `POST /sessions/:sessionId/cancellation`              | `attendance.write` | 200, `{ session, attendances }`          |
| `GET /people/:personId/frequency`                     | `attendance.read`  | 200, `FrequencyResultDto`                |
| `GET /activities/:activityId/coverage`                | `attendance.read`  | 200, `CoverageViewDto`                   |
| `POST /activities/:activityId/coverage-declarations`  | `attendance.write` | 201, `CoverageDto`                       |

Todas as escritas exigem `Idempotency-Key` UUID. O autor é revalidado sob bloqueio PostgreSQL antes da alteração e do replay. Repetir a mesma intenção devolve as revisões originais de encontro, marcações ou declaração, mesmo após correções posteriores. Outra intenção, alvo ou autor com a mesma chave retorna `409 IDEMPOTENCY_CONFLICT`.

## DTOs e contexto histórico

| DTO       | Campos                                                                                                                                              |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Encontro  | `id`, `activityId`, `responsibleId`, `occurredAt`, `recordedAt`, `recordedBy`, `status`, `revision`                                                 |
| Marcação  | `id`, `sessionId`, `personId`, `familyId`, `membershipId`, `membershipRevision`, `status`, `recordedAt`, `recordedBy`, `revision`, `supersededById` |
| Cobertura | `id`, `activityId`, `periodStart`, `periodEndExclusive`, `declaredBy`, `declaredAt`, `sourceVersions`, `revision`, `invalidatedPeriods`             |

Encontro tem status `COMPLETED` ou `CANCELED`; marcação, `PRESENT` ou `ABSENT`. Linha inexistente é desconhecida. `supersededById=null` identifica uma marcação efetiva; a [unificação de identidades](identity-merges.md) usa essa estrutura para preservar a marcação duplicada sem contá-la. A unicidade PostgreSQL impede duas marcações efetivas da mesma pessoa no mesmo encontro. Encontros diferentes no mesmo dia são permitidos e contados separadamente.

`occurredAt` é o instante do fato; `recordedAt` é o lançamento pelo servidor. Instantes exigem offset e são normalizados para UTC com milissegundos. A marcação conserva família, vínculo e revisão do vínculo válidos na data do fato. Transferência posterior não muda essa atribuição; correção de status também a preserva.

O responsável do encontro aponta uma conta existente, independentemente da pessoa assistida. FRQ aceita somente atividades `PERIODIC`, fatos não futuros, dentro das datas civis do projeto e anteriores ao corte de encerramento de projeto/atividade. Registro tardio de fato anterior ao corte continua permitido.

## Prévia e confirmação

`GET /activities/:id/attendance-context` recebe:

- `occurredAt`: instante do encontro, obrigatório.
- `sessionId`: opcional; inclui encontro, revisão e marcações já existentes.
- `guestPersonIds`: opcional; UUIDs separados por vírgula ou query repetida. Inclui pessoas avulsas na seleção da prévia.

A resposta contém `activityId`, `projectId`, `occurredAt`, `expectedActivityRevision`, `expectedProjectRevision`, `session`, `rows` e `rosterFingerprint`. Cada linha contém identificação mínima, revisão da pessoa, família/código/revisão, vínculo/revisão, IDs de inscrições válidas e `attendance` ou `null`. Sem vínculo naquela data, os campos de contexto são `null`; regularize CAD antes de marcar essa pessoa. A prévia não persiste encontro, marcação, auditoria ou operação.

O servidor calcula o fingerprint SHA-256 sobre o contexto e suas fontes ordenadas. O cliente devolve esse valor, sem recalculá-lo. Inscrições, avulsos selecionados, revisões cadastrais, atividade/projeto e marcações existentes participam da comparação. Mudança concorrente exige renovar a prévia e revisar a intenção.

`POST /activities/:id/sessions` recebe:

```typescript
type CreateSessionPayload = {
  occurredAt: string;
  responsibleId: string;
  expectedActivityRevision: number;
  expectedRosterFingerprint: string;
  guestPersonIds?: string[];
  entries: {
    personId: string;
    expectedPersonRevision: number;
    familyId: string;
    expectedFamilyRevision: number;
    membershipId: string;
    expectedMembershipRevision: number;
    status: 'PRESENT' | 'ABSENT';
  }[];
};
```

Use os campos da linha escolhida na prévia. `entries` pode ser vazio ou parcial; pessoas omitidas continuam não registradas. O backend valida todas as linhas antes de gravar. Não cria inscrição para avulso. Os conjuntos `entries` e `guestPersonIds` rejeitam duplicatas, aceitam até 1.000 itens e são ordenados por pessoa na normalização HTTP.

`guestPersonIds` no corpo preserva a seleção completa da prévia, inclusive avulsos que ficaram sem marcação. O padrão é `[]`; IDs avulsos marcados também integram o contexto. Um avulso selecionado e não marcado não passa a compor o denominador nem ganha registro persistente só pela seleção.

## Alterar marcações e encontro

`PUT /sessions/:id/attendance` recebe `expectedSessionRevision`, `expectedRosterFingerprint`, `reason`, `guestPersonIds?` e `entries` não vazio. É alteração parcial, sem apagar linhas omitidas:

- Linha existente: `{ personId, expectedRevision, status }`. Preserva família, vínculo e sua revisão factual.
- Primeira marcação: `{ personId, expectedRevision: null, status, expectedPersonRevision, familyId, expectedFamilyRevision, membershipId, expectedMembershipRevision }`. Exige contexto atual da prévia, como o POST.

Uma alteração efetiva incrementa a revisão de cada linha modificada e a do encontro uma vez. Linha nova começa na revisão 1. No-op preserva revisão e auditoria. A resposta inclui a chamada do encontro; recarregue o detalhe para obter novo contexto/fingerprint antes de outra edição.

`PATCH /sessions/:id` exige `expectedSessionRevision`, `reason` e pelo menos um de `occurredAt`, `responsibleId`. Não aceita pessoa ou atividade. Se o novo horário muda participantes/vínculos históricos, consulte a prévia com `sessionId` e o novo `occurredAt`; envie `expectedRosterFingerprint` dessa prévia e `contextCorrections` para todas as marcações afetadas. Cada correção contém os campos de contexto do POST mais `expectedRevision` da marcação. Ausência de plano necessário retorna `409 SESSION_CONTEXT_RECONCILIATION_REQUIRED` em `details.rule`. Status das marcações é preservado.

`POST /attendances/:id/context-corrections` recebe `expectedSessionRevision`, `expectedRevision`, `expectedPersonRevision`, `familyId`, `expectedFamilyRevision`, `membershipId`, `expectedMembershipRevision`, `reason`. Corrige uma atribuição factual por escolha explícita de vínculo válido no encontro; não muda status nem transfere a pessoa. Quando for preciso corrigir também o vínculo para tornar o contexto válido, use a [reconciliação composta de CAD/FRQ](membership-reconciliation.md).

`POST /sessions/:id/cancellation` recebe `{ expectedSessionRevision, reason }`. Preserva marcações, incrementa a revisão do encontro e grava cancelamento auditado. Encontro cancelado sai das contagens; não aceita correção, novas marcações ou reativação. Replay da mesma chave retorna o cancelamento original; outra chave para encontro já cancelado retorna `422 SESSION_CANCELED` em `details.rule`.

## Listagem e frequência

Listagem de encontros aceita `from`, `toExclusive`, `status`, `page`, `pageSize`. Ordenação: `occurredAt desc`, `id desc`. O fim é exclusivo; `pageSize` padrão 20, máximo 100. O detalhe mantém encontros cancelados consultáveis e inclui `context.rows` para distinguir linhas lançadas de não registradas.

`GET /people/:id/frequency` exige `activityId`, `from`, `toExclusive`; `familyId` é opcional. O intervalo é `[from, toExclusive)`. O denominador declarado `ENROLLMENT_OR_RECORDED` inclui encontros concluídos nos quais havia inscrição válida ou marcação avulsa explícita da pessoa. Inscrição não produz presença; encontro anterior à inscrição só entra quando há marcação explícita. Cancelados e marcações supersedidas são excluídos.

Cada `opportunity` identifica pessoa, encontro/revisão, instante, família/vínculo/revisão, `attendance` opcional, revisões das inscrições e `relevance` (`ENROLLMENT`, `RECORDED`, `BOTH`). Para linha lançada vale o contexto persistido; para não registrada, o vínculo histórico resolvido no instante. `familyId` filtra essa projeção antes de contar. Contextos não resolvidos aparecem em `unresolvedOpportunities` e impedem completude; não são atribuídos a uma família por inferência.

| Campo                                              | Significado                                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `sessionCount`                                     | Oportunidades conhecidas no recorte                                                        |
| `presenceCount`, `absenceCount`, `unrecordedCount` | Partição do total por marcação explícita ou sua ausência                                   |
| `markingsComplete`                                 | Todas as oportunidades conhecidas estão marcadas                                           |
| `coverageComplete`                                 | Cobertura vigente dos dias civis abrangidos pela consulta                                  |
| `contextComplete`                                  | Contextos familiares necessários resolvidos                                                |
| `isComplete`                                       | Conjunção das três condições                                                               |
| `attendanceRate`                                   | Percentual de 0 a 100; `null` se incompleto ou total zero                                  |
| `coverageRevisions`                                | Referências `{ entityType, entityId, revision }` das declarações que intersectam o período |

Sempre `sessionCount = presenceCount + absenceCount + unrecordedCount`. Mostre contagens conhecidas mesmo se a taxa for `null`. Para consulta que atravessa parte de um dia, a completude exige cobertura do dia civil inteiro correspondente em `APP_TIMEZONE`. Essa consulta operacional não cria política ou avaliação de aptidão.

## Declarar cobertura

`GET /activities/:id/coverage` exige `periodStart` e `periodEndExclusive`, datas `YYYY-MM-DD` com intervalo ordenado. Retorna revisão da atividade, `sourceFingerprint`, `sourceVersions`, declarações, trechos válidos `confirmedPeriods`, lacunas `gaps` e `isComplete`.

`POST /activities/:id/coverage-declarations` recebe essas datas, `expectedActivityRevision`, `expectedSourceFingerprint`, `confirmed: true` e `reason`. O operador confirma explicitamente que todos os encontros realizados foram lançados. O fim exclusivo deve ser menor ou igual ao dia atual em `APP_TIMEZONE`: o dia em andamento e períodos futuros não podem ser confirmados. Período encerrado sem encontros pode ser declarado; não gera presença, ausência ou taxa de 0%/100%.

Fonte alterada desde a consulta produz `409 COVERAGE_SOURCES_CHANGED` em `details.rule`. Declarações guardam revisões de encontros, marcações e inscrições relevantes. Criação/correção/cancelamento de encontro, marcação ou alteração de inscrição/vínculo invalidam os trechos civis afetados. Outros trechos continuam válidos. `invalidatedPeriods` preserva `{ from, toExclusive, recordedAt, recordedBy, reason }`; cada invalidação efetiva incrementa revisão e gera auditoria. Para preencher uma lacuna, revise novamente o período e faça uma nova declaração; versões antigas permanecem recuperáveis.

## Erros específicos

| HTTP / código                 | `details.rule`                               | Ação do integrador                                                     |
| ----------------------------- | -------------------------------------------- | ---------------------------------------------------------------------- |
| 400 `VALIDATION_ERROR`        | —                                            | Corrigir formato, duplicatas, campos desconhecidos ou corpo incompleto |
| 409 `REVISION_CONFLICT`       | —                                            | Reconsultar a revisão indicada em `details.currentRevision`            |
| 409 `DOMAIN_CONFLICT`         | `ROSTER_CHANGED`, `MARKING_CONTEXT_CHANGED`  | Renovar prévia e revisar contexto/seleção                              |
| 409 `DOMAIN_CONFLICT`         | `MARKING_MISSING`                            | Reconsultar a linha; primeira marcação exige revisão `null` e contexto |
| 409 `DOMAIN_CONFLICT`         | `SESSION_CONTEXT_RECONCILIATION_REQUIRED`    | Revisar o novo horário e todas as marcações em `details.ids`           |
| 409 `DOMAIN_CONFLICT`         | `COVERAGE_SOURCES_CHANGED`                   | Renovar consulta e confirmação explícita da cobertura                  |
| 422 `BUSINESS_RULE_VIOLATION` | `PERIODIC_ACTIVITY_REQUIRED`                 | Selecionar atividade periódica                                         |
| 422 `BUSINESS_RULE_VIOLATION` | `PERSON_WITHOUT_MEMBERSHIP`                  | Regularizar CAD na data do fato                                        |
| 422 `BUSINESS_RULE_VIOLATION` | `FUTURE_SESSION`, `SESSION_OUTSIDE_VALIDITY` | Corrigir horário/vigência/corte                                        |
| 422 `BUSINESS_RULE_VIOLATION` | `SESSION_CANCELED`                           | Manter histórico do cancelamento                                       |
| 422 `BUSINESS_RULE_VIOLATION` | `COVERAGE_PERIOD_NOT_CLOSED`                 | Selecionar somente dias civis encerrados                               |

401/403/404, idempotência e indisponibilidade seguem CORE. Traduza mensagens para pt-BR por código/regra e preserve `requestId` para correlação.

## Persistência, auditoria e consumo interno

`ActivitySession`, `Attendance`, `AttendanceCoverage` têm classificação `ATTENDANCE`; ações `CREATE`, `CORRECT`, `CANCEL`, `INVALIDATE`. Consulta exige `audit.read` cumulativamente com `attendance.read`. Eventos contêm antes/depois, motivo e autoria, correlacionados por `operationId`. Auditoria cadastral continua exigindo acesso cadastral, inclusive quando participa da mesma reconciliação.

`src/runtime.ts` compõe `AttendanceService`, leitor e unidade de trabalho Prisma. Escritas usam isolamento serializable, bloqueio do autor e contexto projeto/atividade/pessoas/famílias; alterações, revisões, auditoria, invalidações e conclusão da operação confirmam juntas. Leituras usam snapshot consistente PostgreSQL. Redis mantém somente a infraestrutura de acesso; FRQ não tem cache de frequência ou aptidão.

APT/REL podem consumir `AttendanceService.queryFrequency({ personId, activityId, from, toExclusive, familyId? })`, sem HTTP ou Prisma nas camadas internas. Esse método entrega a mesma projeção e flags da rota; a fronteira pública de cada consumidor deve autorizar o acesso. A API pública usa `frequency(actor, query)`, que exige `attendance.read`. [APT](eligibility.md) lê as mesmas fontes em seu próprio snapshot, para avaliar vários membros e atividades de forma consistente e aplicar a modalidade de oportunidades da política; REL ainda não está implementado.

## Validação e limites

```bash
pnpm test test/features/attendance packages/contracts/test/attendance-api.test.ts
TEST_DATABASE_URL=postgresql://erp:erp_test_only@localhost:55432/erp_test \
TEST_REDIS_URL=redis://localhost:56379 \
pnpm test:integration test/features/attendance test/features/registration/presentation/membership-reconciliation.integration.test.ts
```

Prepare os serviços exclusivos conforme o [README](../../README.md#validar). Testes usam migrations reais e dados sintéticos. Regras foram desenvolvidas por TDD; documentação é revisada por conteúdo/links, sem testes que fixem redação.

| Aceite FRQ    | Evidência backend                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------- |
| AC01–07       | Prévia sem efeitos, inscrição versus presença, dois encontros no dia, avulso, contexto histórico, rollback e replay |
| AC08–09/15    | Revisões, correções, preservação do contexto, cancelamento e primeira marcação                                      |
| AC10–11/13/17 | Taxa desconhecida, cobertura explícita, invalidação parcial, recesso e corte civil                                  |
| AC12/14       | Família factual, reconciliação explícita e filtro anterior às contagens                                             |
| AC16          | Fingerprint obsoleto, seleção de avulsos e revisão das fontes                                                       |

Integrações adicionais verificam autorização, isolamento de auditoria, unicidade PostgreSQL, rollback e corridas entre autores/encerramento. UI e relatórios continuam pendentes; os testes não comprovam essas entregas nem aprovação institucional para dados reais.
