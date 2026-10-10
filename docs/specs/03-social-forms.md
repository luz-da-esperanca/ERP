# SPEC-FIC — Ficha social da família

Versão 1.0 · Dependências: [CORE](00-foundation.md), [CAD](02-registration.md), [ACS](01-access.md) e [AUD](08-audit.md). Fontes: PRD 1.1 OBJ-01, CAP-02, RN-08/09/15 e §4.7; ERS RF-FIC-01/02/04–09, RES-01/02/05, DEC-05/08 e LAC-05/08; modelagem D-09; [ficha recebida](../ficha_cadastro_familias_2025.md). RF-FIC-03 (total/per capita) e RF-FIC-10 (alerta) permanecem evoluções excluídas desta spec.

**Solicitação vigente em 09/10/2026:** o responsável pelo projeto solicitou substituir a configuração de campos por um formulário fixo fiel à [ficha de famílias de 2025](../ficha_cadastro_familias_2025.md), com todos os campos obrigatórios, máscaras e preenchimento de endereço por CEP. As máscaras de telefone, CEP e renda e a consulta de endereço estão implementadas na UI; CPF já possui máscara e datas usam controles nativos. A substituição pelo formulário fixo ainda está pendente: é necessário esclarecer a obrigatoriedade de campos condicionais, como auxílio, medicamentos e complementos de “Outros”, quando não se aplicam. As seções abaixo ainda descrevem o contrato configurável existente; essa solicitação não deve ser confundida com uma entrega completa do formulário fixo.

**Implementação backend em 05/10/2026:** persistência/migration, dez rotas, contratos, configuração explícita e projeção da auditoria estão implementados. A [referência HTTP](../api/social-forms.md) e o [guia de integração](../api/integrating-social-forms.md) registram os contratos concretos. Testes locais de regras, contratos e criptografia passaram; a integração PostgreSQL/Redis foi executada e aprovada em 05/10/2026, após corrigir a chamada do bloqueio consultivo de configuração. A [unificação de CAD](../api/identity-merges.md) está entregue e preserva as versões das duas origens (FIC-AC11). UI e integração HTTP do frontend permanecem pendentes.

## 1. Resultado

Publicar uma fotografia familiar datada, com situação domiciliar, econômica, necessidades, dados dos membros e ciência conhecida. Cada publicação é uma versão completa imutável. A versão atual não reescreve a anterior nem consulta o cadastro atual para substituir os valores históricos.

Não inclui prontuário, diagnóstico, prescrição, visita realizada, entrega, upload de documentos ou assinatura eletrônica. A tabela do papel “Doação / Ação / Visita Domiciliar” pertence aos módulos excluídos; não vira um registro genérico de atendimento dentro da ficha.

## 2. Modelo e identidade histórica

| Entidade | Campos |
| --- | --- |
| `SocialForm` | `id`, `familyId`, `version`, `previousVersionId?`, `correctionOfFormId?`, `referenceMemberId?`, `occurredAt`, `recordedAt`, `recordedBy`, `familySnapshot`, `fieldSelectionVersionId`, `originFamilyId?`, `originalVersion?` |
| `FormMember` | `id`, `socialFormId`, `personId`, `membershipId`, `membershipRevision`, `personSnapshot`, `relationshipSnapshot`, `sizeProfilePersonId?`, `sizeRevision?`, `sizeSnapshot?` |
| Blocos familiares | `HousingBlock`, `FamilyEconomyBlock`, `NeedsBlock`, `SituationObservation` |
| Blocos por membro | `MemberEconomy`, `EducationBlock`, `HealthBlock`, `MedicationEntry`, `ReligiousParticipation` |
| `Acknowledgement` | `id`, `socialFormId`, `referencePersonId`, `method`, `acknowledgedOn`, `recordedAt`, `recordedBy` |

`(familyId, version)` e `(socialFormId, personId)` são únicos. Na publicação, resolver a composição no instante `occurredAt`; cada membro aponta a vínculo válido daquela família, e o membro de referência, se conhecido, pertence à coleção. `personSnapshot` preserva nome, nascimento, sexo e os dados de identificação selecionados; `familySnapshot` preserva código, endereço, bairro, CEP, localização e contato. Tamanho, parentesco, escolaridade e ocupação usados naquela ficha não são atualizados retroativamente.

A API aceita IDs/revisões, não snapshots arbitrários do cadastro. O servidor captura os dados históricos selecionados a partir de revisões verificadas. Uma nova versão pode copiar valores sociais da anterior para revisão do operador, mas deve resolver novamente a composição da sua própria data. Membro que saiu não é transportado para a nova versão por cópia automática.

Versão e ordem de publicação usam sequência por família, não a data civil: uma publicação tardia com data do fato anterior continua sendo a próxima versão de publicação. A UI distingue “última publicada” de “última por data do preenchimento”. Versões de famílias unificadas preservam `familyId/version` no namespace original, com origem/numeração anterior conforme SPEC-CAD; não são renumeradas nem movidas para colidir com versões do destino.

A lista consolidada ordena por `recordedAt desc`, `familyId asc`, `version desc`, `id asc`; assim, publicações empatadas da mesma origem preservam sua sequência. A próxima publicação reserva versão somente no namespace da família canônica. O contexto fornece separadamente `latestPublishedFormId` da lista consolidada e `expectedPreviousVersionId` da última versão desse namespace, ou `null` se ele ainda não tiver versões. Copiar uma ficha de outra origem não a torna predecessora no namespace de escrita. Ordenar por data do preenchimento exige opção explícita `orderBy=occurredAt`, com desempates de publicação e ID, sem alterar a base de escrita.

## 3. Seleção campo a campo e catálogos

O backend implementa apenas as chaves abaixo. `FieldSelectionVersion` tem `id`, `version`, `recordedAt`, `recordedBy` e coleção de definições com `fieldKey`, `included`, `required`, `appliesTo`, `allowedRoleCodes`, `cardinality`, `purpose` e `decisionReference`. Tipos e chaves não são editáveis: não é um construtor genérico de formulário. A interface recebe essa configuração e os catálogos aprovados para montar os campos.

`appliesTo` usa `FAMILY` nos blocos familiares, e `ALL_MEMBERS`, `REFERENCE_MEMBER` ou `SELECTED_MEMBERS` nos individuais. Seleção de membros é explícita na publicação; não inferir faixas etárias quando nascimento ou critério institucional são desconhecidos. `allowedRoleCodes` somente restringe os perfis que já têm acesso ao domínio em ACS; não concede ficha social a responsável por atividade ou administrador isolado. Em blocos escalares, cardinalidade é SINGLE; SINGLE/MULTIPLE é configurável somente nos campos de opções/coleções listados.

Uma seleção não é aprovada automaticamente pela presença no papel. Em uso real, `included=true` exige referência de DEC-05/08. Todos os campos sociais são opcionais na base sintética de avaliação; uma matriz aprovada pode torná-los necessários para publicar a ficha, sem bloquear cadastro ou registro de frequência.

Catálogos têm `fieldKey`, `code`, `label`, `active`, `isOther`, `revision`. As opções iniciais abaixo são candidatas transcritas da ficha; códigos são técnicos em inglês. Escolhas publicadas preservam código e label daquela versão. Desativar opção impede nova seleção e mantém leitura antiga. Cardinalidade SINGLE/MULTIPLE de caixas do papel é registrada na matriz antes do uso real; a estrutura aceita coleções, e SINGLE exige no máximo um valor.

| Bloco/chave | Tipo e opções da fonte |
| --- | --- |
| `housing.housingTenure` | Catálogo: OWNED própria, FINANCED financiada, RENTED alugada, PROVIDED cedida, OTHER outros |
| `housing.location` | URBAN urbana, RURAL rural |
| `housing.roomCount`, `housing.bedroomCount` | Inteiros declarados não negativos ou `null`; sem inferir valor ou impor relação entre contagens |
| `housing.riskArea` | Booleano declarado ou `null`; não classificar risco por endereço |
| `housing.dwellingType` | HOUSE casa, APARTMENT apartamento, ROOM cômodo, OTHER outro |
| `housing.construction` | BRICK_PLASTERED, BRICK_UNPLASTERED, WATTLE_PLASTERED, WATTLE_UNPLASTERED: as quatro opções do papel |
| `housing.floorType` | CEMENT cimento, CERAMIC cerâmica, EARTH chão batido, OTHER outro |
| `housing.electricity` | BILL_PAID paga talão, NONE não possui, USED_UNPAID usa e não paga, NEIGHBOR_PROVIDED cedida por vizinho, IMPROVISED_METER contador improvisado, SOLAR_PANEL placa solar |
| `housing.waterSupply` | BILL_PAID paga talão, UNPAID não paga, CISTERN cisterna, WATER_TRUCK carro-pipa, RIVER rio, WELL_SPRING poço/nascente |
| `housing.waterTreatment` | FILTERED filtrada, BOILED fervida, CHLORINATED cloração, UNTREATED sem tratamento |
| `housing.sewage` | SEWER esgoto, SEPTIC_TANK fossa séptica, RUDIMENTARY_PIT fossa rudimentar, OPEN_AIR céu aberto, DIRECT_TO_RIVER direto para o rio |
| `housing.wasteDisposal` | COLLECTED coletado, BURNED_BURIED queimado/enterrado, OPEN_AIR céu aberto, OTHER outro |
| `housing.transportation` | PUBLIC_TRANSPORT transporte público, MOTORCYCLE_TAXI moto táxi, BICYCLE bicicleta, MOTORCYCLE_CAR moto/carro |
| `housing.hygiene` | GOOD boa, REGULAR regular, POOR ruim; sem pontuação |
| `economy.declaredWorkerCount`, `economy.declaredPensionerCount` | Contagens declaradas não negativas ou `null`; não derivar do quadro individual |
| `economy.receivesGovernmentBenefit`, `economy.governmentBenefitName` | Booleano desconhecido permitido e texto até 200; se sim e nome ausente, sinalizar desconhecido, sem inventar auxílio |
| `members[].economy.worksCurrently` | Booleano ou `null`; pergunta do titular na fonte, ampliação para outros depende da matriz |
| `members[].economy.occupationOrIncomeSource` | Texto até 200, preservando “Ocupação / Bico / Pensão” |
| `members[].economy.incomeAmount` | `Money` ou `null`; renda declarada; a ficha não fixa periodicidade, portanto o campo não é chamado monthlyIncome |
| `members[].education.attendsSchool` | Booleano ou `null`; somente membros para quem o bloco foi selecionado pela matriz |
| `members[].education.schoolLevelOrGrade`, `members[].education.studyMode` | Texto até 100; fonte não fornece enum de série/modalidade |
| `needs.declaredNeeds` | Coleção: FOOD alimento, CLOTHING vestuário, FOOTWEAR calçado, EMPLOYMENT emprego, MEDICAL_SUPPORT médico, OTHER outros |
| `needs.otherNeed` | Texto complementar até 1.000 ou `null` |
| `situation.text` | Texto até 4.000, datado e com autor; orientação explícita contra conteúdo clínico/religioso não aprovado |

Campos `OTHER` aceitam `otherText` opcional na seleção correspondente; se não informado, a opção continua marcada e o complemento aparece como desconhecido. Não transformar mistura de fonte/pagamento nos campos de energia/água em uma interpretação econômica nova. Arrays vazios significam “nenhuma opção declarada” somente se confirmados explicitamente; `null` significa não informado.

Contagens de crianças/adolescentes do papel podem ser representadas como `declaredChildCount/declaredAdolescentCount` opcionais se aprovadas; não inventar limites etários nem inferir menores quando nascimento é desconhecido. Nenhuma tabela impressa limita o número de membros ou medicamentos. Antes da publicação, todos os itens de quadro econômico/escolar são vinculados a membros identificados, sem duplicar a pessoa porque aparece em dois quadros.

## 4. Blocos sensíveis e ciência

**Decisão do MVP ([MVP-D02](README.md)):** implementar os blocos abaixo com estruturas, validações e proteção, mantendo-os desativados por padrão até aprovação específica. Isso preserva RF-FIC-06 condicionado; a inclusão no código não habilita coleta nem leitura.

| Bloco | Conteúdo e restrição |
| --- | --- |
| `health` | `spiritualHealth` EQUILIBRATED/INFLUENCED/OTHER, `otherSpiritualHealth?`, `physicalHealth` GOOD/REGULAR/POOR, `physicalHealthProblems?`, `generalCondition?`, `healthUnit?`, `communityHealthAgent?`; saúde/medicamentos apenas do titular registrado naquela versão |
| `medications` | Coleção de `{ medicationName, providedByGovernment? }`; não coletar dose, diagnóstico, prescrição ou tratamento |
| `religion` | `participatesInEvangelization` por membro para quem aprovado; declaração não cria presença nem influencia aptidão |
| Ciência | Método `PAPER_SIGNATURE` ou outro código especificamente aprovado; pessoa de referência e data civil conhecidas; ausência é “Não informado”, não consentimento presumido |

Registrar ciência conhecida exige data conhecida; se a assinatura existe mas a data não é conhecida, sinalizar pendência e manter registro de observação autorizado, sem preencher com a data de lançamento. Assinatura do responsável em papel e operador digital podem ser pessoas diferentes; autoria do sistema é sempre o operador autenticado.

Flags: `REAL_PERSONAL_DATA`, `FIC_HOUSING`, `FIC_ECONOMY`, `FIC_NEEDS`, `FIC_SITUATION`, `FIC_EDUCATION`, `FIC_HEALTH`, `FIC_MEDICATION`, `FIC_RELIGION`. Todas começam desabilitadas no uso real. Flags de bloco dependem da global e de seleção/perfis aprovados. Em demonstração sintética, habilitar apenas a configuração de teste identificada; saúde/religião continuam desativadas por padrão.

Bloco não habilitado: UI omite campo, backend rejeita entrada com 422 e nenhuma saída pública, auditoria ou revisão retorna seu conteúdo. Habilitar somente leitura de versões antigas exige decisão explicitamente registrada; flag genérica desabilitada não deixa um acesso alternativo pela auditoria. Só coordenação com permissão de decisão administra flags/seleções, e somente uma decisão institucional real libera dados reais.

Decisão técnica de proteção reforçada, quando incluídos: criptografar payloads de saúde/medicamentos/religião por membro/versão com AES-256-GCM no backend, chave de 32 bytes em ambiente, nonce aleatório único e `keyId`. Usar ID da ficha, versão, membro e bloco como dados autenticados adicionais. Auditoria mantém envelope protegido equivalente; descriptografia ocorre apenas após autorização e habilitação. Não indexar nem filtrar esses payloads por conteúdo. Backup mantém envelopes e guarda de chave separada; rotação preserva possibilidade autorizada de leitura das versões anteriores. Usar [Node.js crypto](https://nodejs.org/api/crypto.html#class-cipheriv) para cifra, AAD e verificação de tag.

## 5. Publicação, API e interface

Rascunho é estado local da tela, sem armazenamento de dados sensíveis no navegador. Prévia `GET /families/:familyId/social-form-context?occurredAt=...` resolve composição, revisões, opções e última versão; não publica ficha.

| Método / caminho | Contrato |
| --- | --- |
| `GET /families/:familyId/social-forms` | Lista versões com data do fato/publicação/autor; ordenada por publicação descendente |
| `GET /social-forms/:formId` | Versão completa projetada segundo perfil/flags; ID não libera bloco protegido |
| `POST /families/:familyId/social-forms` | `{ occurredAt, expectedFamilyRevision, expectedPreviousVersionId, fieldSelectionVersionId, memberRevisions, referencePersonId?, blocks, members, acknowledgement?, correctionOfFormId?, reason? }`; 201, versão publicada |
| `POST /social-forms/:formId/acknowledgements` | Método/pessoa/data, motivo se correção, revisão esperada da ciência; ciência adicional não reescreve conteúdo da ficha |
| `GET /social-form-fields` | Versão da seleção e opções permitidas ao operador |
| `POST /social-form-field-selections` | Nova versão completa de seleção, revisão esperada, referência/motivo; `featureDecisions.manage` |
| `POST /social-form-options` | Campo existente, código único, label/ativo, referência; `featureDecisions.manage`; não cria nova chave de formulário |
| `PATCH /social-form-options/:optionId` | Label/ativo, revisão e referência/motivo; código não muda |
| `POST /feature-decisions/:code` | `enabled`, revisão, referência da decisão; validar dependências |

Publicar compara revisão da composição, de cada cadastro usado no snapshot e da seleção, reserva próxima versão e grava membros/blocos/auditoria/resultado em uma transação. `memberRevisions` contém, por pessoa, `personId`, `expectedPersonRevision`, `membershipId` e `expectedMembershipRevision`. Quando tamanhos compõem o snapshot, inclui `sizeProfilePersonId` e `expectedSizeRevision`; revisão `null` declara que não havia perfil na prévia e também deve ser conferida. O ID identifica o perfil efetivamente lido, inclusive quando proveniente de alias. O backend gera os IDs de FormMember e resolve `referencePersonId` para o membro criado, sem exigir ID de uma linha ainda inexistente. O comando especifica `expectedPreviousVersionId` (ou `null` na primeira publicação do namespace); esse valor vira `previousVersionId` após validação. Publicação concorrente vence uma vez, a outra recebe conflito para revisar a base.

Não há PATCH de conteúdo publicado: corrigir publica outra versão completa com `correctionOfFormId` e `reason` obrigatório. A ficha corrigida pode ser de uma origem unificada ou não ser a última publicada; deve pertencer à mesma família canônica. Essa referência não substitui `expectedPreviousVersionId`, que protege a sequência de publicação atual. O motivo integra a auditoria da nova versão, sem ser confundido com observação social ou motivo de correção da ciência.

`/families/:id/social-form` mostra abas/blocos autorizados, campos desconhecidos, membros daquela data, revisão antes de publicar e histórico de versões. Ao trocar data, reconstruir a composição e pedir confirmação da mudança de membros; não aplicar silenciosamente o quadro atual a uma data antiga. Ao receber conflito, reler contexto e comparar; preservar rascunho em memória para revisão.

## 6. Critérios de aceite

| ID | Cenário |
| --- | --- |
| FIC-AC01 | Publicação identifica família, membros, referência, fatos/lançamento e autor; não cria outro cadastro de pessoa |
| FIC-AC02 | Cadastro ou titular muda depois; leitura da versão antiga conserva nome/endereço/parentesco/titular anteriores |
| FIC-AC03 | Nova versão preserva valores anteriores e resolve a composição da nova data |
| FIC-AC04 | Ausência de renda é `null`; zero só aparece quando informado; nenhum total/per capita ou score é gerado |
| FIC-AC05 | Escolaridade e renda apontam ao membro daquela versão; quadro econômico e escolar não duplicam pessoa |
| FIC-AC06 | Saúde/religião desativadas rejeitam entrada e não vazam por detalhe, revisão, catálogo, busca ou auditoria |
| FIC-AC07 | Bloco aprovado exige perfil e flag; credencial de administrador sozinho não lê ficha |
| FIC-AC08 | Ciência ausente/data desconhecida não é convertida em assinatura ou consentimento válido |
| FIC-AC09 | Duas publicações concorrentes com mesma base não criam versões contraditórias; falha desfaz todos os blocos |
| FIC-AC10 | Opção desativada continua legível no snapshot antigo, mas não é escolhida como nova opção |
| FIC-AC11 | Unificação de família preserva versões/proveniência das duas origens sem renumerar o passado |
| FIC-AC12 | Ciphertext modificado ou chave inválida não libera dado parcial; nonce novo em cada publicação/revisão protegida |
| FIC-AC13 | Alteração de tamanho entre prévia e publicação gera conflito, inclusive criação de perfil antes inexistente |
| FIC-AC14 | Correção de uma ficha antiga exige motivo e referência própria; não altera predecessor/numeração do namespace atual |
| FIC-AC15 | Fichas consolidadas mantêm sequência em empates de publicação; base da próxima versão pertence ao destino canônico |
| FIC-AC16 | Instalação inicial mantém saúde, medicamentos e religião desativados; configuração sintética de teste só habilita esses blocos explicitamente, sem liberar dados reais |

Vitest verifica schemas, flags, serialização, criptografia e projeção; integração verifica versão única, snapshots e atomicidade. A matriz de seleção e a liberação para dados reais permanecem sujeitas a DEC-05/08.
