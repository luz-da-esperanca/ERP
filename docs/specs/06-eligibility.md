# SPEC-APT — Política e avaliação de aptidão familiar

Versão 1.0 · Dependências: [CORE](00-foundation.md), [CAD](02-registration.md), [ATV](04-projects-activities.md), [FRQ](05-attendance.md), [ACS](01-access.md) e [AUD](08-audit.md). Fontes: PRD 1.1 OBJ-02, CAP-05, RN-02/03/13, AC-02/03, DEC-02; ERS RF-APT-01–07, RN-18, LAC-01 e AC-14; modelagem D-03. Aptidão não libera entrega nem define prioridade; esses módulos estão fora do MVP.

## 1. Resultado e separação das decisões

Produzir `ELIGIBLE` (Apta), `INELIGIBLE` (Não apta) ou `PENDING` (Pendente) em uma data civil de referência, com critério, membro, atividade e fatos identificáveis. Somente presença em atividade periódica é evidência. Cadastro, inscrição, declaração de evangelização e atendimento pontual não substituem presença.

A spec fecha o mecanismo matemático e o contrato de configuração. O valor do período/mínimo e as modalidades institucionais permanecem explicitamente configurados por coordenação, com referência de DEC-02/LAC-01. Não existe política inicial, fallback de 30 dias, percentual presumido ou ativação de uma política incompleta.

## 2. Modelo e formato de política

`EligibilityPolicy`: `id`, `effectiveFrom`, `definition`, `decisionReference`, `reason`, `recordedAt`, `recordedBy`. Definições publicadas são imutáveis e `effectiveFrom` único; vigência termina no início da próxima versão. Não há exclusão ou edição de política publicada. Rascunho na tela não altera a política vigente.

`PolicyDefinition` contém todos os campos abaixo explicitamente. As modalidades são propostas delimitadas para implementação; instituição escolhe entre elas ou mantém a política pendente se precisar de modalidade não suportada.

| Campo | Formato e validação |
| --- | --- |
| `schemaVersion` | 1; versão de formato, distinta da política |
| `period` | Uma das formas: `{ type: "ROLLING_DAYS", length }`, `{ type: "CALENDAR_MONTHS", length }` ou `{ type: "FIXED_PERIOD", start, endExclusive }`; `length` inteiro positivo, datas válidas ordenadas |
| `minimum` | `{ type: "PRESENCE_COUNT", value }`, inteiro ≥1; ou `{ type: "ATTENDANCE_RATE", basisPoints }`, inteiro de 1 a 10000, representando percentual exato de 0,01% a 100% |
| `activityIds` | Conjunto não vazio de atividades periódicas; gravar IDs explícitos, sem expandir automaticamente novas atividades |
| `activityCombination` | `ANY_ACTIVITY` (critério em uma atividade) ou `COMBINED` (numeradores/denominadores das atividades selecionadas, sem duplicar encontro) |
| `membershipScope` | `CURRENT_ON_REFERENCE` (membros vigentes no corte da referência) ou `ANY_WITHIN_PERIOD` (membros com vínculo no período); em ambas, presença somente na família histórica avaliada |
| `opportunityRule` | `ENROLLMENT_OR_RECORDED` (inscrição válida no encontro ou avulso marcado) ou `ALL_COMPLETED_DURING_MEMBERSHIP` (encontros selecionados durante vínculo familiar, independente de inscrição) |
| `justificationRule` | `NOT_SUPPORTED`; a evolução de justificativas não integra este MVP |
| `recessRule` | `RECORDED_SESSIONS_ONLY`; horário planejado não gera encontro; período sem encontros depende de cobertura para ser conhecido |
| `newParticipantRule` | `OPPORTUNITY_RULE`; o universo segue a opção de oportunidades selecionada; carência adicional não suportada |
| `toleranceRule` | `NONE`; nenhum prazo de tolerância é presumido |
| `incompleteEvidenceRule` | `THREE_VALUED`; usar prova suficiente e limites possíveis, conforme §4 |

Essas seleções também não têm default invisível. Se a instituição exigir faltas justificadas computadas, carência, tolerância, outro calendário ou outros operadores, a publicação é rejeitada como modalidade não suportada; ampliar requer atualização de decisão/spec. Não criar uma linguagem genérica de expressões de política.

Períodos: ROLLING_DAYS começa `length-1` dias antes da referência e termina no dia seguinte, exclusivo. CALENDAR_MONTHS começa no primeiro dia do mês situado `length-1` meses antes do mês da referência e termina no dia seguinte à referência; inclui o mês atual até a referência. FIXED_PERIOD usa o intervalo informado e limita fim ao dia seguinte à referência; referência antes do início resulta em pendência `REFERENCE_OUTSIDE_PERIOD`.

O corte da referência é o instante imediatamente anterior à meia-noite do dia seguinte em `APP_TIMEZONE`, com precisão de milissegundo do contrato JavaScript. Fatos considerados nunca ultrapassam a referência nem o instante real conhecido no snapshot. Vínculos usam seus intervalos de instantes. Essa escolha técnica torna explícito o efeito de uma troca de família no mesmo dia; outro corte exige revisão da spec.

Na publicação, validar referências, modalidades, campos completos e periodicidade das atividades. `effectiveFrom` pode ser anterior à publicação apenas com `retroactive=true`, motivo e referência de decisão explícita; a UI explica que reavaliações podem mudar, sem alterar avaliações já salvas. Uma política que exige presença zero para aprovar é inválida mesmo que percentuais arredondados sugiram aprovação.

## 3. Fontes e evidências

`EligibilityAssessment`: `id`, `familyId`, `referenceDate`, `evaluatedAt`, `policyId?`, `status`, `pendingReasons`, `explanation`, `sourceFingerprint`, autoria do solicitante. É imutável. `EligibilityEvidence`: pessoa canônica, vínculo/identidade de origem, atividade, período, `sessionCount`, `presenceCount`, `absenceCount`, `unrecordedCount`, limites de frequência, `coverageComplete`, revisões de encontros/marcações/inscrições/vínculos/cobertura e resultado local.

O serviço reúne um snapshot PostgreSQL consistente e chama função pura `evaluateEligibility(context, policy, evidenceSnapshot)`. Relógio, leitura, geração de ID e persistência ficam fora da função. Dados de ficha, renda, saúde e religião não entram no cálculo. Evidências antigas permanecem recuperáveis por ID/revisão após correções.

Resolver candidatos segundo `membershipScope`; separar identidade canônica de família do fato. Em qualquer opção, não levar presença ocorrida na família A para família B por uma transferência posterior. `CURRENT_ON_REFERENCE` pode deixar de considerar membro que saiu antes do corte; `ANY_WITHIN_PERIOD` pode considerar sua participação durante a vigência na família. O valor escolhido deve aparecer na explicação, não como regra fixa presumida.

Para cada pessoa/atividade, construir oportunidades `S` de encontros `COMPLETED`, distintos, no período e no intervalo de pertença permitido. Excluir cancelados, supersedidos e fatos fora do recorte. Inscrição não acrescenta presença; somente decide pertinência quando a política usa essa modalidade. Marcações explícitas distinguem presentes, ausentes e oportunidades sem lançamento.

Cobertura completa significa que declarações vigentes de SPEC-FRQ cobrem o período necessário e suas revisões ainda correspondem às fontes. Sem ela, o banco não comprova que todos os encontros relevantes foram lançados. A necessidade desse mecanismo de declaração é proposta pendente de confirmação no registro do MVP; até fechá-la, nenhuma negativa depende de completude presumida.

## 4. Algoritmo de decisão

1. Sem política vigente: retornar `PENDING`, `POLICY_UNDEFINED`, sem critério fictício. Sem membros/contexto resolvido: `PENDING`, `MEMBERSHIP_UNRESOLVED`.
2. Construir o universo por pessoa/atividade ou por pessoa com atividades combinadas, conforme política. Contagens não incluem a mesma identidade efetiva duas vezes.
3. Se não houver oportunidades, candidato fica `PENDING`, `NO_OPPORTUNITIES`; 0/0 nunca vira taxa nem prova de Não apta.
4. Em mínimo absoluto, `P=presenceCount`. Se `P >= mínimo`, candidato `ELIGIBLE` mesmo que existam outras lacunas irrelevantes para essa prova. Caso contrário, sem cobertura completa, `PENDING`. Com cobertura completa, usar `P+U`, sendo `U=unrecordedCount`: se nem todas as marcações desconhecidas como presentes alcançariam o mínimo, candidato `INELIGIBLE`; se poderiam alcançar, `PENDING`.
5. Em percentual, exigir universo/cobertura completos para conhecer denominador `N`. Comparar por inteiros: limite inferior `P*10000` e superior `(P+U)*10000` contra `minimum.basisPoints*N`. Se inferior alcança mínimo e há ao menos uma presença factual, candidato `ELIGIBLE`; se superior não alcança, `INELIGIBLE`; demais casos, `PENDING`. Sem cobertura, `PENDING` mesmo se os poucos registros conhecidos exibirem 100%.
6. Família `ELIGIBLE` se qualquer candidato é apto, independentemente da falta de dados de outros. Se ninguém é apto e existe candidato pendente/contexto incompleto, família `PENDING`. Somente quando há candidatos pertinentes e todos comprovadamente falham, família `INELIGIBLE`.

Esse uso de limites não inventa presença: apenas identifica quando os valores desconhecidos poderiam ou não mudar a conclusão. Exibição arredonda taxas a duas casas; decisão nunca usa a taxa arredondada. `explanation` é estruturada e traduzível, com política/recorte/mínimo/fatos e motivo; não grava texto arbitrário como única explicação da regra.

## 5. API e interface

| Método / caminho | Entrada / resultado |
| --- | --- |
| `GET /eligibility-policies` | Lista versões, vigência/autor; `eligibility.read` |
| `GET /eligibility-policies/:policyId` | Definição publicada e metadados |
| `POST /eligibility-policies` | Definição completa, `effectiveFrom`, `expectedLatestPolicyId` ou `null`, referência/motivo e retroatividade explícita; `eligibility.policy.write` |
| `POST /families/:familyId/eligibility-assessments` | `{ referenceDate }`; 201, avaliação persistida; `eligibility.evaluate` |
| `GET /eligibility-assessments/:assessmentId` | Avaliação original e evidências autorizadas |
| `GET /families/:familyId/eligibility-preview` | `referenceDate`; cálculo informativo puro, sem gravação |

Consultar lista de famílias por situação pertence a SPEC-REL e reutiliza o mesmo avaliador, sem outro cálculo. O contrato interno `evaluate(familyId, referenceDate)` retorna avaliação identificada, critério opcional, razões/evidências e fingerprint; nenhum consumidor recalcula aptidão.

`/settings/eligibility` publica política sem valores pré-preenchidos como regra institucional. `/families/:id/eligibility` mostra situação em data escolhida, membros/atividades e provas, pendência com ação possível e avaliações anteriores. Pendência de política orienta procurar coordenação; lacuna de chamada/cobertura orienta o responsável por atividade. “Apta” não é botão de concessão de benefício.

Não há cache de aptidão em Redis neste MVP. Cada prévia/avaliação usa fontes atuais consistentes; avaliação salva preserva o snapshot original. Se cache for introduzido, tempo/política/vínculos/inscrições/chamadas/cancelamentos/cobertura/unificação invalidam resultado afetado antes de reutilização.

## 6. Critérios de aceite

Os valores de cenários numéricos são fixtures sintéticas de teste, nunca políticas iniciais da instituição.

| ID | Cenário |
| --- | --- |
| APT-AC01 | Sem política, toda família é Pendente; nenhum valor default é usado (PRD AC-03) |
| APT-AC02 | Um membro comprova mínimo; família Apta mesmo com outros membros incompletos (PRD AC-02) |
| APT-AC03 | Política nova avaliada em data anterior usa versão vigente naquela data (ERS AC-14) |
| APT-AC04 | Inscrição, cadastro, ficha/religião e pontual não geram prova de presença |
| APT-AC05 | Cancelamento/correção alteram nova avaliação, mantendo resultado/evidência da avaliação anterior |
| APT-AC06 | Zero oportunidades ou cobertura desconhecida não produz Não apta por omissão |
| APT-AC07 | Contagem conhecida já satisfaz mínimo absoluto mesmo se faltam outras marcações |
| APT-AC08 | Percentual usa limites inteiros; arredondamento não aprova um valor abaixo do mínimo |
| APT-AC09 | Evidência insuficiente que poderia mudar resultado é Pendente; máximo possível abaixo do mínimo, com cobertura, é Não apta |
| APT-AC10 | Transferência não leva fatos da família anterior à atual; modalidade de composição aparece na explicação |
| APT-AC11 | Janela em dias, meses civis e intervalo fixo respeitam limites e fuso, inclusive virada de mês/ano |
| APT-AC12 | Publicação concorrente não cria vigências iguais; política incompleta/não suportada é rejeitada |
| APT-AC13 | Unificação não conta duas vezes uma presença nem muda avaliação salva; GET não cria avaliações |

Vitest exercita o avaliador por entradas completas e três valores, incluindo limites; integração verifica seleção de política, snapshot consistente, publicação/avaliação e atomicidade da auditoria.
