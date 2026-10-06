# SPEC-FRQ — Encontros e frequência

Versão 1.0 · Dependências: [CORE](00-foundation.md), [CAD](02-registration.md), [ATV](04-projects-activities.md), [ACS](01-access.md), [AUD](08-audit.md). Fontes: PRD 1.1 OBJ-02/03, CAP-04, RN-08/09/13, AC-08; ERS RF-FRQ-01–04/06/07, IU-04/05/07 e AC-18; modelagem D-03/D-04. Justificativa de ausência RF-FRQ-05 e alerta RF-FRQ-08 não entram sem inclusão explícita.

**Implementação backend em 05/10/2026:** 11 rotas de FRQ, persistência, auditoria, frequência/cobertura e integração com vigências de CAD/ATV estão entregues e testadas. Duas rotas de CAD confirmam [reconciliação composta](../api/membership-reconciliation.md). DTOs, erros e evidências de aceite estão na [referência HTTP](../api/attendance.md); o [guia de integração](../api/integrating-attendance.md) orienta a frente de frontend. A UI desta spec, REL e unificação de identidades continuam pendentes; [APT](../api/eligibility.md) está entregue no backend. FIC possui [contratos de backend](../api/social-forms.md), com validação PostgreSQL/Redis e UI ainda pendentes. O método interno `AttendanceService.queryFrequency` fornece a projeção para consumidores; a avaliação de aptidão pertence a SPEC-APT.

## 1. Resultado e modelo

Confirmar um encontro realizado e marcações explícitas por pessoa, em uma tela de chamada, distinguindo inscrição, presença, ausência e falta de lançamento. Tela aberta ou rascunho abandonado não cria um encontro.

| Entidade             | Campos                                                                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ActivitySession`    | `id`, `activityId`, `responsibleId`, `occurredAt`, `recordedAt`, `recordedBy`, `status`, `revision`                                                                                   |
| `Attendance`         | `id`, `sessionId`, `personId`, `familyId`, `membershipId`, `membershipRevision`, `status`, `recordedAt`, `recordedBy`, `revision`, `supersededById?`                                  |
| `AttendanceCoverage` | `id`, `activityId`, `periodStart`, `periodEndExclusive`, `declaredBy`, `declaredAt`, `sourceVersions`, `revision`; declaração de que o registro de encontros do período está completo |

Derivação de persistência: a declaração também conserva `invalidatedPeriods`, com trecho civil, autor, lançamento e motivo. A invalidação incrementa revisão e auditoria e preserva os trechos não afetados. O percentual HTTP usa escala de 0 a 100, permanecendo `null` nas condições descritas na seção 3. Não há cache de frequência/aptidão nesta entrega.

Encontro: `COMPLETED` ou `CANCELED`. Marcação: `PRESENT` ou `ABSENT`; ausência de linha não é enum `ABSENT`. `(sessionId, personId)` é único, com resolução de identidades canônicas/supersessão durante unificação. Encontros distintos na mesma atividade/dia têm IDs diferentes; não impor unicidade por data.

`AttendanceCoverage` é o contrato técnico adotado em [MVP-D07](README.md) para demonstrar completude dos encontros; o levantamento não é apresentado como aprovação institucional desse fluxo. Sem declaração vigente, o mecanismo pode demonstrar presença suficiente, mas não presume completude de encontros ausentes do banco para produzir uma negativa.

## 2. Chamada e regras de escrita

Prévia resolve atividade, lista e vínculos no instante do encontro, usando `[validFrom, validUntil)`. Retorna pessoas na lista, marcações existentes se houver encontro selecionado e revisões relevantes. Não grava. A UI inicia cada linha “Não registrado” e exige seleção explícita. Ação “Marcar todas como presentes/ausentes” é uma ação consciente e visível, não estado inicial.

Confirmação de novo encontro recebe horário/fato não futuro, responsável conhecido e marcações; valida o conjunto inteiro antes de confirmar. Cada marcação precisa de pessoa e vínculo válido naquela data; `familyId/membershipId` são resolvidos e persistidos pelo backend. Fora da lista pode ser marcado, sem inscrição automática. Se falta pessoa/família, um operador autorizado completa CAD primeiro; a chamada não inventa parentesco nem nascimento.

Pode confirmar encontro com chamada incompleta, preservando as linhas não lançadas como desconhecidas. Se nenhuma pessoa participou, o operador pode confirmar encontro realizado sem presenças, distinguindo-o de encontro cancelado; o responsável/data continuam obrigatórios. O universo esperado é o conjunto inscrito no instante mais participantes avulsos marcados explicitamente.

Correção de encontro existente exige `expectedSessionRevision` e motivo. Cada marcação alterada exige sua revisão esperada, ou `null` para primeira marcação. Mudanças de status preservam a marcação anterior em auditoria. A revisão do encontro é incrementada em qualquer modificação efetiva da chamada, permitindo detectar edição concorrente inclusive por marcações novas.

Uma primeira marcação pelo PUT exige também contexto/fingerprint da prévia, pessoa/vínculo/família e revisões correspondentes, como na criação do encontro. Correção apenas de status de linha existente conserva seu contexto factual; mudar esse contexto continua sendo comando explícito. Para corrigir simultaneamente o vínculo que tornará o contexto válido, usar a reconciliação composta de SPEC-CAD, validando o estado final na mesma transação.

Não aceitar trocar pessoa/atividade de um encontro com marcações por PATCH. Correção de horário que muda lista/vínculos históricos precisa retornar a prévia de contextos novos e anteriores e exigir reconciliação de todos os registros afetados; caso contrário, 409. Correção de `familyId/membershipId` de uma marcação somente por comando explícito autorizado, com revisão/motivo e vínculo válido no fato, jamais por atualização automática do cadastro.

Cancelamento exige revisão e motivo, grava `CANCELED` e auditoria sem apagar marcações. Todos os cálculos excluem o encontro cancelado. Não há reativação nem inserção de novas marcações em encontro cancelado. Repetição do mesmo cancelamento retorna a operação existente; outra chave para encontro já cancelado não cria novo cancelamento.

Atividade encerrada aceita correção/registro tardio de encontro dentro da vigência anterior conforme SPEC-ATV. Cancelar/corrigir uma chamada invalida declarações de cobertura e avaliações reutilizáveis afetadas; avaliações já persistidas não são reescritas.

## 3. Consulta de frequência e cobertura

Contrato `queryFrequency({ personId, activityId, from, toExclusive, familyId? })` identifica os encontros realizados no intervalo em que havia inscrição válida, mais os encontros com marcação avulsa válida. O denominador operacional `ENROLLMENT_OR_RECORDED` foi adotado em [MVP-D06](README.md); a modalidade de aptidão ainda é seleção explícita da política de SPEC-APT. Não contar encontros anteriores à inscrição por omissão. Fatos ficam na família registrada no encontro, mesmo que a pessoa tenha mudado depois.

FRQ expõe internamente `FrequencyOpportunity` com pessoa/encontro canônicos, contexto familiar/vínculo, critério de pertinência, marcação opcional e revisões. Marcações usam o contexto factual persistido; oportunidades ainda não marcadas resolvem vínculo no instante do encontro e identificam contexto não resolvido quando necessário. Aplicar `familyId` a essa projeção antes dos contadores, sem usar vínculo atual para selecionar fatos antigos. Contextos não resolvidos não são atribuídos a uma família por inferência e impedem declarar completa a consulta que depende deles. REL consome a mesma projeção para total, detalhe e fingerprint.

Saída: `sessionCount`, `presenceCount`, `absenceCount`, `unrecordedCount`, `attendanceRate`, `markingsComplete`, `coverageComplete`, `contextComplete`, `isComplete`, lista de oportunidades/revisões e critérios de pertinência. Sempre `sessionCount = presenceCount + absenceCount + unrecordedCount`, excluindo cancelados e duplicatas supersedidas. `markingsComplete` exige todas as oportunidades conhecidas marcadas; `coverageComplete` exige cobertura vigente dos encontros do período consultado; `contextComplete` exige contextos necessários resolvidos. `isComplete` é a conjunção dos três. `attendanceRate` é `null` se denominador zero ou consulta incompleta; contagens conhecidas são mostradas mesmo assim. Não calcular percentual sobre somente registros já marcados para esconder incompletude nem apresentar 100% dos encontros conhecidos como prova de frequência completa.

Cobertura é um fato declarado por responsável autorizado, não inferido de “não encontrei registros”. O operador confirma que todos os encontros realizados no período foram registrados. A declaração aponta revisões dos encontros e da inscrição relevantes; mudança de encontro, cancelamento, inclusão tardia ou inscrição afetada invalida a declaração para o trecho atingido. Pode-se declarar um período sem encontros para distinguir recesso conhecido de falta de informação; isso não produz automaticamente Não apta, conforme SPEC-APT.

Declarações aceitam apenas intervalos civis já encerrados: `periodEndExclusive` não ultrapassa o início do dia atual em APP_TIMEZONE. O dia em andamento ainda não prova seu conjunto completo de encontros; contagens conhecidas continuam disponíveis e presença suficiente pode demonstrar mínimo absoluto. Esse limite é do mecanismo de evidência, sem alterar os valores institucionais da política.

Esse mecanismo não gera calendário nem obriga a converter horário previsto em fato. A declaração não atesta presença individual: cada marcação ainda precisa estar explícita para concluir ausência. No MVP não há justificação/tolerância de faltas; uma política que as exija não pode ser ativada como se fossem implementadas.

## 4. API e interface

| Método / caminho                                      | Contrato                                                                                                                                                                                                                                                    |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /activities/:activityId/attendance-context`      | `occurredAt`, `sessionId?`, `guestPersonIds?`; lista mínima, vínculos/revisões e `rosterFingerprint` calculado pelo servidor; sem efeitos                                                                                                                   |
| `POST /activities/:activityId/sessions`               | `{ occurredAt, responsibleId, expectedActivityRevision, expectedRosterFingerprint, entries: [{ personId, expectedPersonRevision, familyId, expectedFamilyRevision, membershipId, expectedMembershipRevision, status }] }`; 201, encontro e chamada          |
| `GET /sessions/:sessionId`                            | Encontro, marcações e não lançados; projeção mínima                                                                                                                                                                                                         |
| `PUT /sessions/:sessionId/attendance`                 | `{ expectedSessionRevision, expectedRosterFingerprint, reason, entries }`; linha existente: `{ personId, expectedRevision, status }`; primeira linha: revisão `null` mais pessoa/família/vínculo e revisões do POST; alterações parciais na mesma transação |
| `PATCH /sessions/:sessionId`                          | Horário/responsável, revisão, motivo, fingerprint/plano de reconciliação se o contexto mudar                                                                                                                                                                |
| `POST /attendances/:attendanceId/context-corrections` | Vínculo válido escolhido, revisão de marcação/encontro, motivo; corrige atribuição equivocada, sem transferência real                                                                                                                                       |
| `POST /sessions/:sessionId/cancellation`              | Revisão, motivo; 200                                                                                                                                                                                                                                        |
| `GET /people/:personId/frequency`                     | `activityId`, `from`, `toExclusive`, `familyId?`; contagens/lista no contexto histórico conforme o denominador declarado                                                                                                                                    |
| `GET /activities/:activityId/sessions`                | Período/status, paginação; distingue cancelados                                                                                                                                                                                                             |
| `POST /activities/:activityId/coverage-declarations`  | Intervalo civil, fingerprint de fontes/revisão da atividade, confirmação e motivo; declaração de cobertura                                                                                                                                                  |
| `GET /activities/:activityId/coverage`                | Período; trechos confirmados, lacunas, invalidações e fingerprint atual das fontes para declaração                                                                                                                                                          |

Escritas exigem `attendance.write`; leituras `attendance.read`. Criar chamada e mutações usam CORE para idempotência/revisões/transação. O frontend devolve o `rosterFingerprint` recebido como `expectedRosterFingerprint`, sem calcular outro hash. O servidor usa SHA-256 de instante normalizado, atividade/projeto e revisões, conjunto de inscrições válidas, identidades canônicas/aliases, pessoa/família/vínculo e revisões, avulsos incluídos no contexto e encontro/revisão quando existente. Conjuntos são ordenados por ID; a confirmação repete a seleção dentro da transação, detectando inserções/remoções. Avulso acrescentado depois exige nova prévia que o inclua. Mudança de fonte produz conflito para revisão; fingerprint não concede autorização.

Derivação HTTP: POST de encontro e PUT de chamada aceitam `guestPersonIds?: UUID[]`, padrão vazio, para repetir a seleção completa da prévia, inclusive avulsos não marcados. Seleção sem marcação não cria fato/inscrição nem inclui o avulso no denominador. Entradas e IDs de avulsos são conjuntos normalizados por ID, limitados a 1.000 e sem duplicatas. Declaração de cobertura retorna 201; consultas mantêm envelope CORE. Unificação/aliases só poderão ampliar o resolvedor quando seu comando transversal estiver concluído, sem fusão implícita nesta etapa.

`/activities/:id/attendance` funciona em celular e tem uma única lista com marcação rápida, avulsos, prévia e confirmação. Rascunho é memória da página. Depois da confirmação, o operador vê ID do encontro, data do fato e data do lançamento; correção inicia pelo encontro existente. Listagem não oferece “novo encontro” como forma de corrigir presença já lançada.

Na mesma área, “Cobertura dos encontros” permite selecionar período encerrado, revisar encontros/cancelamentos e lacunas, e confirmar explicitamente que todas as ocorrências realizadas foram lançadas. Mostrar autor/data da declaração e invalidações; não declarar cobertura ao salvar uma chamada nem marcar participantes ausentes em consequência dessa confirmação.

## 5. Critérios de aceite

| ID       | Cenário                                                                                                                                  |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| FRQ-AC01 | Abrir/abandonar tela não cria encontro nem altera frequência                                                                             |
| FRQ-AC02 | Inscrição sem marcação não é presença nem ausência automática                                                                            |
| FRQ-AC03 | Dois encontros distintos no mesmo dia são contados separadamente                                                                         |
| FRQ-AC04 | Avulso cadastrado com família válida recebe presença sem ganhar inscrição                                                                |
| FRQ-AC05 | Chamada tardia resolve vínculo antigo e conserva fato/lançamento distintos (ERS AC-18)                                                   |
| FRQ-AC06 | Um vínculo inválido em uma das linhas impede a confirmação inteira, inclusive auditoria                                                  |
| FRQ-AC07 | Repetir confirmação após erro de rede devolve o mesmo encontro e marcações                                                               |
| FRQ-AC08 | Correção com revisão antiga conflita; correção válida preserva antes/depois/motivo                                                       |
| FRQ-AC09 | Cancelamento retira encontro de denominador/evidências e mantém histórico                                                                |
| FRQ-AC10 | Chamada incompleta mostra contagens conhecidas e percentual desconhecido; zero encontros não é 0%/100%                                   |
| FRQ-AC11 | Inclusão/correção tardia invalida cobertura afetada e exige nova declaração, sem reescrever avaliação anterior                           |
| FRQ-AC12 | Transferência posterior não muda família na marcação; correção de contexto exige comando explícito                                       |
| FRQ-AC13 | Todas as linhas conhecidas marcadas, mas encontros sem cobertura: contagens aparecem e taxa completa permanece desconhecida              |
| FRQ-AC14 | Filtro familiar separa oportunidades antes/depois de transferência, inclusive linhas não marcadas, pelo contexto histórico               |
| FRQ-AC15 | Primeira marcação em encontro existente conflita se vínculo/contexto mudou depois da prévia; correção de status mantém contexto original |
| FRQ-AC16 | Frontend devolve fingerprint do servidor; inclusão de inscrição ou avulso sem renovar a prévia não confirma contexto obsoleto            |
| FRQ-AC17 | Cobertura não confirma dia em andamento ou período futuro; período encerrado sem encontros pode ser declarado sem inventar marcações     |
