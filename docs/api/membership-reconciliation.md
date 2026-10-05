# Reconciliação composta de vínculos e chamada

Contrato implementado de [SPEC-CAD](../specs/02-registration.md) com [FRQ](../specs/05-attendance.md). Use quando uma correção/transferência temporal torna inválido o vínculo de uma marcação já lançada. O backend valida o estado final e confirma composição, contexto factual, revisões, cobertura, auditoria e operação na mesma transação PostgreSQL. Não existe estado intermediário com presença órfã.

Schemas e tipos: [membership-reconciliation-api.ts](../../packages/contracts/src/membership-reconciliation-api.ts), importado como `@erp/contracts/membership-reconciliation-api`. Cabeçalhos e envelope seguem o [guia comum](README.md).

## Rotas e acesso

| Método / caminho sob `/api/v1`                              | Resposta                |
| ----------------------------------------------------------- | ----------------------- |
| `POST /people/:personId/membership-reconciliations/preview` | 200, prévia sem efeitos |
| `POST /people/:personId/membership-reconciliations`         | 200, estado confirmado  |

Ambas exigem `registration.write`; quando `attendanceContextChanges` tem itens, exigem também `attendance.write`. Coordenação reúne essas capacidades. Assistência Social isolada não corrige chamada por este caminho; Responsável por Atividade isolado não muda composição familiar. A prévia exige origem e cabeçalhos de POST, mas dispensa chave de idempotência. A confirmação exige `Idempotency-Key` UUID e revalida capacidades atuais antes de escrita/replay.

## Montar o plano

Plano de uma pessoa por operação:

| Campo                      | Contrato                                                                 |
| -------------------------- | ------------------------------------------------------------------------ |
| `intent`                   | `TRANSFER` ou `CORRECTION`, identificação explícita da intenção          |
| `expectedPersonRevision`   | Revisão atual da pessoa                                                  |
| `familyRevisions`          | `{ familyId, expectedRevision }[]`, incluindo cada família afetada       |
| `membershipChanges`        | Estado final completo dos segmentos que serão alterados/criados          |
| `attendanceContextChanges` | Marcações cujo contexto será reconciliado explicitamente; pode ser vazio |
| `reason`                   | Motivo da composição proposta                                            |

Segmento existente recebe `membershipId`, `expectedRevision`, `validFrom`, `validUntil`, `isReference`, `relationshipToReference`. Segmento novo recebe `clientRef`, `familyId` e os mesmos campos de vigência/titularidade/parentesco. Os campos são completos, não PATCH; `validUntil:null` mantém fim aberto. Para segmento existente, pessoa e família são preservadas. Transferência representa encerramento de um segmento e criação de outro.

`clientRef` é uma referência local escolhida pelo cliente, entre 1 e 100 caracteres, para relacionar uma marcação a um segmento ainda sem UUID. Cada alteração de contexto contém `attendanceId`, `expectedRevision`, `sessionId`, `expectedSessionRevision`, `membership:{id}` ou `membership:{clientRef}`, e `reason`. Status e data do fato não são campos desse comando.

Arrays têm no máximo 1.000 itens, sem IDs/referências duplicados. `familyRevisions` e `membershipChanges` não podem ser vazios. A família escolhida deve existir. O plano inteiro deve preservar intervalos ordenados, pertença vigente única, titularidade sem sobreposição e datas não futuras. Segmentos não mencionados são preservados e também participam da validação.

## Exemplo de correção histórica

IDs abaixo são ilustrativos; carregue revisões reais de CAD e do encontro antes de montar o plano. O exemplo encerra o vínculo de origem em 10/01 e cria um segmento na família correta. A marcação de 20/01 escolhe explicitamente esse novo segmento.

```json
{
  "intent": "CORRECTION",
  "expectedPersonRevision": 1,
  "familyRevisions": [
    {
      "familyId": "00000000-0000-4000-8000-000000000001",
      "expectedRevision": 2
    },
    {
      "familyId": "00000000-0000-4000-8000-000000000002",
      "expectedRevision": 1
    }
  ],
  "membershipChanges": [
    {
      "membershipId": "00000000-0000-4000-8000-000000000003",
      "expectedRevision": 1,
      "validFrom": "2026-01-01T00:00:00-03:00",
      "validUntil": "2026-01-10T00:00:00-03:00",
      "isReference": false,
      "relationshipToReference": null
    },
    {
      "clientRef": "corrected-binding",
      "familyId": "00000000-0000-4000-8000-000000000002",
      "validFrom": "2026-01-10T00:00:00-03:00",
      "validUntil": null,
      "isReference": false,
      "relationshipToReference": null
    }
  ],
  "attendanceContextChanges": [
    {
      "attendanceId": "00000000-0000-4000-8000-000000000004",
      "expectedRevision": 1,
      "sessionId": "00000000-0000-4000-8000-000000000005",
      "expectedSessionRevision": 1,
      "membership": { "clientRef": "corrected-binding" },
      "reason": "Correção sintética da família registrada no fato"
    }
  ],
  "reason": "Correção sintética dos intervalos de composição"
}
```

1. Envie o plano para `/preview`. A resposta contém `sourceFingerprint`, `sourceVersions`, `conflicts`, `affectedAttendanceIds` e `proposedMemberships`.
2. Revise `conflicts`: são IDs de marcações que continuariam sem contexto válido no estado final. Um plano incompleto não pode ser confirmado. Adicione as correções explícitas necessárias e renove a prévia.
3. `proposedMemberships` usa `new:<clientRef>` como ID temporário de novos segmentos. Não envie esse valor em campos UUID; use `{clientRef}` nas referências do plano.
4. Capture uma nova chave e envie o mesmo plano, acrescido de `expectedSourceFingerprint`, para a rota de confirmação.
5. Use `createdMemberships:[{clientRef,membershipId}]` da resposta para substituir referências temporárias pelo UUID persistido. Recarregue CAD, encontro e frequência afetados.

O fingerprint inclui plano e fontes/revisões; uma mudança de composição ou chamada exige revisão e nova prévia. Preserve a ordem dos arrays e o corpo capturado no retry da confirmação. O servidor reconstrói as revisões originais no replay, sem aplicar novamente o plano.

## Resultado, conflitos e histórico

Resposta: `{ data: { person, memberships, families, sessions, attendances, createdMemberships } }`. Inclui vínculos da pessoa e marcações relacionadas; `sessions` contém encontros cuja revisão foi alterada. Uma alteração de composição incrementa as famílias afetadas; cada marcação corrigida incrementa sua revisão e cada encontro afetado incrementa uma vez. Pessoa não recebe revisão nova somente por alteração de vínculo.

Marcações já válidas que não foram escolhidas para correção conservam contexto e revisão factual anteriores. Contextos escolhidos passam a referenciar o vínculo/revisão confirmados, mantendo status e instante do encontro. Encontros cancelados continuam históricos e não são corrigidos pelo plano. Cobertura é invalidada somente nos trechos civis afetados; seus eventos ficam correlacionados à mesma operação.

| HTTP / código           | `details.rule`                   | Tratamento                                                                              |
| ----------------------- | -------------------------------- | --------------------------------------------------------------------------------------- |
| 409 `REVISION_CONFLICT` | —                                | Recarregar pessoa, famílias, vínculos, encontro ou marcação conforme a revisão obsoleta |
| 409 `DOMAIN_CONFLICT`   | `FAMILY_REVISION_REQUIRED`       | Incluir a revisão da família indicada                                                   |
| 409 `DOMAIN_CONFLICT`   | `RECONCILIATION_SOURCES_CHANGED` | Recalcular prévia e revisar alterações concorrentes                                     |
| 409 `DOMAIN_CONFLICT`   | `RECONCILIATION_CONTEXT_CHANGED` | Conferir relação entre marcação e encontro                                              |
| 409 `DOMAIN_CONFLICT`   | `MEMBERSHIP_ATTENDANCE_CONFLICT` | Completar plano para os IDs de marcações indicados                                      |

Demais validações temporais, autorização, idempotência e ausência de recurso seguem CAD/CORE. Uma falha desfaz alterações, revisões, invalidações, auditoria e conclusão da operação. Cada evento mantém a classificação e autorização de seu módulo; ter acesso a um evento de chamada não libera os snapshots cadastrais da mesma operação.

Comandos simples de transferência/correção/encerramento/titularidade continuam disponíveis. Eles rejeitam cortes que tornem inválida marcação concluída com `MEMBERSHIP_ATTENDANCE_CONFLICT`; não reassociam fatos automaticamente. Use o comando composto quando o corte e o contexto precisam mudar juntos.

Esta entrega não implementa unificação de identidades, reconciliação de inscrições sobrepostas por fusão, versões de ficha social ou avaliações de aptidão. Esses contratos dependem das próximas etapas do MVP. A integração composta está verificada em [membership-reconciliation.integration.test.ts](../../test/features/registration/presentation/membership-reconciliation.integration.test.ts); comandos de execução estão na [referência FRQ](attendance.md#validação-e-limites).
