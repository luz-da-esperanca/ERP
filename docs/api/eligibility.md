# Aptidão familiar

Referência dos contratos HTTP implementados para [SPEC-APT](../specs/06-eligibility.md). Convenções de sessão, cabeçalhos, envelope, idempotência e erros estão no [guia do backend](README.md). Os schemas ficam em [eligibility-api.ts](../../packages/contracts/src/eligibility-api.ts).

Aptidão informa uma situação em uma data; não libera entrega, não define prioridade e não é botão de concessão. Não existe política inicial nem valor padrão: enquanto a coordenação não publicar uma política, toda família é `PENDING` com `POLICY_UNDEFINED`.

## Rotas e permissões

| Método | Caminho sob `/api/v1`                              | Permissão                  | Resultado                                |
| ------ | -------------------------------------------------- | -------------------------- | ---------------------------------------- |
| GET    | `/eligibility-policies`                            | `eligibility.read`         | Versões paginadas, mais recente primeiro |
| GET    | `/eligibility-policies/:id`                        | `eligibility.read`         | Versão publicada e sua vigência          |
| POST   | `/eligibility-policies`                            | `eligibility.policy.write` | 201, nova versão imutável                |
| GET    | `/families/:id/eligibility-preview?referenceDate=` | `eligibility.read`         | Cálculo informativo; não grava           |
| POST   | `/families/:id/eligibility-assessments`            | `eligibility.evaluate`     | 201, avaliação persistida                |
| GET    | `/eligibility-assessments/:id`                     | `eligibility.read`         | Avaliação original e evidências          |

Coordenação lê, avalia e publica; Assistência Social lê e avalia. Responsável por Atividade e Administrador recebem 403 em todas as rotas, inclusive na auditoria dessas entidades. Os dois POST exigem `Idempotency-Key`; repetir a mesma chave, autor e conteúdo devolve o registro original com 201.

## Publicar política

```json
{
  "definition": {
    "schemaVersion": 1,
    "period": { "type": "ROLLING_DAYS", "length": 90 },
    "minimum": { "type": "PRESENCE_COUNT", "value": 3 },
    "activityIds": ["00000000-0000-4000-8000-000000000001"],
    "activityCombination": "ANY_ACTIVITY",
    "membershipScope": "CURRENT_ON_REFERENCE",
    "opportunityRule": "ENROLLMENT_OR_RECORDED",
    "justificationRule": "NOT_SUPPORTED",
    "recessRule": "RECORDED_SESSIONS_ONLY",
    "newParticipantRule": "OPPORTUNITY_RULE",
    "toleranceRule": "NONE",
    "incompleteEvidenceRule": "THREE_VALUED"
  },
  "effectiveFrom": "2026-11-01",
  "expectedLatestPolicyId": null,
  "decisionReference": "Synthetic decision reference",
  "reason": "Synthetic publication",
  "retroactive": false
}
```

Os números acima são sintéticos, não uma recomendação institucional. Todos os campos são obrigatórios; a interface não deve pré-preencher nenhum deles como regra.

| Campo                 | Valores aceitos                                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `period`              | `ROLLING_DAYS` (`length` 1–3660), `CALENDAR_MONTHS` (`length` 1–120) ou `FIXED_PERIOD` (`start` < `endExclusive`) |
| `minimum`             | `PRESENCE_COUNT` (`value` ≥ 1) ou `ATTENDANCE_RATE` (`basisPoints` 1–10000)                                       |
| `activityIds`         | 1 a 100 atividades periódicas existentes, sem repetição; gravadas como conjunto ordenado                          |
| `activityCombination` | `ANY_ACTIVITY` ou `COMBINED`                                                                                      |
| `membershipScope`     | `CURRENT_ON_REFERENCE` ou `ANY_WITHIN_PERIOD`                                                                     |
| `opportunityRule`     | `ENROLLMENT_OR_RECORDED` ou `ALL_COMPLETED_DURING_MEMBERSHIP`                                                     |
| Demais regras         | Somente os valores do exemplo                                                                                     |

`expectedLatestPolicyId` é o ID da versão publicada mais recentemente (por data de lançamento) que o autor viu, ou `null` se não havia nenhuma. `effectiveFrom` anterior ao dia atual em `APP_TIMEZONE` exige `retroactive: true`; avaliações já salvas não mudam.

| Resposta                      | `details.rule`                                      | Situação                                                                  |
| ----------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------- |
| 400 `VALIDATION_ERROR`        | —                                                   | Campo ausente, chave desconhecida ou formato inválido                     |
| 422 `BUSINESS_RULE_VIOLATION` | `UNSUPPORTED_POLICY_MODALITY`                       | Versão de formato ou regra nomeada que o mecanismo não implementa         |
| 422                           | `INVALID_POLICY_DEFINITION`                         | Período, mínimo ou conjunto de atividades incoerente                      |
| 422                           | `RETROACTIVE_CONFIRMATION_REQUIRED`                 | Início passado sem confirmação explícita                                  |
| 422                           | `ACTIVITY_NOT_FOUND` / `PERIODIC_ACTIVITY_REQUIRED` | Atividade inexistente ou pontual                                          |
| 409 `DOMAIN_CONFLICT`         | `POLICY_CHANGED`                                    | Outra versão foi publicada depois da esperada; `details.ids` traz a atual |
| 409                           | `POLICY_EFFECTIVE_DATE_TAKEN`                       | Já existe versão com o mesmo início                                       |

A resposta acrescenta `effectiveUntilExclusive`: o início da versão seguinte, ou `null` para a última. Versões não são editadas nem excluídas; o banco rejeita `UPDATE`/`DELETE`.

## Prévia e avaliação

A prévia e a avaliação usam o mesmo avaliador sobre um snapshot PostgreSQL consistente e devolvem a mesma estrutura. A avaliação acrescenta `id` e `requestedBy` e fica imutável; a prévia nunca grava avaliação, operação ou auditoria.

```json
{
  "familyId": "…",
  "referenceDate": "2026-01-31",
  "evaluatedAt": "2026-10-05T12:00:00.000Z",
  "policyId": "…",
  "status": "PENDING",
  "pendingReasons": ["COVERAGE_INCOMPLETE"],
  "explanation": {
    "rule": "EVIDENCE_INSUFFICIENT",
    "period": { "from": "2026-01-01", "toExclusive": "2026-02-01" },
    "minimum": { "type": "PRESENCE_COUNT", "value": 2 },
    "activityIds": ["…"],
    "activityCombination": "ANY_ACTIVITY",
    "membershipScope": "CURRENT_ON_REFERENCE",
    "opportunityRule": "ENROLLMENT_OR_RECORDED",
    "qualifyingPersonIds": []
  },
  "evidences": [
    {
      "personId": "…",
      "membershipIds": ["…"],
      "activityIds": ["…"],
      "periodStart": "2026-01-01",
      "periodEndExclusive": "2026-02-01",
      "sessionCount": 3,
      "presenceCount": 1,
      "absenceCount": 2,
      "unrecordedCount": 0,
      "rateLowerBasisPoints": null,
      "rateUpperBasisPoints": null,
      "coverageComplete": false,
      "status": "PENDING",
      "pendingReason": "COVERAGE_INCOMPLETE",
      "sourceVersions": [
        { "entityType": "ActivitySession", "entityId": "…", "revision": 1 }
      ]
    }
  ],
  "sourceFingerprint": "…"
}
```

`status` é `ELIGIBLE`, `INELIGIBLE` ou `PENDING`. `pendingReasons` só tem itens quando a situação é `PENDING`.

| Motivo                     | Significado                                                    | Quem pode agir            |
| -------------------------- | -------------------------------------------------------------- | ------------------------- |
| `POLICY_UNDEFINED`         | Nenhuma política vigente na data; `policyId` é `null`          | Coordenação               |
| `REFERENCE_OUTSIDE_PERIOD` | Data anterior ao início de um período fixo                     | —                         |
| `MEMBERSHIP_UNRESOLVED`    | Nenhum membro no recorte escolhido pela política               | Cadastro                  |
| `NO_OPPORTUNITIES`         | Nenhum encontro pertinente para o membro/atividade             | Responsável por atividade |
| `COVERAGE_INCOMPLETE`      | Falta declaração de cobertura do período                       | Responsável por atividade |
| `MARKINGS_INCOMPLETE`      | Há encontros sem marcação que ainda poderiam mudar o resultado | Responsável por atividade |

`explanation.rule` resume a decisão familiar: um dos três primeiros motivos, `MEMBER_MEETS_MINIMUM`, `EVIDENCE_INSUFFICIENT` ou `ALL_MEMBERS_BELOW_MINIMUM`. Traduza os códigos no frontend; não há texto livre.

Há uma evidência por membro e atividade (`ANY_ACTIVITY`) ou por membro com as atividades somadas (`COMBINED`). `sessionCount = presenceCount + absenceCount + unrecordedCount`. Os limites de taxa são pontos-base inteiros (7500 = 75,00%), truncados para exibição e `null` quando o denominador não é conhecido; a decisão compara inteiros, nunca o valor arredondado. `sourceVersions` aponta as revisões de vínculos, encontros, marcações, inscrições e declarações de cobertura usadas.

## Como a situação é decidida

1. A política aplicada é a de maior `effectiveFrom` que não ultrapassa a data de referência, mesmo que exista versão mais nova.
2. O período termina no dia de referência, inclusive. Fatos posteriores ao fim desse dia em `APP_TIMEZONE`, ou ao instante da avaliação, não entram.
3. Só contam encontros `COMPLETED`. Uma marcação pertence à família gravada no encontro: presença registrada na família anterior não acompanha a pessoa transferida.
4. Encontro sem marcação conta como oportunidade não registrada somente se a pessoa pertencia à família naquele instante e, em `ENROLLMENT_OR_RECORDED`, estava inscrita. Não é presença nem ausência.
5. Mínimo absoluto: presenças conhecidas suficientes já provam `ELIGIBLE`. `INELIGIBLE` exige cobertura completa e que nem todas as marcações desconhecidas, se fossem presenças, alcançassem o mínimo.
6. Percentual: exige cobertura completa para conhecer o denominador. Sem ela, é `PENDING` mesmo com 100% dos registros conhecidos.
7. A família é `ELIGIBLE` se qualquer evidência for; `INELIGIBLE` somente se todas falharem comprovadamente; caso contrário, `PENDING`.

Premissas desta implementação, derivadas do texto da spec:

- **Sem oportunidades é pendência.** Em `ANY_ACTIVITY`, um membro sem encontros pertinentes em uma das atividades selecionadas mantém a família `PENDING`, ainda que falhe comprovadamente nas outras.
- **Cobertura do período inteiro.** A cobertura precisa abranger todo o período avaliado em cada atividade. Como [FRQ](attendance.md) só aceita declarar dias encerrados, uma referência no dia atual não conclui `INELIGIBLE` nem percentual.
- **Identidades unificadas.** A [unificação de CAD](identity-merges.md) reaponta vínculos, inscrições e marcações efetivos para a identidade canônica e marca as duplicatas como substituídas. O avaliador lê apenas registros efetivos, então cada presença conta uma vez; avaliações já salvas conservam as identidades originais.

Não há cache: cada prévia ou avaliação lê as fontes atuais. `sourceFingerprint` é igual enquanto política, situação e evidências forem as mesmas.

## Auditoria e uso interno

Publicação e avaliação gravam `AuditEntry` na mesma transação, com `classification: "ELIGIBILITY"`, ação `CREATE`, revisão 1 e `before: null`. A publicação registra o motivo informado; a avaliação não inventa motivo. `GET /audit-entries?entityType=EligibilityPolicy|EligibilityAssessment` exige `audit.read` e `eligibility.read`.

Outros módulos usam `EligibilityService.evaluate(familyId, referenceDate)`, que devolve a mesma prévia sem HTTP e sem autorização própria; a fronteira pública de quem consome deve autorizar. Os [relatórios](reports.md) usam `EligibilityService.evaluateAll(referenceDate, familyId?)`, que classifica todas as famílias canônicas com o mesmo avaliador em um único snapshot.

## Verificação

Testes unitários cobrem o avaliador, períodos, vigência e o caso de uso; a integração PostgreSQL/Redis cobre publicação concorrente, replay, imutabilidade, autorização, auditoria e rollback. A interface desta spec ainda não existe.
