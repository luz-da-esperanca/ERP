# Unificação de pessoas e famílias

Referência dos contratos HTTP implementados para a [SPEC-CAD §4](../specs/02-registration.md#4-unificação-de-pessoas-e-famílias). Convenções de sessão, cabeçalhos, envelope, idempotência e erros estão no [guia do backend](README.md). Os schemas ficam em [identity-merge-api.ts](../../packages/contracts/src/identity-merge-api.ts).

Unificar reconhece que dois cadastros são a mesma pessoa ou o mesmo núcleo. Não é mudança real de família, para a qual existem a transferência e a [reconciliação composta](membership-reconciliation.md). Semelhança nunca unifica sozinha: o operador pede a prévia, resolve cada conflito e confirma com motivo.

## Rotas e permissões

| Método | Caminho sob `/api/v1`      | Resultado                                                           |
| ------ | -------------------------- | ------------------------------------------------------------------- |
| POST   | `/identity-merges/preview` | 200, comparação e conflitos; não grava e dispensa `Idempotency-Key` |
| POST   | `/identity-merges`         | 201, mapeamento e destino atualizado; exige `Idempotency-Key`       |

Ambas exigem `registration.merge`, que Coordenação e Assistência Social possuem. Responsável por Atividade e Administrador recebem 403. Nenhuma outra permissão é exigida, mesmo quando a unificação reconcilia inscrições ou marcações.

## Prévia

```json
{ "entityType": "PERSON", "sourceId": "…", "targetId": "…" }
```

`sourceId` é o cadastro que deixa de ser canônico; `targetId` é o que permanece. Os dois precisam existir e ainda não ter sido unificados; caso contrário, 404. Identidades iguais retornam 422 `MERGE_SAME_IDENTITY`.

| Campo da resposta                                                       | Significado                                                                     |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `expectedSourceRevision`, `expectedTargetRevision`, `sourceFingerprint` | Devolver sem alteração na confirmação                                           |
| `fieldConflicts`                                                        | Campos informados nos dois lados com valores diferentes; cada um exige escolha  |
| `adoptedFields`                                                         | Campos que só a origem informa; complementam o destino automaticamente          |
| `membershipConflicts`                                                   | Pares de vínculos sobrepostos da mesma pessoa; `sameGroup` indica mesma família |
| `enrollmentConflicts`                                                   | Pares de inscrições sobrepostas na mesma atividade                              |
| `attendanceConflicts`                                                   | Duas marcações da mesma pessoa no mesmo encontro; `statusesDiffer` exige motivo |
| `sizeProfileConflict`                                                   | Os dois perfis de tamanhos, quando ambos existem                                |
| `referenceConflicts`                                                    | Dois titulares simultâneos no núcleo unificado (somente famílias)               |
| `memberships`, `enrollments`, `attendances`                             | Registros envolvidos, para montar as resoluções                                 |
| `issueIds`                                                              | Ocorrências abertas de possível duplicidade que serão resolvidas como `MERGED`  |
| `preserved`                                                             | Quantas fichas e avaliações continuam apontando para a origem, sem alteração    |

## Confirmação

```json
{
  "entityType": "PERSON",
  "sourceId": "…",
  "targetId": "…",
  "expectedSourceRevision": 1,
  "expectedTargetRevision": 2,
  "expectedSourceFingerprint": "…",
  "fieldSelections": { "name": "TARGET" },
  "membershipResolutions": [
    {
      "id": "…",
      "action": "KEEP",
      "validFrom": "2026-01-01T03:00:00Z",
      "validUntil": null
    },
    { "id": "…", "action": "SUPERSEDE", "supersededById": "…" }
  ],
  "enrollmentResolutions": [],
  "attendanceResolutions": [
    {
      "sessionId": "…",
      "effectiveAttendanceId": "…",
      "reason": "Synthetic paper list"
    }
  ],
  "sizeProfileResolution": { "keep": "SOURCE" },
  "reason": "Synthetic duplicate registration"
}
```

- **`fieldSelections`** traz exatamente os campos de `fieldConflicts`, cada um com `SOURCE` ou `TARGET`. Não há escolha padrão.
- **Resoluções de intervalo** (vínculos e inscrições) usam `KEEP`, com o intervalo final, ou `SUPERSEDE`, que marca o registro como duplicata de outro. Registros sem resolução ficam como estão.
- **`attendanceResolutions`** escolhe a marcação efetiva de cada encontro em conflito; `reason` é obrigatório quando os status divergem.
- **`sizeProfileResolution`** é obrigatório quando há `sizeProfileConflict` e proibido quando não há.
- Listas omitidas equivalem a vazias; `sizeProfileResolution` omitido equivale a `null`.

Regras aplicadas às resoluções de intervalo:

1. Só se descarta como duplicata um intervalo da mesma família (ou atividade) inteiramente contido no intervalo final de quem o substitui.
2. Nenhum trecho que uma família cobria sozinha pode sumir nem passar para outra. Para `[janeiro, abril)` e `[março, junho)` na mesma família, o plano precisa manter janeiro–junho: estender um e descartar o outro.
3. Vínculos de famílias diferentes que se sobrepõem são aparados com `KEEP`; a soma dos períodos continua a mesma.
4. Ao final, a pessoa canônica não pode ter dois vínculos no mesmo instante, nem duas inscrições na mesma atividade.

Unificação de **famílias** aceita apenas `fieldSelections`: as demais resoluções devem estar vazias. Dois titulares simultâneos impedem a confirmação até serem corrigidos por `POST /families/:familyId/reference-changes` ou correção de vínculo.

| Resposta                      | `details.rule`                   | Situação                                                                        |
| ----------------------------- | -------------------------------- | ------------------------------------------------------------------------------- |
| 409 `REVISION_CONFLICT`       | —                                | Origem ou destino mudou; `details.currentRevision`                              |
| 409 `DOMAIN_CONFLICT`         | `MERGE_SOURCES_CHANGED`          | Algum histórico mudou depois da prévia; refaça-a                                |
| 409                           | `MERGE_RESOLUTION_REQUIRED`      | Falta resolver um conflito; `details.ids` aponta os registros                   |
| 409                           | `MERGE_REFERENCE_CONFLICT`       | Dois titulares simultâneos na família unificada                                 |
| 409                           | `MEMBERSHIP_ATTENDANCE_CONFLICT` | Um vínculo aparado deixaria marcação fora da vigência                           |
| 422 `BUSINESS_RULE_VIOLATION` | `MERGE_RESOLUTION_INVALID`       | Resolução que não corresponde a um conflito ou que perderia um trecho exclusivo |
| 404 `NOT_FOUND`               | —                                | Identidade inexistente ou já unificada                                          |

A resposta devolve `merge` (mapeamento imutável com `resolution`, que resume o que foi escolhido e substituído) e `target` (pessoa ou família canônica na nova revisão). Repetir a mesma chave e conteúdo devolve o mesmo resultado.

## O que a confirmação altera

Tudo ocorre em uma transação serializável; qualquer falha, inclusive de auditoria, desfaz o conjunto.

| Registro                                                           | Efeito                                                                                       |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Destino                                                            | Recebe os campos escolhidos e complementados; sempre ganha nova revisão                      |
| Origem                                                             | Recebe `mergedIntoId`; deixa de aparecer em buscas e listas                                  |
| Vínculos, inscrições e marcações efetivos da origem                | Passam a apontar para a identidade canônica, com nova revisão                                |
| Duplicatas descartadas                                             | Recebem `supersededById` e conservam conteúdo e identidade de origem; deixam de ser contadas |
| Marcações de um vínculo descartado                                 | Passam a referenciar o vínculo que o substitui, na mesma família                             |
| Encontros com marcação alterada e famílias com composição alterada | Ganham nova revisão                                                                          |
| Perfil de tamanhos                                                 | O destino recebe os valores escolhidos; o perfil da origem permanece como histórico          |
| Ocorrências de duplicidade entre os dois                           | Resolvidas como `MERGED`, com autor e motivo                                                 |
| Cobertura de encontros                                             | Invalidada nos trechos em que um intervalo efetivo mudou                                     |
| Fichas sociais e avaliações de aptidão                             | **Não são alteradas**; continuam com a identidade original                                   |

Cada alteração gera `AuditEntry` com ação `MERGE`, motivo, autor e valores anterior e novo, na mesma operação. O mapeamento é auditado como `IdentityMerge` (`audit.read` e `registration.read`).

Decisão técnica desta implementação: os fatos mutáveis são reapontados para a identidade canônica em vez de permanecerem na origem. Assim as restrições do PostgreSQL continuam impedindo vínculos ou inscrições sobrepostos para a pessoa canônica depois da unificação, e frequência, aptidão e contagem de membros não contam duas vezes. A proveniência fica no mapeamento, nos registros substituídos e na auditoria.

## Depois da unificação

- `GET /people/:id` e `GET /families/:id` com o ID da origem devolvem o cadastro canônico; compare o `id` da resposta com o solicitado para detectar o redirecionamento.
- `GET /families?code=` com o código da origem devolve a família canônica. O código não é reciclado.
- Comandos endereçados à origem retornam 404; use o ID canônico.
- A [ficha social](social-forms.md) lista as versões das duas origens com `originFamilyId/originalVersion`; a próxima publicação usa o namespace canônico.
- Avaliações de [aptidão](eligibility.md) salvas não mudam; uma nova avaliação já usa a identidade canônica e conta cada presença uma vez.
- Não há operação para desfazer uma unificação.

## Verificação

Testes unitários cobrem as regras de reconciliação e o caso de uso. A integração PostgreSQL/Redis cobre CAD-AC07/08/09/12/13/15/18 e APT-AC13: unificação sem conflitos, marcações divergentes, sobreposição parcial, tamanhos, inscrições duplicadas, fichas das duas origens, rollback por falha de auditoria, replay e autorização. A interface desta operação ainda não existe.
