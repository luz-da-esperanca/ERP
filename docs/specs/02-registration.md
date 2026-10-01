# SPEC-CAD — Pessoas, famílias, vínculos e qualidade cadastral

Versão 1.0 · Dependências: [CORE](00-foundation.md), [ACS](01-access.md) e [AUD](08-audit.md). Fontes: PRD 1.1 OBJ-01, CAP-01, RN-01/08/09, AC-01/08 e DEC-01; ERS RF-CAD-01–11, RN-21, RF-REL-09 e AC-15; modelagem D-01 e §4.1. A obrigatoriedade de nascimento/sexo citada na ERS é conciliada com dados ausentes do PRD §4.1 e D-01: o cadastro mínimo exige nome e família, sem fabricar informação.

## 1. Resultado e modelo

Reconhecer a pessoa e seu núcleo familiar, prevenir registros repetidos e conservar a família de cada fato no tempo. A família tem código único; assistidos têm identidade própria e pelo menos um vínculo histórico. Usuários operadores não são assistidos automaticamente.

| Entidade | Campos |
| --- | --- |
| `Family` | `id`, `code`, `referenceName?`, `address?`, `neighborhood?`, `postalCode?`, `location?`, `contactPhone?`, `revision`, `createdAt`, `updatedAt`, `mergedIntoId?` |
| `Person` | `id`, `name`, `birthDate?`, `sex?`, `cpf?`, `rg?`, `occupation?`, `educationLevel?`, `contactPhone?`, `revision`, `createdAt`, `updatedAt`, `mergedIntoId?` |
| `FamilyMembership` | `id`, `personId`, `familyId`, `relationshipToReference?`, `isReference`, `validFrom`, `validUntil?`, `revision`, `supersededById?` |
| `SizeProfile` | `personId`, `shoeSize?`, `clothingSize?`, `informedOn`, `revision`; revisões preservadas |
| `DataQualityIssue` | `id`, `entityType`, `entityId`, `kind`, `candidateIds?`, `fieldKeys?`, `identifiedAt`, `resolvedAt?`, `resolution?`, `resolvedBy?`, `reason?`, `revision` |
| `IdentityMerge` | `id`, `entityType`, `sourceId`, `targetId`, `recordedAt`, `recordedBy`, `reason`, `operationId`; origem única; destino canônico |

`location`: `URBAN`, `RURAL` ou `null`. `sex`, parentesco, ocupação e escolaridade são textos opcionais, sem inventar um enum que a ficha não fornece; máximo 100 caracteres. CPF informado é normalizado para 11 dígitos e indexado, sem unicidade automática. RG é texto até 30; CEP normalizado em 8 dígitos; telefone é texto até 50, preservando código de área/país informado; endereço até 500. Ausência desses dados não impede cadastro nem participação.

Não derivar o nome de referência ou parentesco antigo do titular atual. Tamanho é texto até 30, sem supor escala numérica, tolerância ou recomendação de item. `informedOn` é obrigatório quando há algum tamanho informado e não é futuro. Inclusão de tamanhos para adultos continua condicionada a LAC-12; nas demonstrações podem ser usados dados sintéticos para validar a estrutura.

## 2. Cadastro, vigência e titularidade

Família pode ser criada sem membros para iniciar um cadastro. Uma pessoa só é criada em transação com seu primeiro vínculo em uma família existente ou criada na mesma operação. Nome é obrigatório; nascimento, sexo, parentesco e documentos são desconhecidos se ausentes. Nascimento informado não pode ser futuro; não se inferem idade ou sexo do nome.

Um vínculo vale em `validFrom <= instant < validUntil`, com fim nulo aberto. Datas futuras não são aceitas para declarar composição já existente. A quantidade de membros em `asOf` conta pessoas canônicas distintas com vínculo vigente, excluindo vínculos reconhecidos como duplicados. Família sem titular conhecido mostra pendência; no máximo um titular por família e instante. `isReference=false` não significa que o parentesco foi informado.

**Decisão do MVP ([MVP-D04](README.md)):** no máximo uma família vigente por pessoa em qualquer instante, preservando todas as anteriores. Validar sobreposições também entre aliases da mesma identidade canônica; mesmo intervalos de famílias diferentes não podem se sobrepor. Ausência de vínculo atual permanece possível, com pendência identificada. Dupla pertença não integra este MVP; ratificação institucional de DEC-01/LAC-02 continua exigida antes do uso real.

Mudança de família real encerra o vínculo anterior e inicia outro no mesmo instante, com motivo; fatos anteriores conservam `familyId/membershipId`. Troca de titular/parentesco encerra a versão temporal aplicável e cria a sucessora, sem sobrescrever o passado. Informar parentescos após troca de titular é responsabilidade do operador: valores antigos não são recalculados por inferência de parentesco.

Transferências e encerramentos retroativos também verificam fatos afetados: não confirmar um corte que deixe marcação operacional com vínculo inválido na data do encontro. Retornar conflito para ajustar o corte ou executar reconciliação explícita. Fichas publicadas e avaliações salvas preservam snapshots e referências às revisões originalmente utilizadas; a nova composição não altera esses registros imutáveis.

Correção de erro cadastral difere de mudança real: corrige a revisão do intervalo declarado com motivo, valida sobreposições e aponta os fatos afetados. Não transfere fatos de frequência ou ficha automaticamente. Se a correção tornar o contexto de um fato inconsistente, a operação exige reconciliação explícita com esse módulo antes de confirmar; retorna `409 DOMAIN_CONFLICT` com IDs autorizados para correção. A revisão anterior continua reconstruível.

Operações de vínculo/titular protegem pessoa e famílias envolvidas na mesma transação; FKs, exclusão temporal/checagem serializável e revisão da composição impedem duas titularidades simultâneas. Toda mutação da composição incrementa `Family.revision`; nomes/dados da pessoa usam `Person.revision`.

Quando vínculos e contextos de frequência precisam mudar juntos, usar reconciliação composta, sem exigir estados intermediários inválidos em transações separadas. A prévia recebe a intenção `TRANSFER` ou `CORRECTION`, o plano temporal e as marcações a corrigir; retorna conflitos, revisões e `sourceFingerprint`. O comando confirma `{ intent, expectedSourceFingerprint, expectedPersonRevision, familyRevisions, membershipChanges, attendanceContextChanges, reason }`. `familyRevisions` identifica família/revisão; cada alteração de vínculo existente identifica ID/revisão e intervalos finais. Novo vínculo recebe `clientRef` único no plano, família, início/fim e atributos; o backend gera o ID e referências ao novo vínculo usam essa `clientRef`. Cada correção de contexto identifica marcação/revisão, encontro/revisão, vínculo final escolhido e motivo próprio.

Recalcular o plano e validar o estado final completo antes de gravar: todos os intervalos, titularidades e contextos factuais precisam ser válidos. Exigir `registration.write` e, havendo correção de marcação, também `attendance.write`. Conservar status/fato da presença, sem transferi-la automaticamente: a seleção explícita e o motivo corrigem uma atribuição declarada errada. Vínculos, marcações, revisões de encontros/famílias, invalidação de cobertura e auditoria confirmam na mesma transação. A unificação reutiliza essa validação quando houver reconciliação temporal; não reescreve fichas/avaliações salvas.

## 3. Busca, dados ausentes e duplicidades

Antes de cadastrar, a UI consulta pessoas/famílias com os dados disponíveis. Não exige que todos os filtros existam. Pesquisa por nome/endereço usa comparação sem distinção de caixa/acentos e trechos; nascimento/CPF/código usam igualdade. Ordenação de candidatos: CPF igual, depois nome+nascimento iguais, depois nome/endereço similares; desempate por ID. Esses critérios são sinais técnicos de análise, não um score institucional ou confirmação de duplicidade.

Criação com candidatos não é automaticamente bloqueada: exige `duplicateReview: { candidateIds, decision: "DISTINCT", reason }` quando o operador confirma que são pessoas/núcleos distintos. O backend repete a busca no estado transacional; se aparecer candidato novo, retorna conflito para revisão. Conservar o motivo e candidatos em `DataQualityIssue`; não fundir por CPF nem impor CPF único.

Dados ausentes produzem issues de tipo `MISSING_DATA`, com os campos selecionados como relevantes em DEC-01/LAC-02. O cadastro mínimo funciona mesmo sem seleção institucional final; não chamar ausência de CPF de erro impeditivo. Complementar um campo resolve a issue correspondente com data/autoria. Issues de duplicidade são `POSSIBLE_DUPLICATE`; análise pode resolver como `DISTINCT` ou `MERGED`. Reaparecimento após alteração relevante cria nova ocorrência, preservando a anterior.

## 4. Unificação de pessoas e famílias

Unificação exige `registration.merge`, origem, destino canônico, revisões, motivo e plano explícito de reconciliação. Não é mudança real de família. Fonte marcada `mergedIntoId` fica consultável como identidade anterior; futuras escritas usam a identidade canônica. A cadeia não pode ter ciclos e é resolvida até a raiz.

Prévia consulta todos os históricos dos módulos do MVP em snapshot consistente e lista valores diferentes e conflitos. Nenhuma alteração ocorre na prévia. A confirmação recalcula a prévia e exige o mesmo fingerprint/revisões; mudança intermediária devolve 409.

| Conflito | Resolução explícita exigida |
| --- | --- |
| Campo cadastral informado em ambos com valores diferentes | `fieldSelections`: escolher origem ou destino por campo; valor descartado permanece na auditoria |
| Vínculos sobrepostos após unificação da pessoa | `membershipResolutions`: supersessão integral somente quando todo o intervalo descartado é redundante na mesma pessoa/família canônica. Sobreposição parcial exige reconciliar intervalos, preservando todos os trechos válidos exclusivos e analisando os fatos afetados; famílias diferentes não são unificadas implicitamente |
| Dois titulares no mesmo núcleo/intervalo após unificação familiar | Corrigir titularidade em operações próprias antes de confirmar; a prévia mantém o conflito até resolver |
| Duas marcações da mesma pessoa canônica no mesmo encontro | `attendanceResolutions`: escolher o registro efetivo; o outro recebe `supersededById` e preserva conteúdo e origem; status divergentes exigem escolha e motivo |
| Inscrições duplicadas/sobrepostas na mesma atividade | `enrollmentResolutions`: escolher intervalos efetivos ou corrigi-los; marcar registro duplicado, preservando proveniência |
| Perfis de tamanhos nas duas identidades | `sizeProfileResolution`: escolher explicitamente o perfil que fundamentará o estado canônico, com IDs/revisões; manter os dois históricos e snapshots de fichas anteriores |
| Fichas de duas famílias reconhecidas como o mesmo núcleo | Preservar ambas, com `originFamilyId/originalVersion`; manter namespace e ordenação definidos em FIC, sem reescrever membros ou publicação anterior |
| Avaliações existentes | Preservar família, evidências e IDs/revisões originais; novas avaliações resolvem identidades canônicas e são novos registros |

Os campos de supersessão são o mecanismo técnico de preservar registros duplicados sem contabilizá-los como dois fatos; não cancelam um encontro inteiro para eliminar uma marcação duplicada. A consulta de fato mostra identidade de origem e canônica quando necessário. FKs históricas podem continuar apontando para origem, desde que contratos de busca, contagem e novas escritas resolvam a identidade canônica de forma consistente.

Para vínculos `[janeiro, abril)` e `[março, junho)` da mesma pessoa/família canônica, a reconciliação precisa conservar janeiro–junho; apenas março é duplicado. O plano informa os intervalos finais e quais revisões/segmentos os sustentam. Não substituir uma referência histórica por vínculo que não vale na data do fato. Caso a resolução exija correção de contexto em FRQ, ela participa explicitamente da mesma confirmação, conforme o contrato de correção desse módulo; conflitos de titularidade continuam resolvidos antes da unificação. Trechos declarados incorretos exigem motivo próprio, distinguindo correção de descarte de duplicata.

Confirmação grava mapeamento, reconciliações, destino, issues, revisões e auditoria em uma transação. Qualquer conflito sem resolução impede tudo. Famílias distintas por mudança real não podem ser colapsadas pelo mecanismo de duplicidade. Depois de uma unificação de famílias, código da origem torna-se alias de busca do destino; não é reciclado.

## 5. API e interface

| Método / caminho | Entrada relevante / resultado |
| --- | --- |
| `GET /families` | `q?`, `code?`, `asOf?`, paginação; DTO com composição calculada/autorizada |
| `POST /families` | Dados opcionais, `duplicateReview?`; código gerado pelo servidor |
| `GET /families/:familyId` | `asOf?`; dados, membros, titular e pendências |
| `PATCH /families/:familyId` | `expectedRevision` e campos cadastrais; composição não é alterada por PATCH |
| `GET /people` | `q?`, `birthDate?`, `cpf?`, `familyId?`, paginação; filtros conforme perfil |
| `POST /people` | `{ name, ...optionalFields, familyId, validFrom, relationshipToReference?, isReference?, expectedFamilyRevision, duplicateReview? }` |
| `GET /people/:personId` | `asOf?`; cadastro e vínculos; perfil de atividade recebe somente projeção mínima |
| `PATCH /people/:personId` | `expectedRevision`, campos cadastrais opcionais |
| `POST /people/:personId/membership-transfers` | Origem/destino, `effectiveAt`, revisões de vínculo/famílias, motivo; encerra/abre na mesma transação |
| `POST /people/:personId/membership-reconciliations/preview` | Intenção/plano temporal e contextos a corrigir; 200, leitura sem efeitos/Idempotency-Key |
| `POST /people/:personId/membership-reconciliations` | Plano composto, revisões/fingerprint e motivos; valida estado final e confirma todos os domínios atomicamente |
| `POST /families/:familyId/reference-changes` | Novo `membershipId`, `effectiveAt`, revisão da família, motivo |
| `PATCH /memberships/:membershipId` | Correção de intervalo/parentesco, revisão do vínculo/família, motivo; valida fatos afetados |
| `POST /memberships/:membershipId/closure` | `validUntil`, revisões, motivo; permite cadastro sem vínculo atual, sinalizando pendência |
| `PUT /people/:personId/sizes` | Tamanhos opcionais, `informedOn`, `expectedRevision` ou `null` se primeira versão |
| `GET /duplicate-candidates` | `entityType`, filtros autorizados; comparação com razões do candidato |
| `POST /identity-merges/preview` | `{ entityType, sourceId, targetId }`; 200, leitura sem efeitos/Idempotency-Key |
| `POST /identity-merges` | Identidades, fingerprint/revisões da prévia, seleções e resoluções, motivo |
| `GET /data-quality-issues` | `kind?`, `status?`, `entityType?`, paginação; filtros e campos autorizados |
| `POST /data-quality-issues/:issueId/resolution` | Revisão, resolução `DISTINCT`, motivo; resolução `MERGED` vem da unificação |

`/families`, `/families/:id`, `/people/:id` e `/data-quality` oferecem busca antes do formulário, complemento de dados, composição em data selecionada e histórico de vínculos/titulares. Unificação possui prévia comparativa e confirmação com motivo; nenhuma seleção é automática para campos divergentes. Não há botão de exclusão de pessoa/família com histórico.

## 6. Critérios de aceite

| ID | Cenário |
| --- | --- |
| CAD-AC01 | Cadastro mínimo sem nascimento, sexo ou documentos cria pessoa e vínculo; faltas aparecem como desconhecidas |
| CAD-AC02 | Dois membros aparecem na mesma família e no histórico consolidado (PRD AC-01) |
| CAD-AC03 | Transferência encerra e inicia vínculo no instante escolhido; presença antiga conserva família anterior |
| CAD-AC04 | Troca de titular preserva titularidade anterior e não altera ficha publicada |
| CAD-AC05 | Tentativas concorrentes de titularidade/vínculo incompatíveis não confirmam estado inválido |
| CAD-AC06 | CPF igual identifica candidato, mas não produz fusão nem bloqueio documental automático |
| CAD-AC07 | Unificação sem conflitos reúne históricos e aliases com motivo/autoria; repetição não duplica (ERS AC-15) |
| CAD-AC08 | Duas marcações divergentes no mesmo encontro exigem resolução; após escolha, conta uma e preserva ambas |
| CAD-AC09 | Uma família unificada conserva fichas das duas origens sem reescrever composição histórica |
| CAD-AC10 | Número de membros é calculado em `asOf`, sem duplicar pessoa canônica nem usar contagem manual |
| CAD-AC11 | Perfil de atividade não recebe documento/endereço por pesquisa, candidato ou issue |
| CAD-AC12 | Falha durante unificação ou auditoria desfaz mapeamento, alterações e conclusão da operação |
| CAD-AC13 | Vínculos parcialmente sobrepostos conservam os trechos exclusivos; composição e contexto dos fatos não desaparecem pela supersessão integral |
| CAD-AC14 | Tamanhos têm pessoa/data/revisão; informação ausente não vira zero e uma alteração mantém a revisão anterior recuperável |
| CAD-AC15 | Unificação com perfis de tamanhos divergentes exige escolha explícita; leitura canônica e publicação usam o perfil escolhido sem reescrever snapshots |
| CAD-AC16 | Transferência/encerramento retroativo não invalida marcação silenciosamente; conflito permite revisar corte ou reconciliar explicitamente |
| CAD-AC17 | Reconciliação cria vínculo e corrige contexto na mesma transação; não exige sobreposição temporária nem deixa uma etapa confirmada sozinha |
| CAD-AC18 | Duas famílias com vínculos sobrepostos para a mesma pessoa canônica são rejeitadas, inclusive sob concorrência e após unificação; vínculos históricos consecutivos são permitidos |

Usar integração PostgreSQL para limites temporais, sequência única, unificação e concorrência; não validar histórico apenas por contagem de chamadas a mocks.
