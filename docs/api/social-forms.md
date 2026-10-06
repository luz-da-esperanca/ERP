# Referência HTTP da ficha social

Backend de [SPEC-FIC](../specs/03-social-forms.md). Os contratos públicos estão em [social-forms-api.ts](../../packages/contracts/src/social-forms-api.ts), por `@erp/contracts/social-forms-api`; chaves e tipos compartilhados estão em [social-form-fields.ts](../../packages/contracts/src/social-form-fields.ts). Sessão, cabeçalhos, envelopes e erros comuns seguem o [guia do backend](README.md). O [guia de integração](integrating-social-forms.md) apresenta o fluxo de publicação.

## Rotas e autorização

Prefixo `/api/v1`. Coordenação e Assistência Social têm `socialForms.read` e `socialForms.write`. Somente Coordenação tem `featureDecisions.manage`. Administrador ou Responsável por Atividade isolados não recebem ficha social. Uma definição de campo restringe os perfis existentes; não concede novas capacidades.

| Método / caminho                          | Capacidade                | Resposta                            |
| ----------------------------------------- | ------------------------- | ----------------------------------- |
| `GET /families/:id/social-form-context`   | `socialForms.read`        | 200, contexto para publicação       |
| `GET /families/:id/social-forms`          | `socialForms.read`        | 200, página de metadados            |
| `POST /families/:id/social-forms`         | `socialForms.write`       | 201, versão publicada               |
| `GET /social-forms/:id`                   | `socialForms.read`        | 200, versão projetada               |
| `POST /social-forms/:id/acknowledgements` | `socialForms.write`       | 201, ciência registrada/corrigida   |
| `GET /social-form-fields`                 | `socialForms.read`        | 200, seleção e catálogos permitidos |
| `POST /social-form-field-selections`      | `featureDecisions.manage` | 201, nova seleção completa          |
| `POST /social-form-options`               | `featureDecisions.manage` | 201, opção criada                   |
| `PATCH /social-form-options/:id`          | `featureDecisions.manage` | 200, opção atualizada               |
| `POST /feature-decisions/:code`           | `featureDecisions.manage` | 200, decisão configurada            |

Todas as escritas exigem `Idempotency-Key` UUID. Autor ativo, versão da autenticação, troca de senha e capacidades atuais são revalidados dentro da transação antes de escrita ou replay. A mesma chave/autor/conteúdo recupera o resultado original; outra intenção retorna `409 IDEMPOTENCY_CONFLICT`. O resultado da ficha é sempre projetado segundo acesso, seleção e flags atuais, inclusive no replay.

## Configuração de campos e decisões

A instalação cria catálogos candidatos, sem seleção de campos nem flags habilitadas. Antes de publicar, Coordenação cria uma seleção por `POST /social-form-field-selections`:

```json
{
  "expectedRevision": null,
  "decisionReference": "SYNTHETIC-EVALUATION",
  "reason": "Configuração para avaliação com dados sintéticos",
  "fields": [
    {
      "fieldKey": "housing.roomCount",
      "included": true,
      "required": false,
      "appliesTo": "FAMILY",
      "allowedRoleCodes": ["COORDINATION", "SOCIAL_ASSISTANCE"],
      "cardinality": "SINGLE",
      "purpose": "Avaliar a estrutura da ficha com dados sintéticos",
      "decisionReference": "SYNTHETIC-EVALUATION"
    }
  ]
}
```

`expectedRevision` compara a versão global da seleção, ou `null` na primeira. Cada alteração publica uma coleção completa e imutável. Chave omitida da coleção fica excluída; não é um PATCH. As chaves e os tipos são fixos, conforme SPEC-FIC; não há criação de campos arbitrários. `required=true` exige `included=true`. Campos familiares usam `FAMILY`; individuais usam `ALL_MEMBERS`, `REFERENCE_MEMBER` ou `SELECTED_MEMBERS`. Saúde/medicamentos são limitados a `REFERENCE_MEMBER`. Para `SELECTED_MEMBERS`, a publicação declara `selectedFieldKeys` por pessoa. Cardinalidade múltipla cabe somente em catálogos ou medicamentos.

Em seguida, habilite o bloco por `POST /feature-decisions/FIC_HOUSING`:

```json
{
  "enabled": true,
  "expectedRevision": null,
  "decisionReference": "SYNTHETIC-EVALUATION",
  "reason": "Habilitação para avaliação com dados sintéticos"
}
```

Os códigos são `REAL_PERSONAL_DATA`, `FIC_HOUSING`, `FIC_ECONOMY`, `FIC_NEEDS`, `FIC_SITUATION`, `FIC_EDUCATION`, `FIC_HEALTH`, `FIC_MEDICATION` e `FIC_RELIGION`. Habilitar bloco exige campo incluído na seleção; os três blocos protegidos também exigem chave de criptografia disponível. Em `DATA_MODE=REAL`, a decisão global é exigida na inicialização, em cada requisição e nas transações de FIC. Registre decisões enquanto o ambiente permanece sintético; uma referência sintética não constitui aprovação institucional. DEC-05/08 continuam condicionando o uso real.

`GET /social-form-fields` retorna `selection`, `options` e `decisions`. A coleção `selection.fields` contém somente campos incluídos, habilitados e permitidos ao operador; catálogos seguem esse mesmo filtro, incluindo opções inativas para identificação. `decisions` é retornado somente à Coordenação. A resposta não representa a matriz administrativa completa: conserve a seleção publicada para editá-la ou consulte sua auditoria autorizada (`entityType=FieldSelectionVersion`).

Criar opção recebe `{ fieldKey, code, label, active?, isOther?, decisionReference }`. `active` inicia em `true`, `isOther` em `false`; `fieldKey/code` é único. Atualizar recebe `{ expectedRevision, label?, active?, decisionReference, reason }`; código/campo não mudam. Motivo e referência são registrados juntos na auditoria e, com os três caracteres de separação, devem caber em 2.000 caracteres. Labels publicados são capturados do catálogo pelo servidor. Desativação impede novas escolhas e preserva os labels das fichas anteriores. Opções `isOther=true` aceitam `otherText` opcional, desconhecido quando ausente.

## Prévia e publicação

`GET /families/:id/social-form-context?occurredAt=...` exige instante com offset e não futuro. Retorna família canônica, composição válida nessa data, revisões verificadas, seleção/catálogos permitidos e `latestForm`. A identidade individual transporta apenas `id`, `name`, `birthDate`, `sex` e `revision`; não inclui CPF/RG. A prévia não grava ficha, ciência, auditoria nem operação.

`latestPublishedFormId` identifica a última publicação da lista consolidada. `expectedPreviousVersionId` identifica a última publicação do namespace canônico, ou `null`; são bases distintas após aliases de família. `memberRevisions` contém cada pessoa da composição uma vez, com revisões de cadastro/vínculo e a base de tamanhos, inclusive a ausência (`null`).

O POST recebe:

```typescript
type Publication = {
  occurredAt: string;
  expectedFamilyRevision: number;
  expectedPreviousVersionId: string | null;
  fieldSelectionVersionId: string;
  memberRevisions: {
    personId: string;
    expectedPersonRevision: number;
    membershipId: string;
    expectedMembershipRevision: number;
    sizeProfilePersonId?: string | null;
    expectedSizeRevision?: number | null;
  }[];
  referencePersonId?: string | null;
  blocks: object;
  members: object[];
  acknowledgement?: {
    referencePersonId: string;
    method: 'PAPER_SIGNATURE';
    acknowledgedOn: string;
  };
  correctionOfFormId?: string;
  reason?: string;
};
```

Use `publishSocialFormSchema` para os tipos exatos de `blocks/members`. O servidor aceita IDs/revisões, nunca snapshots enviados pelo cliente. Valida todas as fontes e captura a composição completa, ainda que `members` omita quem não possui valores sociais. Dados de um membro enviado devem pertencer à composição. Tamanhos são capturados somente quando ambos os campos de base são enviados; `null/null` verifica a inexistência na prévia. Se mais de um perfil de alias existir sem base canônica reconciliada, o contexto retorna conflito em vez de escolher arbitrariamente.

Blocos familiares: `housing`, `economy`, `needs`, `situation`. Blocos individuais: `economy`, `education`, `health`, `medications`, `religion`. Para campos selecionados e permitidos, omissão se torna `null`; `0`, `false` e `[]` permanecem declarações explícitas. Texto opcional vazio após trim vira `null`. Renda usa string decimal, por exemplo `"0"` ou `"150.50"`; não há soma, per capita nem periodicidade presumida. Coleções de escolhas usam `{ code, otherText? }`, com label capturado do catálogo. O limite de cardinalidade da matriz é aplicado na publicação.

Cada publicação reserva a próxima `version` daquela família, independentemente da data do fato. A resposta distingue `occurredAt` de `recordedAt/recordedBy` e conserva snapshots de família, pessoa, vínculo, titularidade e tamanhos. Instantes são normalizados em UTC. Alterações posteriores em CAD não reescrevem esses snapshots.

Correção publica outra versão completa com `correctionOfFormId` e `reason` obrigatório. A ficha corrigida pode ser antiga ou de uma origem unificada; deve pertencer à família canônica consultada. `expectedPreviousVersionId` continua protegendo a sequência atual. Não há PATCH ou exclusão de conteúdo publicado.

## Histórico e ciência

A lista aceita `page`, `pageSize` e `orderBy=recordedAt|occurredAt`. Padrão: `recordedAt desc`, `familyId asc`, `version desc`, `id asc`. Com `orderBy=occurredAt`, a data do fato antecede os desempates de publicação. Lista retorna metadados sem blocos ou motivos; detalhe retorna a versão projetada.

Origens preservam `familyId/version`; `originFamilyId/originalVersion` indicam proveniência na lista consolidada e no detalhe. A próxima publicação usa o namespace canônico. A [unificação de CAD](identity-merges.md) marca a origem sem alterar nenhuma ficha publicada.

Ciência ausente é `null`. `POST /social-forms/:id/acknowledgements` recebe `{ expectedRevision, referencePersonId, method: 'PAPER_SIGNATURE', acknowledgedOn, reason? }`. Pessoa pertence àquela versão, data civil é conhecida e não futura; autoria é a conta autenticada. Correção de ciência exige motivo e incrementa sua revisão. O conteúdo da ficha permanece imutável. O detalhe retorna a ciência atual; replay da publicação conserva a ciência que compunha seu resultado original.

## Proteção e auditoria

Leitura cruza seleção da publicação, seleção atual, perfis atuais, escopo por membro e flags. Campos fora desse acesso são omitidos. Se parte do conteúdo fica oculta, o motivo da ficha também é omitido. Reativação de leitura deve ser sustentada pela decisão institucional pertinente.

Saúde, medicamentos e religião ficam em envelopes AES-256-GCM por ficha/versão/membro/bloco, com nonce aleatório, `keyId` e contexto autenticado. Auditoria guarda os mesmos envelopes. A descriptografia ocorre apenas depois de verificar acesso. Payload adulterado ou chave ausente falha sem liberar plaintext parcial; envelopes nunca são DTOs públicos. As operações FIC usam comparação HMAC, sem gravar corpo de requisição no registro de idempotência.

Configure `SOCIAL_FORM_CURRENT_KEY_ID` e `SOCIAL_FORM_KEYS_JSON` somente quando habilitar os blocos protegidos; veja [.env.example](../../.env.example). Chaves têm exatamente 32 bytes em base64, são independentes de JWT/HMAC e devem ser geradas separadamente. Ao rotacionar, altere o ID corrente e mantenha as chaves antigas necessárias para as versões anteriores. Sem chave, os demais blocos podem operar; flags protegidas não podem ser habilitadas.

`SocialForm` e `Acknowledgement` usam classificação `SOCIAL_FORMS`, exigindo `audit.read` e `socialForms.read`. `FieldSelectionVersion`, `SocialFormOption` e `FeatureDecision` usam `FEATURE_DECISIONS`, exigindo `audit.read` e `featureDecisions.manage`. Conteúdo social da auditoria passa pela mesma projeção do detalhe. Evento sem campo social visível sai antes da contagem/paginação; seu detalhe retorna 404. Motivos parcialmente ocultos não aparecem.

Publicação, membros, ciência inicial, auditoria e conclusão da operação confirmam na mesma transação PostgreSQL serializable. Configuração/publicação compartilham bloqueio transacional para impedir corrida entre habilitação e escrita; o autor é bloqueado primeiro. Restrições e triggers preservam unicidade, predecessor no namespace correto, membro de referência e imutabilidade. Redis participa somente do acesso, sem guardar fichas.

## Erros e validação

| HTTP / código                 | Regra ou detalhe                                                                                    | Ação                                                                       |
| ----------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 400 `VALIDATION_ERROR`        | `fields`                                                                                            | Corrigir formato, snapshots do cliente, duplicatas ou campos desconhecidos |
| 409 `REVISION_CONFLICT`       | `currentRevision`                                                                                   | Atualizar a fonte e revisar a intenção                                     |
| 409 `DOMAIN_CONFLICT`         | `PREVIOUS_VERSION_CHANGED`, `FIELD_SELECTION_CHANGED`, `MEMBERSHIP_CHANGED`, `SIZE_PROFILE_CHANGED` | Reconsultar contexto completo                                              |
| 409 `DOMAIN_CONFLICT`         | `SIZE_PROFILE_RECONCILIATION_REQUIRED`                                                              | Resolver explicitamente a base cadastral                                   |
| 422 `BUSINESS_RULE_VIOLATION` | `BLOCK_DISABLED`, `FIELD_NOT_ALLOWED`                                                               | Ajustar entrada à matriz e às flags atuais                                 |
| 422 `BUSINESS_RULE_VIOLATION` | `REQUIRED_FIELD_MISSING`, `INVALID_OPTION`, `INVALID_CARDINALITY`                                   | Revisar os valores declarados                                              |
| 422 `BUSINESS_RULE_VIOLATION` | `DECISION_DEPENDENCY`, `INVALID_FIELD_SELECTION`                                                    | Revisar seleção, perfis e chaves antes de habilitar                        |
| 422 `BUSINESS_RULE_VIOLATION` | `FUTURE_FACT`, `INVALID_ACKNOWLEDGEMENT`, `INVALID_CORRECTION`                                      | Revisar data, pessoa e motivo                                              |

401/403/404, idempotência e indisponibilidade seguem CORE. Traduza mensagens para pt-BR por código/regra, preservando `requestId`.

```bash
pnpm test test/features/social-forms packages/contracts/test/social-forms-api.test.ts
TEST_DATABASE_URL=postgresql://erp:erp_test_only@localhost:55432/erp_test \
TEST_REDIS_URL=redis://localhost:56379 \
pnpm test:integration test/features/social-forms
```

Prepare serviços exclusivos conforme o [README](../../README.md#validar). Os testes de integração escritos abrangem concorrência, rollback, imutabilidade, tamanhos, origens, escolhas e auditoria protegida. Nesta entrega, sua execução ficou impedida pela indisponibilidade do PostgreSQL de teste e do daemon Docker; essas garantias ainda precisam de validação real no ambiente de integração. Regras/contratos/criptografia foram validados localmente. Documentação foi revisada por conteúdo e links, sem testes que fixem redação. A UI permanece sem integração HTTP; a aprovação institucional não é comprovada por estes testes.
