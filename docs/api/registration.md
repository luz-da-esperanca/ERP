# Cadastro: contratos entregues

Primeira etapa do backend de [SPEC-CAD](../specs/02-registration.md), com autorização de [ACS](../specs/01-access.md) e revisões de [AUD](../specs/08-audit.md). Leia as convenções de sessão, cabeçalhos, idempotência e erros no [guia de integração](README.md).

## Rotas e permissões

Todos os caminhos abaixo recebem o prefixo `/api/v1`. Escritas exigem chave de idempotência UUID.

| Método / caminho                                            | Permissão                                                           | Resposta                                                              |
| ----------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `GET /families`                                             | `registration.read`                                                 | 200, página de famílias com contagem e nome do titular em `asOf`      |
| `POST /families`                                            | `registration.write`                                                | 201, `FamilyDto`                                                      |
| `GET /families/:familyId`                                   | `registration.read`                                                 | 200, `{ family, members }`                                            |
| `PATCH /families/:familyId`                                 | `registration.write`                                                | 200, `FamilyDto`                                                      |
| `GET /people`                                               | `registration.read` ou `participants.lookup`                        | 200, página de cadastro ou identificação mínima                       |
| `POST /people`                                              | `registration.write`                                                | 201, `{ person, membership, family }`                                 |
| `GET /people/:personId`                                     | `registration.read` ou `participants.lookup`                        | 200, detalhe completo ou identificação mínima                         |
| `PATCH /people/:personId`                                   | `registration.write`                                                | 200, `PersonDto`                                                      |
| `POST /people/:personId/membership-transfers`               | `registration.write`                                                | 200, `{ previousMembership, membership, sourceFamily, targetFamily }` |
| `POST /people/:personId/membership-reconciliations/preview` | `registration.write`; também `attendance.write` se corrigir chamada | 200, plano final e conflitos, sem escrita                             |
| `POST /people/:personId/membership-reconciliations`         | `registration.write`; também `attendance.write` se corrigir chamada | 200, composição e chamada reconciliadas                               |
| `POST /families/:familyId/reference-changes`                | `registration.write`                                                | 200, `{ family, memberships }`                                        |
| `PATCH /memberships/:membershipId`                          | `registration.write`                                                | 200, `{ membership, family }`                                         |
| `POST /memberships/:membershipId/closure`                   | `registration.write`                                                | 200, `{ membership, family }`                                         |
| `PUT /people/:personId/sizes`                               | `registration.write`                                                | 200, perfil de tamanhos                                               |
| `GET /duplicate-candidates`                                 | `registration.read`                                                 | 200, array de candidatos com razões                                   |
| `GET /data-quality-issues`                                  | `registration.read`                                                 | 200, página de ocorrências                                            |
| `POST /data-quality-issues/:issueId/resolution`             | `registration.write`                                                | 200, ocorrência resolvida                                             |

Coordenação e Assistência Social têm leitura e escrita de CAD. Responsável por Atividade tem somente `participants.lookup`; Administrador isolado não recebe dados assistenciais. Perfis combinam capacidades; confira `GET /auth/session`.

Os schemas e tipos públicos estão em [registration-api.ts](../../packages/contracts/src/registration-api.ts), [data-quality-api.ts](../../packages/contracts/src/data-quality-api.ts) e [membership-reconciliation-api.ts](../../packages/contracts/src/membership-reconciliation-api.ts). Use esses contratos para montar o cliente; não importe modelos Prisma ou regras internas do backend. A prévia POST de reconciliação dispensa chave de idempotência; todas as confirmações/escritas exigem chave.

## Família e pessoa

`FamilyDto` contém `id`, `code`, `referenceName`, `address`, `neighborhood`, `postalCode`, `location`, `contactPhone`, `revision`, `createdAt` e `updatedAt`. Todos os dados cadastrais da família são opcionais. `location` aceita `URBAN`, `RURAL` ou `null`; CEP informado é normalizado em oito dígitos. Endereço admite 500 caracteres, nome/bairro 200 e telefone 50.

`POST /families` aceita os campos cadastrais e `duplicateReview` quando houver candidatos. `{}` cria uma família sem membros, com revisão 1. `PATCH` exige `expectedRevision` e pelo menos um campo cadastral. Não aceita código, titular ou lista de membros.

`PersonDto` contém `id`, `name`, `birthDate`, `sex`, `cpf`, `rg`, `occupation`, `educationLevel`, `contactPhone`, `revision`, `createdAt` e `updatedAt`. Nome é obrigatório; os demais dados podem ser desconhecidos. Nascimento informado não pode ser futuro no fuso institucional. Novos CPFs informados são normalizados em 11 dígitos, validados pelos dígitos verificadores e únicos entre pessoas canônicas; RG admite 30 caracteres, sexo/ocupação/escolaridade 100 e telefone 50. Essa validação não afirma autenticidade documental.

Para criar a pessoa, a família precisa existir. O cadastro da pessoa, seu primeiro vínculo, a nova revisão da família, a auditoria e a operação confirmam em uma transação:

```json
{
  "name": "Pessoa Sintética",
  "familyId": "00000000-0000-4000-8000-000000000001",
  "expectedFamilyRevision": 1,
  "validFrom": "2026-01-01T00:00:00-03:00",
  "relationshipToReference": null,
  "isReference": true
}
```

`POST /people` devolve `{ data: { person, membership, family } }`. Guarde os três IDs/revisões retornados; a família passa a revisão 2 neste exemplo. `isReference` omitido assume `false`, parentesco omitido permanece `null`; os demais dados desconhecidos também permanecem `null`. Família criada anteriormente continua válida e vazia se uma tentativa de criação de pessoa falhar.

`PATCH /people/:personId` exige `expectedRevision` e pelo menos um campo cadastral. Altera somente a pessoa; endereço e composição pertencem à família. CPF informado na criação ou edição é validado pelo value object `Cpf` e deve ter dígitos verificadores válidos. A API aceita 11 dígitos ou a máscara `000.000.000-00`, normalizando para dígitos. CPF de outra pessoa canônica retorna `409 DOMAIN_CONFLICT`, com regra `CPF_ALREADY_REGISTERED`; o CPF da própria pessoa pode ser mantido. `null` representa desconhecimento e não participa da unicidade. `POST /people` rejeita `duplicateReview` como chave desconhecida. Edição de nome/endereço da família mantém a consulta e o histórico de candidatos.

DTOs e snapshots existentes continuam legíveis, incluindo documentos registrados antes da validação dos dígitos verificadores. Novas criações e alterações de CPF devem obedecer à validação atual.

## Consultas e projeção mínima

`GET /families` aceita `q`, `code`, `asOf`, `page` e `pageSize`. `q` busca trecho de nome de referência/endereço sem distinguir caixa ou acentos; `code` usa igualdade e deve caber no bigint PostgreSQL. Ordenação: código crescente, depois ID. Cada item acrescenta `memberCount` e `referencePersonName` a `FamilyDto`.

`GET /families/:familyId?asOf=...` devolve família com esses mesmos campos calculados e `members: [{ person, membership }]`. Uma família sem titular conhecido tem `referencePersonName=null`; zero membros não é um dado manual. Na ausência de `asOf`, usa o instante da consulta.

`GET /people` aceita `q`, `birthDate`, `cpf`, `familyId`, `asOf`, `page` e `pageSize`. Nome usa trecho sem caixa/acentos; nascimento, CPF e família usam igualdade. O filtro familiar considera o vínculo vigente em `asOf`; padrão: instante atual. Ordenação: nome crescente, depois ID.

Com `registration.read`, a lista contém `PersonDto`. O detalhe contém `{ person, memberships, currentFamily, sizeProfile }`; `memberships` mantém os vínculos históricos em ordem de início/ID. `currentFamily` considera `asOf` e pode ser `null`; cadastro e tamanhos representam o estado conhecido atual, não uma reconstrução dos atributos naquela data. Para revisar valores anteriores, use a auditoria.

Com somente `participants.lookup`, lista e detalhe retornam exclusivamente:

```json
{
  "id": "00000000-0000-4000-8000-000000000002",
  "name": "Pessoa Sintética",
  "family": { "id": "00000000-0000-4000-8000-000000000001", "code": "1" }
}
```

`family` pode ser `null`. Não há documentos, nascimento, endereço, tamanhos ou histórico nessa projeção. Filtros `cpf`/`birthDate`, famílias completas, candidatos e ocorrências são negados a esse perfil, também no backend.

## Duplicidade e qualidade

`GET /duplicate-candidates` recebe `entityType=PERSON` e `name` e/ou `cpf`; `birthDate` complementa o sinal de nome. Para `entityType=FAMILY`, use `referenceName` e/ou `address`. Campos textuais exigem pelo menos dois caracteres. Retorno:

```json
{
  "data": [
    {
      "id": "00000000-0000-4000-8000-000000000002",
      "entityType": "PERSON",
      "reasons": ["CPF_MATCH"]
    }
  ]
}
```

Razões: `CPF_MATCH`, `NAME_BIRTH_MATCH`, `NAME_SIMILAR`, `ADDRESS_SIMILAR`. A ordenação prioriza CPF, nome/nascimento e similaridade textual, com desempate por ID. São sinais de análise. Para comparar dados, consulte o detalhe autorizado do candidato.

Somente na criação de família, se o operador concluir que os núcleos são distintos, acrescente:

```json
{
  "duplicateReview": {
    "candidateIds": ["00000000-0000-4000-8000-000000000002"],
    "decision": "DISTINCT",
    "reason": "Núcleos familiares sintéticos distintos"
  }
}
```

Para famílias, o backend repete a busca na transação e exige o mesmo conjunto de candidatos. Sem análise, retorna `409 DOMAIN_CONFLICT` com regra `DUPLICATE_REVIEW_REQUIRED`; conjunto alterado retorna `DUPLICATE_REVIEW_CHANGED`. A confirmação conserva candidatos, motivo, data e autor em uma ocorrência resolvida de `POSSIBLE_DUPLICATE`. Para pessoas, CPF repetido bloqueia o cadastro; não há fusão automática ou confirmação como distinto.

### Migration de unicidade do CPF

Execute `pnpm db:migrate` antes de usar a nova versão. A migration `202610070001_unique_canonical_cpf` cria o índice único parcial `Person_cpf_canonical_key`, cobrindo CPFs não nulos de pessoas canônicas. A API traduz conflitos desse índice, inclusive em escritas concorrentes, para `CPF_ALREADY_REGISTERED`. Ao unificar identidades históricas, a origem é marcada como unificada antes de adotar seu CPF no destino, na mesma transação.

A migration é interrompida se já houver CPFs repetidos entre pessoas canônicas. Reconcilie esses registros pelo procedimento autorizado da versão anterior antes de reaplicá-la; não substitua CPF por valor fictício. Não há exclusão ou alteração automática de dados. Para reverter somente o índice, execute `DROP INDEX "Person_cpf_canonical_key";` em uma janela controlada e restaure a versão anterior da aplicação; a reversão permite novamente repetições e exige conciliar o estado das migrations antes de novas implantações.

`GET /data-quality-issues` aceita `kind=MISSING_DATA|POSSIBLE_DUPLICATE`, `status=OPEN|RESOLVED`, `entityType=PERSON|FAMILY` e paginação. Ordem: identificação mais recente, depois ID decrescente. Cada ocorrência contém ID, entidade/ID, tipo, candidatos/campos, datas, revisão e dados da resolução.

`POST /data-quality-issues/:issueId/resolution` recebe `{ expectedRevision, resolution: "DISTINCT", reason }`, preservando a ocorrência e sua revisão anterior. Esse comando resolve somente possíveis duplicidades; `MERGED` vem da unificação. Pendências `MISSING_DATA` são geradas e encerradas automaticamente pela seleção e pelo complemento dos dados descritos abaixo.

## Seleção de campos e dados ausentes

Premissa técnica: a Coordenação configura o mecanismo com `featureDecisions.manage`, assim como as seleções de FIC. A lista relevante continua dependente de DEC-01/LAC-02 para uso institucional. A instalação não seleciona campos nem torna documentos obrigatórios; seleções de demonstração devem identificar expressamente sua finalidade sintética. Esta seleção se refere ao cadastro atual e é independente das versões e dos campos de FIC.

`GET /registration-field-selections/current` exige `registration.read` e devolve `{ data: null }` antes da primeira seleção. Depois, devolve a versão mais recente, incluindo `id`, `version`, listas de campos, referência da decisão, `recordedAt` e `recordedBy`.

`POST /registration-field-selections` exige `featureDecisions.manage`, os cabeçalhos de escrita e chave idempotente. Retorna 201:

```json
{
  "expectedVersion": null,
  "personFields": ["birthDate"],
  "familyFields": ["contactPhone"],
  "decisionReference": "Seleção sintética para demonstração; sem aprovação institucional"
}
```

Na primeira publicação, `expectedVersion` é `null`; nas seguintes, use a versão corrente. Uma versão desatualizada retorna `409 REVISION_CONFLICT`, com `details.currentRevision` igual à versão vigente. A nova seleção substitui as duas listas integralmente, não aceita repetições e normaliza a ordem para comparação idempotente. `decisionReference` é obrigatória, com até 1000 caracteres. Autoria e datas são geradas pelo servidor.

| Cadastro | Campos permitidos                                                                    |
| -------- | ------------------------------------------------------------------------------------ |
| Pessoa   | `birthDate`, `sex`, `cpf`, `rg`, `occupation`, `educationLevel`, `contactPhone`      |
| Família  | `referenceName`, `address`, `neighborhood`, `postalCode`, `location`, `contactPhone` |

Nome da pessoa, código gerado e campos de saúde/religião não fazem parte dessa configuração. Nenhuma lista é herdada de FIC. Ausência significa `null` ou texto vazio normalizado; não equivale a zero/falso.

Publicar uma seleção cria uma versão imutável e reconcilia todas as pessoas e famílias canônicas na mesma transação. Criações e alterações de dados cadastrais seguem a seleção corrente. Existe no máximo uma ocorrência aberta por entidade e campo, com `candidateIds: []` e `fieldKeys: [campo]`. Uma repetição idempotente devolve a seleção original, mesmo após versões posteriores, sem repetir a reconciliação.

| Situação                       | Resultado                                                                                       |
| ------------------------------ | ----------------------------------------------------------------------------------------------- |
| Campo selecionado ausente      | Nova ocorrência aberta `MISSING_DATA`; cadastro mínimo permanece permitido                      |
| Campo complementado            | Ocorrência encerrada com `COMPLETED`, data, autor e nova revisão                                |
| Campo retirado da seleção      | Ocorrência encerrada com `NOT_TRACKED`; não afirma que o dado foi preenchido                    |
| Dado removido novamente        | Nova ocorrência, preservando a anterior resolvida                                               |
| Identidade de origem unificada | Pendências abertas encerradas com `MERGED` e motivo; destino reconciliado com seus dados finais |

Para desativar o mecanismo, publique uma versão com as duas listas vazias. Pendências resolvidas e versões anteriores permanecem consultáveis. Alterações sem mudança efetiva e replays não criam eventos adicionais.

Auditoria da seleção: `RegistrationFieldSelection`, classificação `REGISTRATION_CONFIGURATION`, ação `CREATE`, revisão 1, `before: null`; exige `audit.read` e `featureDecisions.manage`. A auditoria das ocorrências continua em `DataQualityIssue`, classificação `REGISTRATION`, com `registration.read` cumulativo a `audit.read`. Seleção, ocorrência, revisão, auditoria e conclusão da operação confirmam ou falham juntas. Falha de auditoria permite repetir a mesma intenção/chave após correção da dependência.

A [referência de REL](reports.md#qualidade-cadastral) inclui `COMPLETED` e `NOT_TRACKED` nas resoluções dos totais, sem contar uma pendência como pessoa ou família.

### Aplicação e retorno da migration

A migration `202610060001_missing_registration_data` acrescenta a tabela de seleções, a restrição de um campo por ocorrência `MISSING_DATA` e a unicidade parcial das ocorrências abertas; não cria dados, seleções ou aprovações. Seu DDL é transacional.

Interrompa as instâncias anteriores da API, execute `pnpm db:migrate` e inicie a versão atual em todas as instâncias. Atualize consumidores dos contratos públicos junto com esta entrega: as resoluções e `byResolution` possuem dois novos códigos. Evite sobrepor escritores antigos depois de habilitar uma seleção, pois eles não reconciliam dados ausentes.

Se houver ocorrências `MISSING_DATA` inseridas manualmente antes desta entrega, verifique múltiplos campos e duplicatas abertas antes da migration. Ela falha nesses casos, preservando os registros para reconciliação explícita; não apague histórico para forçar a instalação.

O retorno operacional publica listas vazias e mantém tabela e histórico. Voltar a um binário anterior após gerar ocorrências exige manter leitores compatíveis com `COMPLETED` e `NOT_TRACKED`; desativar a geração não remove os novos códigos históricos. Não há remoção automática de tabela ou dados.

## Vínculos, transferência, titular e correção

O DTO de vínculo contém `id`, `personId`, `familyId`, `relationshipToReference`, `isReference`, `validFrom`, `validUntil` e `revision`. O intervalo inclui o início e exclui o fim; `null` mantém fim aberto. Não pode haver sobreposição de famílias para a mesma pessoa nem de titulares na mesma família. Datas de composição futura são rejeitadas.

Transferência exige:

```json
{
  "membershipId": "00000000-0000-4000-8000-000000000003",
  "targetFamilyId": "00000000-0000-4000-8000-000000000004",
  "effectiveAt": "2026-02-01T00:00:00-03:00",
  "expectedMembershipRevision": 1,
  "expectedSourceFamilyRevision": 2,
  "expectedTargetFamilyRevision": 1,
  "relationshipToReference": null,
  "isReference": false,
  "reason": "Mudança familiar sintética"
}
```

O corte precisa pertencer ao vínculo e ser posterior ao seu início. A operação encerra a origem e cria a sucessora na família de destino nesse instante, preservando eventual fim anterior; incrementa a revisão das duas famílias e conserva o vínculo anterior. No instante do corte, só o destino compõe a pertença.

Troca de titular recebe `{ membershipId, effectiveAt, expectedRevision, reason }`, com a revisão da família. Encerra os segmentos aplicáveis e cria sucessores, mantendo o titular anterior antes do corte. A resposta lista os vínculos alterados/criados e a revisão familiar atualizada. Não recalcula parentescos por inferência. Premissa técnica de limite: se o corte coincidir exatamente com o início de um segmento, corrige a revisão daquele segmento em vez de criar intervalo de duração zero; a auditoria conserva o valor anterior e o motivo. Troca para o titular já vigente é no-op, mas ainda rejeita data futura.

Correção de vínculo recebe `expectedRevision`, `expectedFamilyRevision`, `reason` e pelo menos um de `validFrom`, `validUntil`, `relationshipToReference`, `isReference`. Corrige o intervalo declarado, mantém a revisão anterior na auditoria e revalida todos os vínculos da pessoa, inclusive em outras famílias. Mudança real de família deve usar transferência; mudança real de titular deve usar o comando temporal.

Encerramento recebe `{ expectedRevision, expectedFamilyRevision, validUntil, reason }`. Não remove a pessoa; pode deixar `currentFamily=null`. Para corrigir o fim de um vínculo já encerrado, use a correção com motivo.

As operações protegem autor, pessoas e famílias na mesma transação PostgreSQL. Exclusões temporais diferidas reforçam a integridade no estado final; qualquer erro desfaz dados, revisões, auditoria e conclusão de idempotência.

Transferência/correção/encerramento e divisão de vínculo por troca de titular rejeitam cortes que invalidem marcações de encontros concluídos: `409 DOMAIN_CONFLICT`, regra `MEMBERSHIP_ATTENDANCE_CONFLICT`, IDs das marcações afetadas. Não deslocam fatos para a família atual. Mudanças de vigência invalidam a cobertura nos trechos civis afetados. Para mudar composição e corrigir contexto factual juntos, use a [reconciliação composta](membership-reconciliation.md), com prévia, plano explícito, revisões e fingerprint de fontes.

## Tamanhos

`PUT /people/:personId/sizes` recebe `expectedRevision=null` para a primeira versão ou a revisão atual para alteração, além de `shoeSize`, `clothingSize` e `informedOn`. É substituição do perfil: tamanho omitido vira `null`. Tamanhos são textos de até 30 caracteres, sem escala ou recomendação presumida. Havendo tamanho informado, a data civil é obrigatória e não pode ser futura.

Se o cliente enviar uma revisão numérica quando ainda não existir perfil, retorna `409 REVISION_CONFLICT` com `currentRevision=null`; ausência não é revisão zero.

Retorno: `{ data: { personId, shoeSize, clothingSize, informedOn, revision } }`. O perfil corrente aparece no detalhe completo da pessoa; versões anteriores ficam nos eventos `SizeProfile`, com ID de entidade igual ao ID da pessoa. Repetição idempotente devolve o perfil original. Uso real de tamanhos de adultos continua condicionado a LAC-12.

## Limites desta entrega e validação

A [unificação de pessoas e famílias](identity-merges.md) está implementada: `POST /identity-merges/preview` e `POST /identity-merges`, com `registration.merge`. Depois dela, `GET /people/:id`, `GET /families/:id` e `GET /families?code=` resolvem a identidade de origem para a canônica, e comandos endereçados à origem retornam 404. Fichas de FIC e avaliações de APT não são reescritas.

Os testes ficam em [test/features/registration](../../test/features/registration): regras de domínio, revalidação do autor, limites civis, contratos HTTP, busca/projeções, correção e vigência, tamanhos, duplicidade, concorrência de titularidade/idempotência, restrições PostgreSQL e rollback por falha de auditoria. A suíte de integração usa PostgreSQL e Redis reais, conforme os [comandos oficiais](../../README.md#validar).

Esta entrega valida a base cadastral, a reconciliação com FRQ e as pendências configuráveis de dados ausentes usando dados sintéticos; campos não selecionados não geram pendências. Interface e integração ficam a cargo da frente de frontend.
