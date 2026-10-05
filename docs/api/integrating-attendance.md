# Como integrar a chamada e a cobertura

Guia para a frente de frontend conectar a API de FRQ. Pressupõe autenticação por cookie, mesma origem, projeto/atividade periódica e pessoas sintéticas já cadastradas. Consulte a [referência HTTP](attendance.md) para DTOs e erros e o [guia comum](README.md) para preparar o ambiente. As telas atuais ainda usam memória; este documento não declara integração da UI.

## Fluxo da chamada

1. Escolha atividade e instante do fato. Abrir a tela não cria encontro.
2. Consulte `attendance-context`, incluindo todos os avulsos selecionados. Mostre cada linha inicialmente como “Não registrado”; use a marcação existente ao editar um encontro.
3. Permita escolher “Presente” ou “Ausente” explicitamente. Omitir uma pessoa mantém informação desconhecida.
4. Para confirmação, capture os IDs/revisões da prévia, fingerprint e seleção de avulsos; gere uma chave para essa intenção. Conserve chave e corpo até receber resultado ou resolver conflito.
5. Envie o POST. Sucesso retorna encontro e chamada. Mostre separadamente data do fato e do lançamento. Em perda de resposta, repita a intenção capturada.
6. Para corrigir depois, abra o encontro existente e use PUT/PATCH; recarregue o contexto após cada alteração efetiva.

Pessoa sem vínculo válido não pode ser marcada. Operador com acesso a CAD regulariza o cadastro na data correta; o fluxo da chamada não inventa família nem cria inscrição automaticamente.

## Cliente com validação de contratos

Exemplo independente para o navegador, após login. `loadContext` é leitura; `captureSessionIntent` captura somente escolhas explícitas; `confirmSession` pode ser repetido com a mesma intenção após timeout. Passe `responsibleId` de uma conta conhecida. A capacidade de FRQ não concede listagem administrativa de contas; o operador pode usar sua própria conta ou uma designação conhecida da atividade.

```typescript
import { z } from 'zod';
import {
  attendanceContextSchema,
  createSessionSchema,
  sessionResultSchema,
  type AttendanceContextDto,
} from '@erp/contracts/attendance-api';

const failureSchema = z.object({
  error: z.object({
    code: z.string(),
    requestId: z.string(),
    details: z.unknown().optional(),
  }),
});

class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly requestId: string,
    readonly details: unknown,
  ) {
    super(`API request failed: ${code} (${requestId})`);
  }
}

async function request<T>(
  path: string,
  options: RequestInit,
  schema: z.ZodType<T>,
): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    ...options,
    credentials: 'include',
  });
  const value: unknown = await response.json();
  if (!response.ok) {
    const { error } = failureSchema.parse(value);
    throw new ApiRequestError(
      response.status,
      error.code,
      error.requestId,
      error.details,
    );
  }
  return schema.parse(value);
}

export async function loadContext(
  activityId: string,
  occurredAt: string,
  guestPersonIds: string[] = [],
) {
  const query = new URLSearchParams({ occurredAt });
  if (guestPersonIds.length)
    query.set('guestPersonIds', guestPersonIds.join(','));
  const response = await request(
    `/activities/${activityId}/attendance-context?${query}`,
    { method: 'GET' },
    z.object({ data: attendanceContextSchema }),
  );
  return response.data;
}

type MarkingChoice = {
  personId: string;
  status: 'PRESENT' | 'ABSENT';
};

export function captureSessionIntent(
  context: AttendanceContextDto,
  responsibleId: string,
  choices: MarkingChoice[],
  guestPersonIds: string[] = [],
) {
  const entries = choices.map((choice) => {
    const row = context.rows.find((item) => item.personId === choice.personId);
    if (
      !row ||
      !row.familyId ||
      !row.membershipId ||
      row.expectedFamilyRevision === null ||
      row.expectedMembershipRevision === null
    ) {
      throw new Error('Participant context is unresolved');
    }
    return {
      ...choice,
      expectedPersonRevision: row.expectedPersonRevision,
      familyId: row.familyId,
      expectedFamilyRevision: row.expectedFamilyRevision,
      membershipId: row.membershipId,
      expectedMembershipRevision: row.expectedMembershipRevision,
    };
  });
  const payload = createSessionSchema.parse({
    occurredAt: context.occurredAt,
    responsibleId,
    expectedActivityRevision: context.expectedActivityRevision,
    expectedRosterFingerprint: context.rosterFingerprint,
    guestPersonIds,
    entries,
  });
  return {
    path: `/activities/${context.activityId}/sessions`,
    key: crypto.randomUUID(),
    body: JSON.stringify(payload),
  };
}

export function confirmSession(
  intent: ReturnType<typeof captureSessionIntent>,
) {
  return request(
    intent.path,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-ERP-Request': '1',
        'Idempotency-Key': intent.key,
      },
      body: intent.body,
    },
    z.object({ data: sessionResultSchema }),
  );
}
```

O navegador envia `Origin`; cookies permanecem HttpOnly. Passe a mesma seleção de avulsos para prévia e captura, inclusive os não marcados. Renove a prévia quando adicionar/remover avulsos ou mudar o horário. A intenção deve ser guardada pelo chamador antes de enviar; regenerar chave a cada retry pode criar outro encontro. O exemplo não implementa persistência local de rascunhos nem autorização de interface.

## Edição e conflitos

Para editar, consulte `GET /sessions/:id`. `data.context.rosterFingerprint` e `data.session.revision` servem para o próximo PUT. Linha existente envia sua revisão e status; primeira marcação envia `expectedRevision:null` e os campos históricos da linha do contexto. Ambas exigem motivo. Não preencha família usando o cadastro atual.

Ao mudar horário, consulte `attendance-context` com `sessionId` e o novo `occurredAt`. Compare com o contexto anterior e revise todas as marcações que mudaram de família/vínculo; envie a lista `contextCorrections` e o fingerprint novo no PATCH. Se precisar alterar também os intervalos de composição, siga a [reconciliação composta](membership-reconciliation.md).

| Resposta                    | Comportamento da tela                                                               |
| --------------------------- | ----------------------------------------------------------------------------------- |
| 401                         | Recuperar autenticação; preservar a intenção até decidir se será retomada           |
| 403                         | Atualizar capacidades e informar que a operação não está autorizada                 |
| 409 revisão/contexto/fontes | Reconsultar, apresentar diferença e capturar nova intenção após revisão do operador |
| 409 idempotência            | Revisar associação entre chave e intenção; não trocar a chave automaticamente       |
| 422 contexto/vigência       | Corrigir cadastro, data, atividade ou plano conforme a regra                        |
| Timeout/503                 | Manter intenção e permitir retry com mesma chave/corpo                              |

Cancelamento usa `/sessions/:id/cancellation`, revisão e motivo. A tela mantém o encontro histórico consultável, informa “Cancelado” e deixa de oferecer edição. Não crie outro encontro como forma de corrigir uma chamada anterior.

## Frequência e cobertura

Consulte `/people/:id/frequency?activityId=...&from=...&toExclusive=...`, com instantes completos codificados por `URLSearchParams`. Mostre total, presenças, ausências e não registrados, junto do período e unidade. Taxa `null` significa desconhecida; não substitua por zero. Exponha separadamente as três condições de completude e permita acessar as oportunidades que compõem o total. Filtro familiar usa o contexto histórico dos fatos.

Para declarar cobertura, implemente uma ação separada da chamada:

1. Escolha dias civis encerrados e consulte `/activities/:id/coverage?periodStart=...&periodEndExclusive=...`.
2. Mostre encontros/cancelamentos do período, declarações, lacunas e invalidações. Use as revisões/fontes recebidas.
3. Peça confirmação explícita de que todos os encontros realizados foram lançados e um motivo; a declaração não confirma marcações individuais.
4. Capture chave e payload com período, `expectedActivityRevision`, `expectedSourceFingerprint`, `confirmed:true`, `reason`; envie `/activities/:id/coverage-declarations`.
5. Recarregue cobertura e frequência. Inclusões/correções posteriores podem abrir lacunas parciais e exigir nova declaração.

Não confirme automaticamente a cobertura ao salvar chamada. Um recesso conhecido pode ter cobertura sem encontros; frequência com denominador zero continua sem percentual. Políticas e avaliações de aptidão são responsabilidade de APT, ainda pendente.
