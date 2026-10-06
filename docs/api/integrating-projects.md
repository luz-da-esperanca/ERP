# Como integrar projetos, atividades e inscrições

Guia para desenvolvedores da interface ou outro cliente autorizado do MVP. O objetivo é substituir chamadas em memória por HTTP, preservando sessão, revisões e repetição segura. Consulte a [referência de ATV](projects.md) para todos os campos e a [integração comum](README.md) para autenticação e erros.

## Preparação

1. Instale Node 24.18.0 e pnpm conforme o [README](../../README.md); configure PostgreSQL/Redis, aplique `pnpm db:migrate`, execute o bootstrap e mantenha `DATA_MODE=SYNTHETIC`.
2. Uma conta Administrador administra contas; para operar ATV, atribua `COORDINATION` à conta apropriada. Complete a troca obrigatória de senha e faça novo login.
3. Sirva SPA e `/api` pela mesma origem. Configure o proxy de desenvolvimento no cliente; `APP_ORIGIN` precisa refletir a origem da SPA. O Vite atual ainda não fornece esse proxy.
4. Importe contratos de `@erp/contracts/projects-api`. Preserve os adaptadores de demonstração apenas como demonstração; não os use como comprovação de persistência.

## Ordem de integração

| Tela/fluxo     | Consulta e escrita                                                                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catálogos      | Consultar `/institutes` e `/service-types`; para seleção nova, filtrar `active=true`; manter catálogos completos para interpretar associações antigas         |
| Projetos       | Listar `/projects`; criar projeto com instituto escolhido; abrir `/projects/:id` para cadastro, revisão e atividades                                          |
| Atividade      | Criar por `/projects/:id/activities` com revisão atual do projeto; abrir `/activities/:id` com referência explícita quando consultar participantes históricos |
| Participantes  | Selecionar pessoa por CAD (`/people`), consultar inscrições paginadas e criar com revisão atual da atividade                                                  |
| Correção/saída | Usar revisão da própria inscrição, motivo e datas; recarregar a atividade após alteração                                                                      |
| Encerramento   | Mostrar histórico e inscrições conhecidas, pedir corte/motivo e enviar revisão do alvo; os efeitos efetivos vêm nos arrays da resposta                        |
| Auditoria      | Consultar `/audit-entries?entityType=...&entityId=...`; usar `operationId` para correlacionar alterações compostas                                            |

Essas telas são orientações para a integração futura; não foram implementadas nesta entrega. A seleção de responsável recebe UUID de conta existente. Monte o seletor com `GET /responsible-candidates`, que exige `projects.write` ou `attendance.write` e devolve apenas `id`, `displayName` e `active` das contas ativas com perfil Coordenação ou Responsável por Atividade; `q` filtra pelo nome. Para mostrar o nome de um responsável já gravado, inclusive de conta desativada, use `?ids=`. `/users` continua exigindo `accounts.manage` e não deve ser usado para isso.

## Cliente HTTP com validação de resposta

O exemplo roda no navegador, depois da autenticação. O cookie é HttpOnly; não copie o JWT para storage. `Origin` é enviado pelo navegador. O schema recebe o envelope completo, incluindo paginação quando aplicável.

```typescript
import { z } from 'zod';
import {
  institutesPageSchema,
  projectDtoSchema,
  activityDtoSchema,
  enrollmentDtoSchema,
  activityDetailSchema,
} from '@erp/contracts/projects-api';

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

function writeOptions(
  method: 'POST' | 'PATCH',
  key: string,
  payload: unknown,
): RequestInit {
  return {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-ERP-Request': '1',
      'Idempotency-Key': key,
    },
    body: JSON.stringify(payload),
  };
}

const institutes = await request(
  '/institutes?active=true',
  { method: 'GET' },
  institutesPageSchema,
);
const institute = institutes.data.find((item) => item.code === 'CHARITY');
if (!institute) throw new Error('An active institute is required');

// Retain each command and key until its outcome is known.
const projectCommand = writeOptions('POST', crypto.randomUUID(), {
  name: 'Projeto de demonstração',
  instituteId: institute.id,
});
const { data: project } = await request(
  '/projects',
  projectCommand,
  z.object({ data: projectDtoSchema }),
);

const activityCommand = writeOptions('POST', crypto.randomUUID(), {
  expectedProjectRevision: project.revision,
  name: 'Oficina de demonstração',
  nature: 'PERIODIC',
});
const { data: activity } = await request(
  `/projects/${project.id}/activities`,
  activityCommand,
  z.object({ data: activityDtoSchema }),
);

async function enrollParticipant(personId: string, validFrom: string) {
  const current = await request(
    `/activities/${activity.id}`,
    { method: 'GET' },
    z.object({ data: activityDetailSchema }),
  );
  const enrollmentCommand = writeOptions('POST', crypto.randomUUID(), {
    expectedActivityRevision: current.data.activity.revision,
    personId,
    validFrom,
  });
  return {
    command: enrollmentCommand,
    path: `/activities/${activity.id}/enrollments`,
    schema: z.object({ data: enrollmentDtoSchema }),
  };
}
```

`enrollParticipant` prepara a intenção; guarde o objeto retornado no estado do fluxo e execute `request(prepared.path, prepared.command, prepared.schema)`. O `personId` vem da busca autorizada de CAD, e `validFrom` deve corresponder a um instante conhecido em que o vínculo familiar existia. Se a resposta se perder, repita o mesmo comando; não invoque novamente a preparação para gerar outra chave. Em produção, organize essas funções no adaptador HTTP da feature, com tratamento dos estados de UI.

O exemplo inicia novos registros sintéticos e não deve ser repetido integralmente como mecanismo de retry. As consultas e os comandos são independentes; guarde cada intenção antes de enviá-la.

## Conflitos e atualização da tela

| Resultado                  | Ação do cliente                                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Timeout/erro de rede       | Manter corpo e chave; repetir a mesma intenção                                                                                  |
| `409 IDEMPOTENCY_CONFLICT` | Conferir autor/alvo/conteúdo; nova intenção precisa de nova chave                                                               |
| `409 REVISION_CONFLICT`    | Reconsultar, mostrar a diferença e obter confirmação da alteração; preparar nova intenção com revisão atual                     |
| `409 DOMAIN_CONFLICT`      | Mostrar orientação por `details.rule`; consultar registros de `details.ids`; não apagar fatos nem ajustar datas automaticamente |
| 400/422                    | Corrigir campos/regra; preparar outra intenção                                                                                  |
| 401                        | Recuperar o fluxo de login; não apresentar escrita como concluída                                                               |
| 403                        | Atualizar capacidades e explicar a restrição                                                                                    |
| 503                        | Mostrar indisponibilidade e manter intenção pendente para retry                                                                 |

Traduza códigos e regras para pt-BR. Não renderize `error.message` como mensagem institucional. Após uma escrita, recarregue os agregados afetados: criar atividade muda a revisão do projeto; inscrição muda a revisão da atividade; cascata muda vários registros. Uma resposta de replay contém revisões **originais**, e pode ser mais antiga que a tela atual.

Uma atividade encerrada mantém consulta e admite inscrição/correção histórica dentro dos limites. A UI deve separar o instante do fato do lançamento atual. A ausência de inscrição não representa ausência em encontro. Somente periódicas recebem o [fluxo de encontros de FRQ](integrating-attendance.md). Alterações de vigência/corte podem conflitar com encontros concluídos; mostre os IDs indicados para revisão explícita. Alterações de inscrição podem abrir lacunas na cobertura do trecho afetado; recarregue a consulta de cobertura quando a tela a exibir.

## Frentes posteriores

- **CAD transversal:** reconciliar inscrições sobrepostas por identidade canônica durante unificação, preservando aliases e histórico.
- **Interface:** implementar adaptador HTTP e estados de carregamento, vazio, erro, conflito e sucesso; conectar autenticação real e autorização por capacidades.
- **APT/REL:** consumir frequência e políticas próprias; inscrição não comprova aptidão nem atendimento realizado.

Essas frentes usam os contratos implementados, mas seus módulos e telas continuam pendentes. FRQ já compartilha bloqueios e invariantes de ATV no backend; a interface integra os dois módulos pelos respectivos guias. As condições institucionais de uso real permanecem no [índice das specs](../specs/README.md).
