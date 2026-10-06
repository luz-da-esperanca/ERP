# Históricos e relatórios

Referência dos contratos HTTP implementados para [SPEC-REL](../specs/07-reports.md). Convenções de sessão, envelope e erros estão no [guia do backend](README.md). Os schemas ficam em [reports-api.ts](../../packages/contracts/src/reports-api.ts).

Todas as rotas são `GET`: nenhuma grava avaliação, ficha, operação ou auditoria. Os relatórios cobrem somente os módulos do MVP; não há atendimentos, estoque, entregas nem exportação CSV/PDF.

## Rotas e permissões

Toda rota exige `reports.read` **e** a permissão do domínio consultado. `reports.read` sozinha não concede nada.

| Caminho sob `/api/v1`                | Permissão de domínio  | Coordenação | Assistência Social | Responsável por Atividade | Administrador |
| ------------------------------------ | --------------------- | ----------- | ------------------ | ------------------------- | ------------- |
| `/reports/reach` e `/records`        | `attendance.read`     | Sim         | Sim                | Sim                       | 403           |
| `/reports/frequency` e `/records`    | `attendance.read`     | Sim         | Sim                | Sim                       | 403           |
| `/reports/eligibility` e `/records`  | `eligibility.read`    | Sim         | Sim                | 403                       | 403           |
| `/reports/data-quality` e `/records` | `registration.read`   | Sim         | Sim                | 403                       | 403           |
| `/families/:id/history`              | `registration.read`   | Sim         | Sim                | 403                       | 403           |
| `/people/:id/history`                | `participants.lookup` | Sim         | Sim                | Só eventos de atividade   | 403           |

Alcance e frequência devolvem a projeção mínima: `personId` com nome e `familyId` com código. Nunca documento, endereço, ficha ou renda.

## Total e detalhe

Cada relatório devolve `generatedAt`, os `filters` normalizados (ausentes como `null`), a unidade de contagem e um `queryFingerprint`. Para abrir ou paginar o detalhe de um total, envie os **mesmos filtros** e `expectedQueryFingerprint` à rota `/records`:

```http
GET /api/v1/reports/reach/records?from=2026-01-01&toExclusive=2026-02-01&unit=PERSON&expectedQueryFingerprint=…
```

Se alguma fonte mudou desde o total, ou se os filtros são outros, a resposta é `409 REPORT_CHANGED`: recarregue o total antes de mostrar a lista. O fingerprint não é autorização; cada requisição autentica e aplica as permissões atuais.

Rotas `/records` respondem `{ report: { generatedAt, filters, unit, queryFingerprint }, data, pagination }`. Períodos são civis, `from` inclusivo e `toExclusive` exclusivo, no fuso `APP_TIMEZONE`.

| Erro                          | `details.rule`               | Situação                                                                                       |
| ----------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------- |
| 400 `VALIDATION_ERROR`        | —                            | Período invertido, filtro que o relatório não aceita, fingerprint ausente no detalhe           |
| 409 `REPORT_CHANGED`          | —                            | Fontes ou filtros diferem do total consultado                                                  |
| 422 `BUSINESS_RULE_VIOLATION` | `REPORT_FILTER_CONFLICT`     | Filtros contraditórios (atividade fora do projeto; período de resolução para pendência aberta) |
| 422                           | `REPORT_FILTER_UNKNOWN`      | Instituto, projeto ou atividade inexistente                                                    |
| 422                           | `PERIODIC_ACTIVITY_REQUIRED` | Frequência pedida para atividade pontual                                                       |

Filtros contraditórios nunca produzem um total vazio.

## Alcance

`GET /reports/reach?from=&toExclusive=&instituteId?=&projectId?=&activityId?=`

Conta presenças `PRESENT` efetivas em encontros `COMPLETED` do período. `totals` e cada item de `groups` (por atividade) trazem quatro unidades separadas:

- `people`: pessoas canônicas distintas com ao menos uma presença;
- `families`: famílias distintas desses fatos, pela família registrada no encontro;
- `sessions`: encontros concluídos, mesmo sem presença;
- `presences`: marcações de presença.

Inscrição, cadastro e ficha publicada não são alcance. Encontros cancelados e marcações substituídas ficam fora. `/records` aceita `unit=PERSON|FAMILY|SESSION|PRESENCE` e lista exatamente as unidades do total correspondente.

## Frequência

`GET /reports/frequency?from=&toExclusive=&activityId=&personId?=&familyId?=`

`activityId` é obrigatório e deve ser de atividade periódica. O relatório usa a mesma projeção de oportunidades, os mesmos contadores e as mesmas três dimensões de completude de [FRQ](attendance.md), com denominador `ENROLLMENT_OR_RECORDED`.

`totals` soma as oportunidades dos participantes: `participants`, `sessionCount`, `presenceCount`, `absenceCount`, `unrecordedCount`, `markingsComplete`, `contextComplete`, `coverageComplete`, `isComplete` e `attendanceRate` (0 a 100). A taxa é `presenceCount / sessionCount` sobre as oportunidades, não a média dos percentuais individuais, e é `null` com denominador zero ou qualquer incompletude; as contagens conhecidas aparecem mesmo assim. `completedSessions` e `canceledSessions` identificam os encontros do período à parte. `coverage` lista trechos confirmados e lacunas.

`familyId` filtra pelo contexto histórico de cada oportunidade, não pela família atual. `/records` aceita `unit=OPPORTUNITY` (uma linha por pessoa e encontro, com `status` `null` quando não lançado) ou `unit=SESSION` (encontros do período, inclusive cancelados).

## Aptidão

`GET /reports/eligibility?referenceDate=&status?=&familyId?=&page?=&pageSize?=`

Classifica **todas** as famílias canônicas com o mesmo avaliador de [APT](eligibility.md), em um único snapshot, e só depois aplica `status` e paginação. `totals` (`total`, `ELIGIBLE`, `INELIGIBLE`, `PENDING`) não depende da página nem do filtro de situação. Sem política vigente, `policyId` é `null` e todas ficam `PENDING` com `POLICY_UNDEFINED`.

Cada linha traz `family { id, code }`, `status`, `pendingReasons`, `policyId`, `explanation` e `evidences`, idênticos aos da prévia da família. `method: "CALCULATED_ON_REQUEST"` indica cálculo no instante `generatedAt`; avaliações salvas são consultadas por `GET /eligibility-assessments/:id`. `/records` exige `status`.

## Qualidade cadastral

`GET /reports/data-quality?from=&toExclusive=&dateBasis?=&kind?=&status?=&page?=&pageSize?=`

`dateBasis` é `IDENTIFICATION` (padrão, filtra por `identifiedAt`) ou `RESOLUTION` (filtra por `resolvedAt`), e volta em `filters` para que o total diga qual data o selecionou. `totals` traz `total`, `open`, `resolved`, `byKind` e `byResolution` (`DISTINCT`, `MERGED`, `COMPLETED`, `NOT_TRACKED`). As linhas são as ocorrências, com identificação, resolução, autor e motivo. `MISSING_DATA` é gerado conforme a [seleção de CAD](registration.md#seleção-de-campos-e-dados-ausentes), sem campos padrão. `NOT_TRACKED` distingue retirada da seleção de complemento efetivo. Ocorrências resolvidas e de identidades unificadas continuam no histórico; `status=OPEN` consulta as pendências atuais.

## Históricos

`GET /families/:id/history` e `GET /people/:id/history` aceitam `from?`, `toExclusive?`, `eventTypes?` (lista separada por vírgula), `order=asc|desc` (padrão `desc`) e paginação. Respondem `{ report: { generatedAt, order, eventTypes, from, toExclusive, familyId | personId }, data, pagination }`.

| Tipo                                     | Origem                    | Permissão           | Família | Pessoa |
| ---------------------------------------- | ------------------------- | ------------------- | ------- | ------ |
| `MEMBERSHIP_STARTED`, `MEMBERSHIP_ENDED` | Vínculo                   | `registration.read` | Sim     | Sim    |
| `ENROLLMENT_STARTED`, `ENROLLMENT_ENDED` | Inscrição                 | `projects.read`     | —       | Sim    |
| `ATTENDANCE`                             | Marcação em encontro      | `attendance.read`   | Sim     | Sim    |
| `SOCIAL_FORM`                            | Versão publicada da ficha | `socialForms.read`  | Sim     | Sim    |
| `ELIGIBILITY_ASSESSMENT`                 | Avaliação salva           | `eligibility.read`  | Sim     | —      |

Tipos que o perfil não pode ler são removidos antes da leitura; `report.eventTypes` informa os que foram efetivamente consultados. Um Responsável por Atividade recebe somente `ATTENDANCE` e inscrições, mesmo que peça outros.

Cada evento traz `type`, `occurredAt` (data do fato), `recordedAt` (lançamento, quando existe), `referenceDate` (avaliações), `sourceType`, `sourceId`, `familyId`, `personId`, `activityId`, `valid`, `invalidReason` e `details`. A ordenação é `occurredAt`, depois `recordedAt`, depois `sourceId`.

- Marcações de encontro cancelado (`SESSION_CANCELED`) e registros substituídos em unificação (`SUPERSEDED`) continuam no histórico com `valid: false`.
- `SOCIAL_FORM` informa apenas versão e proveniência; nenhum bloco da ficha é lido. Uma versão publicada não é um atendimento realizado.
- O histórico familiar usa a família registrada em cada fato: uma transferência posterior não leva presenças antigas à nova família.
- Um ID de pessoa ou família unificada é resolvido para a identidade canônica, informada em `report`.
- O histórico familiar não lista inscrições; elas aparecem no histórico da pessoa.

## Verificação

Testes unitários cobrem regras de escopo, contagem, taxa, totais, ordenação e a matriz de permissões. A integração PostgreSQL/Redis cobre REL-AC01 a AC13: unidades de alcance, cancelamento e `REPORT_CHANGED`, contexto familiar após transferência, taxa desconhecida, aptidão com e sem política, qualidade por data, projeção do perfil de atividade, unificação e ausência de escrita. Metas de desempenho dependem do volume de LAC-10 e não foram medidas. A interface desta spec ainda não existe.
