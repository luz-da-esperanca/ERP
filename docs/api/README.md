# Integração com o backend

Referência para quem integra a interface do MVP à API. A base normativa é [CORE](../specs/00-foundation.md), [ACS](../specs/01-access.md), [CAD](../specs/02-registration.md), [FIC](../specs/03-social-forms.md), [ATV](../specs/04-projects-activities.md), [FRQ](../specs/05-attendance.md) e [AUD](../specs/08-audit.md). Este diretório documenta os contratos implementados; a existência de uma rota na spec não comprova sua entrega.

## Disponibilidade

Estão entregues autenticação, contas/perfis, [Cadastro e qualidade dos dados](registration.md), [Projetos, atividades e inscrições](projects.md), [Encontros, frequência e cobertura](attendance.md), [Ficha social](social-forms.md), [Aptidão familiar](eligibility.md), [reconciliação composta CAD/FRQ](membership-reconciliation.md), [unificação de pessoas e famílias](identity-merges.md) e auditoria dessas entidades. Os guias de integração de [ATV](integrating-projects.md), [FRQ](integrating-attendance.md) e [FIC](integrating-social-forms.md) orientam os fluxos. [Históricos e relatórios](reports.md) também estão entregues. Todas as rotas previstas nas specs do MVP têm backend; veja o [índice das specs](../specs/README.md#4-sequência-de-implementação) para o que resta.

A entrada da interface já usa autenticação HTTP; os demais módulos aguardam integração pela frente de frontend. Os DTOs HTTP estão em `@erp/contracts/registration-api`, `@erp/contracts/data-quality-api`, `@erp/contracts/projects-api`, `@erp/contracts/attendance-api`, `@erp/contracts/social-forms-api`, `@erp/contracts/eligibility-api`, `@erp/contracts/identity-merge-api`, `@erp/contracts/reports-api`, `@erp/contracts/membership-reconciliation-api` e `@erp/contracts/audit-api`. Os contratos legados `registration`, `projects`, `attendance`, `social-forms` e `reports` atendem ao protótipo e não definem os payloads HTTP.

## Preparar o ambiente e a conta

Siga os comandos de banco, Redis, variáveis e bootstrap no [README principal](../../README.md#executar-a-api-local). Use dados sintéticos e `DATA_MODE=SYNTHETIC` enquanto as decisões institucionais estiverem abertas. As migrations cadastrais instalam `btree_gist`; a conta que executa as migrations precisa poder criar essa extensão no PostgreSQL.

O bootstrap cria um Administrador. Para operar CAD, atribua explicitamente `SOCIAL_ASSISTANCE` ou `COORDINATION` a uma conta por `PATCH /api/v1/users/:userId`, com a revisão atual, `roleCodes` e os cabeçalhos abaixo. Ser Administrador, isoladamente, não concede cadastro assistencial. As operações e os schemas de contas estão em [access-api.ts](../../packages/contracts/src/access-api.ts) e [SPEC-ACS](../specs/01-access.md#5-api).

No navegador, sirva a SPA e `/api` pela mesma origem. Em desenvolvimento, o Vite encaminha `/api` para `http://127.0.0.1:3001`. `APP_ORIGIN` deve corresponder exatamente à origem da SPA. O backend não oferece CORS para chamadas com credenciais entre origens distintas.

## Sessão e cabeçalhos

Prefixo: `/api/v1`. Login e todas as escritas exigem:

```http
Content-Type: application/json
Origin: http://localhost:5173
X-ERP-Request: 1
```

O navegador envia `Origin` automaticamente. Em produção, use a origem HTTPS configurada e cookies seguros. Se `Sec-Fetch-Site` estiver presente, deve ser `same-origin`.

1. Envie `POST /auth/login` com `{ "login": "synthetic.operator", "password": "..." }`.
2. O JWT vai exclusivamente no cookie HttpOnly. A resposta contém dados da sessão, com usuário, perfis e capacidades; não contém um token para guardar em storage.
3. Consulte `GET /auth/session` para recuperar a sessão e suas capacidades atuais. Use cookies nas chamadas, por exemplo `credentials: 'include'` com `fetch`.
4. Se `user.mustChangePassword=true`, envie `PUT /auth/password` com `expectedRevision`, `currentPassword` e `newPassword`; a troca revoga a sessão e exige novo login.
5. Para sair, envie `POST /auth/logout` com `{}`; sucesso retorna 204.

Todas as escritas de CAD, ATV, FRQ, FIC e APT também exigem `Idempotency-Key` com UUID gerado pelo cliente. As prévias POST de reconciliação CAD/FRQ e de unificação não escrevem e dispensam chave. Login, logout e troca da própria senha seguem as exceções de ACS. `GET` não exige chave nem cria registros de negócio.

## Envelope, datas e revisões

Sucesso individual: `{ "data": ... }`. Listas: `{ "data": [...], "pagination": { "page": 1, "pageSize": 20, "total": 0 } }`. `pageSize` varia de 1 a 100; o padrão é 20. `total` aplica os mesmos filtros e permissões da página.

IDs são UUIDs. O código da família é uma string numérica gerada pelo servidor, única e imutável; não converta em `number` nem espere uma sequência sem lacunas. Datas civis são `YYYY-MM-DD`; instantes têm offset obrigatório, como `2026-01-01T00:00:00-03:00`, e são devolvidos em UTC. O fuso civil é `APP_TIMEZONE`, configurado no backend; não derive o dia institucional do relógio UTC ou do fuso do navegador.

Campos opcionais desconhecidos são `null`. Em `PATCH`, omissão preserva e `null` remove um valor opcional. Texto opcional vazio após trim vira `null`; nome vazio é inválido. Chaves desconhecidas são rejeitadas, incluindo autoria, timestamps, código e revisão gerados pelo servidor.

Uma alteração efetiva incrementa `revision`; um no-op preserva revisão e auditoria. Atualizar composição incrementa a revisão da família, inclusive em criação de pessoa, transferência, correção, encerramento e troca de titular. Atualizar os dados de uma pessoa usa sua própria revisão. Tamanhos têm revisão independente.

## Repetição e conflitos

Guarde a chave junto com a intenção enviada. Se houver timeout ou perda da resposta, repita exatamente rota, parâmetros, corpo normalizado, autor e chave. A API reconstrói a revisão original, mesmo depois de outra alteração; não duplica registros ou eventos. Uma intenção diferente precisa de nova chave. A API valida a permissão atual também no replay.

Em `409 REVISION_CONFLICT`, recarregue o recurso e apresente a alteração concorrente antes de enviar uma nova intenção com a revisão atual. Não substitua automaticamente a revisão no mesmo payload. Em `409 DOMAIN_CONFLICT`, trate `details.rule`; duplicidade exige revisão explícita dos candidatos, e sobreposição exige corrigir o plano temporal. A API não unifica pessoas automaticamente.

Erros seguem:

```json
{
  "error": {
    "code": "REVISION_CONFLICT",
    "message": "Resource revision changed",
    "details": { "currentRevision": 2 },
    "requestId": "00000000-0000-4000-8000-000000000001"
  }
}
```

Traduza `code`, `details.rule` e os caminhos de `details.fields` para pt-BR; `message` é técnico. Use `requestId` para correlação. Consulte o [catálogo CORE](../specs/00-foundation.md#4-http-e-contratos-de-saída) para 400, 401, 403, 404, 409, 415, 422, 429 e 503. Falta de PostgreSQL ou Redis não autoriza simular sucesso ou persistência no cliente.

## Auditoria

`GET /audit-entries` exige `entityType`. Aceita `entityId`, `actorId`, `from`, `to`, `action` e paginação. `from` inclui o instante inicial; `to` exclui o final, ambos sobre a data de lançamento `recordedAt`. Ordenação: `recordedAt desc`, `id desc`.

| Entidade                                                                                   | Permissões cumulativas                   |
| ------------------------------------------------------------------------------------------ | ---------------------------------------- |
| `RegistrationFieldSelection`                                                               | `audit.read` e `featureDecisions.manage` |
| `UserAccount`                                                                              | `audit.read` e `accounts.manage`         |
| `Family`, `Person`, `FamilyMembership`, `SizeProfile`, `DataQualityIssue`, `IdentityMerge` | `audit.read` e `registration.read`       |
| `Institute`, `ServiceType`, `Project`, `Activity`, `ParticipantEnrollment`                 | `audit.read` e `projects.read`           |
| `ActivitySession`, `Attendance`, `AttendanceCoverage`                                      | `audit.read` e `attendance.read`         |
| `SocialForm`, `Acknowledgement`                                                            | `audit.read` e `socialForms.read`        |
| `EligibilityPolicy`, `EligibilityAssessment`                                               | `audit.read` e `eligibility.read`        |
| `FieldSelectionVersion`, `SocialFormOption`, `FeatureDecision`                             | `audit.read` e `featureDecisions.manage` |

`GET /audit-entries/:entryId` devolve `{ data: entry }`; um ID fora do universo autorizado retorna 404. Lista e detalhe contêm `operationId`, ação, revisão, autor, `recordedAt`, `occurredAt`, `before`, `after`, motivo e classificação. `occurredAt` pode ser `null`; não substitua por `recordedAt`. Vários eventos podem pertencer à mesma operação composta.

Revisões antigas são recuperáveis nos snapshots da auditoria. Não há rota pública independente `/:resource/:id/revisions/:revision` nesta etapa. Os schemas de saída são [audit-api.ts](../../packages/contracts/src/audit-api.ts); snapshots de contas mantêm a compatibilidade de [account-audit-api.ts](../../packages/contracts/src/account-audit-api.ts).

FIC restringe o conteúdo dos snapshots também por seleção, escopo e flags atuais. Eventos de ficha sem campos sociais visíveis são excluídos antes de contar/paginar; detalhe desse evento retorna 404. Veja a [referência de FIC](social-forms.md#proteção-e-auditoria).
