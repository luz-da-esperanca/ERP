# Como integrar a publicação da ficha social

Guia para conectar a frente de frontend ao backend FIC. Pressupõe autenticação por cookie, mesma origem, conta com acesso social e família/pessoas sintéticas em CAD. Consulte a [referência HTTP](social-forms.md) para configuração, DTOs e erros. As telas existentes ainda usam memória.

## Preparar os campos

Coordenação publica uma seleção completa e habilita explicitamente os blocos necessários, conforme a referência. Use somente campos de finalidade aprovada; a avaliação sintética não libera dados reais. Instalação inicial não possui seleção nem flags habilitadas. Não substitua ausência de configuração por um formulário genérico que aceite dados arbitrários.

Para montar a tela, leia `/social-form-fields` ou a seleção/catálogos do contexto. Mostre apenas campos permitidos, com sua cardinalidade e aplicação por membro. Opções inativas podem identificar escolhas históricas; não devem ser oferecidas para nova seleção. Não acrescente saúde/religião a observações livres para contornar uma flag.

## Publicar a versão

1. Selecione família e data do fato; abrir a tela não publica ficha.
2. Consulte `/families/:id/social-form-context?occurredAt=...`. Use os membros dessa data e as revisões fornecidas.
3. Revise valores copiados de `latestForm`, removendo pessoas que não pertencem à nova composição. Confirme dados desconhecidos, zero e coleções vazias separadamente.
4. Capture corpo e uma chave UUID para a intenção. Envie a publicação completa, com a seleção/revisões do contexto e valores sociais permitidos.
5. Em timeout, repita o mesmo corpo/chave. Em conflito, recarregue o contexto, compare mudanças e gere outra intenção após revisão explícita.
6. Mostre versão, data do fato, data de lançamento e autor. Consulte histórico para distinguir última publicação de última por data do fato.

Rascunho fica apenas na memória da tela. Dados sensíveis não são persistidos em localStorage, IndexedDB ou armazenamento de sessão. Trocar a data exige reconstruir a composição e revisar as mudanças; não transporte silenciosamente o quadro familiar atual para o passado.

## Cliente com contratos públicos

Exemplo independente para o navegador, depois do login. `capturePublication` guarda exatamente o corpo serializado usado no replay; `submitPublication` mantém chave e corpo em memória. `values` contém somente blocos/membros revisados pelo operador. Usar os schemas no cliente não substitui autorização e validação do backend.

```typescript
import { z } from 'zod';
import {
  socialFormContextSchema,
  publishSocialFormSchema,
  socialFormDtoSchema,
  type SocialFormContextDto,
  type PublishSocialFormInput,
} from '@erp/contracts/social-forms-api';

const failureSchema = z.object({
  error: z.object({
    code: z.string(),
    requestId: z.string(),
    details: z.unknown().optional(),
  }),
});

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
    throw Object.assign(new Error(`API request failed: ${error.code}`), {
      status: response.status,
      code: error.code,
      requestId: error.requestId,
      details: error.details,
    });
  }
  return schema.parse(value);
}

export async function loadContext(familyId: string, occurredAt: string) {
  const query = new URLSearchParams({ occurredAt });
  const response = await request(
    `/families/${familyId}/social-form-context?${query}`,
    { method: 'GET' },
    z.object({ data: socialFormContextSchema }),
  );
  return response.data;
}

type SocialValues = Pick<PublishSocialFormInput, 'blocks' | 'members'>;

export function capturePublication(
  context: SocialFormContextDto,
  values: SocialValues,
  correction?: { formId: string; reason: string },
) {
  if (!context.fieldSelectionVersionId)
    throw new Error('Social field selection is unavailable');
  const payload = publishSocialFormSchema.parse({
    occurredAt: context.occurredAt,
    expectedFamilyRevision: context.expectedFamilyRevision,
    expectedPreviousVersionId: context.expectedPreviousVersionId,
    fieldSelectionVersionId: context.fieldSelectionVersionId,
    memberRevisions: context.memberRevisions,
    referencePersonId: context.referencePersonId,
    ...values,
    ...(correction
      ? {
          correctionOfFormId: correction.formId,
          reason: correction.reason,
        }
      : {}),
  });
  return {
    familyId: context.family.id,
    key: crypto.randomUUID(),
    body: JSON.stringify(payload),
  };
}

export async function submitPublication(
  intent: ReturnType<typeof capturePublication>,
) {
  const response = await request(
    `/families/${intent.familyId}/social-forms`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-ERP-Request': '1',
        'Idempotency-Key': intent.key,
      },
      body: intent.body,
    },
    z.object({ data: socialFormDtoSchema }),
  );
  return response.data;
}
```

O navegador envia `Origin` automaticamente. A aplicação deve usar o proxy de mesma origem descrito no [guia comum](README.md#preparar-o-ambiente-e-a-conta). Não derive `expectedPreviousVersionId` de `latestForm`: uma ficha copiada de outra origem não é predecessora do namespace atual.

## Corrigir e registrar ciência

Abra a versão antiga para revisão e publique outra versão completa, com sua própria composição na data escolhida, referência de correção e motivo. A ficha antiga permanece consultável. Não ofereça PATCH do conteúdo publicado.

Registre ciência somente quando pessoa, método e data são conhecidos. Use `PAPER_SIGNATURE`, data civil e pessoa pertencente à versão. Data desconhecida mantém ciência como “Não informado”; não use a data atual como substituta. Ciência posterior usa sua própria revisão/chave e não publica outra ficha. Sua correção exige motivo.

## Tratar respostas

- `401`: recuperar autenticação; `403`: atualizar a sessão/capacidades e respeitar o acesso vigente.
- `409 REVISION_CONFLICT` ou `DOMAIN_CONFLICT`: reler contexto e comparar mudanças sem reenviar automaticamente o rascunho antigo com revisões novas.
- `409 IDEMPOTENCY_CONFLICT`: a chave já representa outra intenção; revise a captura do corpo e da chave.
- `422`: usar `details.rule` para apontar configuração, campo, data ou ciência que precisa de revisão.
- Falha de transporte ou dependência: manter a intenção capturada em memória para uma tentativa posterior com a mesma chave.

DTO omite campos sem acesso; ausência de propriedade não significa `false`, zero ou valor apagado. Não preencha campos ocultos ao montar uma nova publicação. Exiba “Não informado” para `null`, e mantenha `[]` como declaração explícita de nenhuma escolha. Se a resposta perdeu um bloco após mudança de permissão/flag, remova seu conteúdo da tela e do rascunho.
