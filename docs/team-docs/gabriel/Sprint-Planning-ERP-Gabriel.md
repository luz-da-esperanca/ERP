# Sprint Planning — Equipe Gabriel

ERP Social Luz da Esperança • Versão 4.0 • 21/10/2026

**Base de revisão:** Geral v2.3 definido pelas equipes + recorte Fabricio v3.2 + instrução de que Fabricio e Gabriel (líder) somente revisam. Prazo final informado como provável: **04/12/2026**. Datas e dependências do geral são mantidas; a revisão corrige responsáveis de execução e a sequência da integração.

## Equipes e responsabilidades

| Frente | Implementação/execução | Somente revisão | Escopo |
|---|---|---|---|
| Fabricio | Gabriel (dev da equipe Fabricio), Ruan, Alan e Kauã | Fabricio | Cadastro, ficha, atividades/frequência/aptidão |
| Gabriel | G2, G3, G4 e G5 — nomes a substituir quando informados | Gabriel (líder) | Atendimentos/visitas, estoque/entregas e recebimento Bazar |
| Comum | Parcelas identificadas nas tarefas dos oito executores | Fabricio e Gabriel (líder), conforme o recorte | Acesso, auditoria, contratos, relatórios/histórico, migração e operação |

“Gabriel (dev da equipe Fabricio)” e “Gabriel (líder)” identificam papéis diferentes no quadro. O desenvolvedor Gabriel continua implementando; a restrição de somente revisão aplica-se ao líder da outra equipe. G2–G5 são identificadores provisórios, não nomes conhecidos nem especialidades confirmadas.

Os líderes revisam código, contratos, testes, documentação e evidências, registrando parecer/pendências. Não recebem implementação, integração, correção, produção dos artefatos a revisar, execução de importação ou infraestrutura. A decisão institucional e o aceite de negócio são do representante da instituição. Nos recortes há **28 tarefas de execução + 7 de revisão por equipe**, com uma responsabilidade principal por integrante em cada ciclo próprio. São **70 tarefas de execução/revisão no total: 56 de execução e 14 de revisão**, decompondo os 57 cartões do produto, sem duplicar requisitos/estimativas.

A capacidade é de **oito executores, quatro por equipe**, mais o tempo separado dos dois revisores; não são dez desenvolvedores. Estimar horas reais, liderança/reuniões, revisões, ausências e feriados antes de assumir compromisso. A carga de S5/S6 e dos ciclos curtos de Gabriel precisa de validação de esforço; a distribuição nominal não prova que cabe. Preservar os prazos como metas exige rever seleção/capacidade quando houver sobrecarga, em vez de atribuir código aos líderes.

## Calendário dos ciclos da equipe

| Ciclo Gabriel | Período | Correspondência geral | Cartões principais |
|---|---|---|---|
| 1 | 19/10/2026 a 30/10/2026 | S1 e S2 gerais | G-01, G-02 |
| 2 | 02/11/2026 a 06/11/2026 | S3 geral | G-03, G-04, G-05 |
| 3 | 09/11/2026 a 13/11/2026 | S4 geral | G-06, G-07 |
| 4 | 16/11/2026 a 18/11/2026 | S5 geral, ciclo 5a | G-08, G-09, G-10 |
| 5 | 19/11/2026 a 20/11/2026 | S5 geral, ciclo 5b | G-11, G-12 |
| 6 | 23/11/2026 a 27/11/2026 | S6 geral | G-13, G-14, G-15 |
| 7 | 30/11/2026 a 04/12/2026 | S7 geral | C-10; sem G novo |

A equipe Fabricio tem sete sprints semanais. A equipe Gabriel mantém os sete ciclos já definidos: o primeiro abrange duas semanas e a semana de 16–20/11 contém os ciclos 4 (5a, 16–18/11) e 5 (5b, 19–20/11). Esses ciclos não têm duração uniforme; o quadro semanal geral coordena integração, sem apresentá-los como sprints Scrum de tamanho uniforme.

G-01/G-02 iniciam na semana geral S1 e concluem uma única vez em S2, em 30/10. As cinco tarefas TG do ciclo 1 são executadas ao longo das duas semanas, com progresso na primeira e conclusão na segunda; não se somam novamente como cinco tarefas novas. Cada integrante tem responsabilidade principal ativa nas duas semanas. Os ciclos 4/5 têm entregas distintas, embora estejam na mesma semana geral S5.

## Cobertura principal — ciclos da equipe Gabriel

| Ciclo | Gabriel (líder, revisão) | G2 | G3 | G4 | G5 |
|---|---|---|---|---|---|
| 1 | TG-01-01 | TG-01-02 | TG-01-03 | TG-01-04 | TG-01-05 |
| 2 | TG-02-01 | TG-02-02 | TG-02-03 | TG-02-04 | TG-02-05 |
| 3 | TG-03-01 | TG-03-02 | TG-03-03 | TG-03-04 | TG-03-05 |
| 4 | TG-04-01 | TG-04-02 | TG-04-03 | TG-04-04 | TG-04-05 |
| 5 | TG-05-01 | TG-05-02 | TG-05-03 | TG-05-04 | TG-05-05 |
| 6 | TG-06-01 | TG-06-02 | TG-06-03 | TG-06-04 | TG-06-05 |
| 7 | TG-07-01 | TG-07-02 | TG-07-03 | TG-07-04 | TG-07-05 |

## Ciclo 1 — 19/10/2026 a 30/10/2026

**Correspondência:** S1 e S2 gerais.

| ID | Entrega | Executor principal / parcela | Apoio ou revisão | Fase/meta | Dependências |
|---|---|---|---|---|---|
| G-01 | Cadastrar itens, categorias, unidades e numerações | G2 | G3 | S1–S2 (fim 30/10) | C-01, C-02, C-03 |
| G-02 | Identificar origens: doadores de itens e campanhas | G4 | G5 | S1–S2 (fim 30/10) | C-02 |

| Tarefa | Origem | Principal | Tipo | Entrega | Evidência de conclusão | Revisor |
|---|---|---|---|---|---|---|
| TG-01-01 | C-01, C-02, C-03, G-01, G-02 | Gabriel (líder) | Revisão | Revisar contratos, acesso, auditoria e catálogos | Parecer sobre PRs/contratos, unidades e origem; registrar pendências. Revisão intermediária em 23/10 e final dos catálogos em 30/10; não conta duas conclusões. | — |
| TG-01-02 | G-01 | G2 | Execução | Implementar catálogo de itens e unidades | API/persistência de item/categoria/unidade/numeração implementadas com quantidade decimal e bloqueio de conversão implícita; versão mínima demonstrada em 23/10 e concluída em 30/10. | G3 |
| TG-01-03 | C-01, C-03, G-01 | G3 | Execução | Implementar auditoria/repetição comuns e validar unidades | Mecanismo de auditoria com datas do fato/lançamento e conflito/repetição disponível na S1 geral; aplicação dos tipos/unidades conferida com G2 até 30/10. | Gabriel (líder) |
| TG-01-04 | G-02, C-07 | G4 | Execução | Implementar origens de itens e mapear dados da fonte | Doador de itens/campanha registrados sem criar CRM; cadastro inicial em 23/10 e integração em 30/10; mapear origem/exportação do seu recorte com Ruan para C-07, ou registrar bloqueio. | G5 |
| TG-01-05 | G-01, G-02, C-09 | G5 | Execução | Entregar interfaces dos catálogos e ambiente operacional inicial | Listas/formulários integrados a G2/G4, com permissões e dados desconhecidos; ambiente, controles e rotina inicial de backup configurados com a base comum desde S1 geral. | G2 |

**Dois acompanhamentos:** em 23/10 mostrar base mínima/catálogos em progresso; em 30/10 concluir G-01/G-02 e conferir integração. C-03 e o ambiente/backup básico precisam estar disponíveis já na primeira semana.

## Ciclo 2 — 02/11/2026 a 06/11/2026

**Correspondência:** S3 geral.

| ID | Entrega | Executor principal / parcela | Apoio ou revisão | Fase/meta | Dependências |
|---|---|---|---|---|---|
| G-03 | Registrar atendimento à pessoa ou à família | G2 | G3 | S3 | PB-04, PB-13, C-02, C-03 |
| G-04 | Registrar visita domiciliar | G4 | G2 | S3 | G-03 |
| G-05 | Corrigir e cancelar atendimentos | G5 | G3 | S3 | G-03, C-03 |

| Tarefa | Origem | Principal | Tipo | Entrega | Evidência de conclusão | Revisor |
|---|---|---|---|---|---|---|
| TG-02-01 | G-03, G-04, G-05 | Gabriel (líder) | Revisão | Revisar atendimentos, visita e correções | Parecer sobre vínculo histórico, executor/operador, cancelamento e observações sem prontuário; PRs/evidências e pendências registrados. | — |
| TG-02-02 | G-03 | G2 | Execução | Implementar registro de atendimento | Atendimento à pessoa ou família com data, tipo, executor e operador; cadastro mínimo integrado; repetição em outras datas não cria presença. | G3 |
| TG-02-03 | G-03, C-03 | G3 | Execução | Entregar interface de atendimento e integração à auditoria | Fluxo de escolha pessoa/família/atividade e confirmação integrado; datas, autoria e dados autorizados conferidos. | G2 |
| TG-02-04 | G-04 | G4 | Execução | Implementar visita domiciliar | Visita vinculada à família com data, executor e situação encontrada; acesso restrito e sem sobrescrever ficha automaticamente; LAC-13 aplicada. | G2 |
| TG-02-05 | G-05 | G5 | Execução | Implementar correção e cancelamento do atendimento | Motivo, autor, revisão esperada e valores anteriores preservados; cancelados separados dos atendimentos válidos nos totais. | G3 |

## Ciclo 3 — 09/11/2026 a 13/11/2026

**Correspondência:** S4 geral.

| ID | Entrega | Executor principal / parcela | Apoio ou revisão | Fase/meta | Dependências |
|---|---|---|---|---|---|
| G-06 | Registrar entrada e triagem de itens | G4 | G5 | S4 | G-01, G-02, C-03 |
| G-07 | Consultar lotes, validade, disponibilidade e movimentos | G2 | G4 | S4 | G-06 |

| Tarefa | Origem | Principal | Tipo | Entrega | Evidência de conclusão | Revisor |
|---|---|---|---|---|---|---|
| TG-03-01 | G-06, G-07, C-04, C-08 | Gabriel (líder) | Revisão | Revisar entrada/triagem, saldo e preparação da entrega | Parecer sobre aceitos/descartados, lotes/validade, saldo e fundamentos da transação; casos de aptidão ainda fictícios identificados. | — |
| TG-03-02 | G-07, G-11 | G2 | Execução | Implementar consulta de lotes/validade e iniciar serviço de entrega | Saldo físico/disponível e movimentos consultáveis; vencidos bloqueados. Estrutura do serviço de entrega iniciada sob o contrato, sem declarar G-11 concluído. | G4 |
| TG-03-03 | C-03, C-04, G-11, C-08 | G3 | Execução | Implementar base transacional/idempotência da entrega e mapear migração | Operação atômica e chave de repetição integradas em ambiente de teste; cenários de concorrência preparados com G2; histórico/origem do seu recorte mapeados. Aceite real aguarda G-10/PB-20. | G2 |
| TG-03-04 | G-06 | G4 | Execução | Implementar entrada e triagem de itens | Recebido/aceito/descartado com motivo; apenas aceito gera lote/saldo; repetição da confirmação não duplica efeitos. | G5 |
| TG-03-05 | G-06, G-07, C-09 | G5 | Execução | Entregar interfaces de recebimento e disponibilidade | Registro e consulta de lotes/validade/saldo integrados com mensagens de erro e perfil; backups/controles operacionais mantidos. | G4 |

**Preparação dos ciclos curtos:** G2/G3 iniciam a base de G-11 e os casos de repetição/concorrência; a aceitação completa depende de G-10/PB-20.

## Ciclo 4 — 16/11/2026 a 18/11/2026

**Correspondência:** S5 geral, ciclo 5a.

| ID | Entrega | Executor principal / parcela | Apoio ou revisão | Fase/meta | Dependências |
|---|---|---|---|---|---|
| G-08 | Registrar ajustes, inventário e saldo inicial | G3 | G5 | S5/5a (18/11) | G-07 |
| G-09 | Receber e conferir transferências do Bazar | G4 | G3 | S5/5a (18/11) | G-06, G-07 |
| G-10 | Preparar entrega consultando família, necessidades e aptidão | G2 | G5 | S5/5a (18/11) | PB-04, PB-09, PB-20, G-07 |

| Tarefa | Origem | Principal | Tipo | Entrega | Evidência de conclusão | Revisor |
|---|---|---|---|---|---|---|
| TG-04-01 | G-08, G-09, G-10, C-04 | Gabriel (líder) | Revisão | Revisar inventário, Bazar e preparação real da entrega | Parecer até 18/11: inventário, referência única Bazar, aptidão e necessidades autorizadas. Em 16–17/11 revisar preparação; avaliação oficial só após PB-20 disponível. | — |
| TG-04-02 | G-10, G-11 | G2 | Execução | Entregar preparação da entrega e integrar avaliação oficial | Família/retirante/itens/saldo/necessidades selecionados; integrar PB-20 em 18/11 antes do aceite de G-10. Continuar a transação iniciada no ciclo anterior; mock não conclui integração. | G5 |
| TG-04-03 | G-08, G-11 | G3 | Execução | Implementar inventário, ajustes e saldo inicial | Contagem/diferença e ajuste confirmado com motivo/revisão; saldo inicial por lote sem doação fictícia e sem duplicar histórico. Casos de repetição/concorrência de entrega prontos antes do ciclo 5b. | G5 |
| TG-04-04 | G-09, G-12 | G4 | Execução | Implementar recebimento Bazar e preparar exceções de entrega | Referência única e conferência informado/recebido; só aceito disponível; origem separada da arrecadação. Estrutura de exceção sob política aprovada pronta para conclusão no ciclo seguinte. | G3 |
| TG-04-05 | G-08, G-10 | G5 | Execução | Entregar telas de inventário e preparação da entrega | Contagem/ajuste integrados a G3; tela de entrega consome G2 e exibe evidência real em 18/11, respeitando dados permitidos. | G2 |

**Dependência de 18/11:** G-10 usa contrato conhecido, mas só conclui após consumir avaliação oficial. Se PB-20 atrasar, G-10 e a confirmação seguinte ficam bloqueados, com replanejamento explícito.

## Ciclo 5 — 19/11/2026 a 20/11/2026

**Correspondência:** S5 geral, ciclo 5b.

| ID | Entrega | Executor principal / parcela | Apoio ou revisão | Fase/meta | Dependências |
|---|---|---|---|---|---|
| G-11 | Confirmar entrega e baixa atômica, segura contra repetição | G2 | G3 | S5/5b (20/11) | G-10, G-03, C-03 |
| G-12 | Tratar exceções de aptidão na entrega | G4 | G5 | S5/5b (20/11) | G-10, PB-20 |

| Tarefa | Origem | Principal | Tipo | Entrega | Evidência de conclusão | Revisor |
|---|---|---|---|---|---|---|
| TG-05-01 | G-11, G-12, C-04 | Gabriel (líder) | Revisão | Revisar confirmação atômica, exceções e integração real | Parecer sobre tudo-ou-nada, repetição/concorrência, saldo, avaliação vigente e justificativa/autorizador; bloqueadores identificados antes do aceite em 20/11. | — |
| TG-05-02 | G-11, C-04 | G2 | Execução | Concluir confirmação atômica da entrega | Entrega, atendimento e movimento gravados juntos ou nada; saldo protegido; com saldo 5 e entrega repetida de 2 resta 3 e existe uma única entrega. | G3 |
| TG-05-03 | G-11, C-03 | G3 | Execução | Concluir idempotência, concorrência e recuperação de falhas | Reexecução e conteúdo conflitante tratados; falha não deixa fatos parciais nem consome operação indevidamente; concorrência não causa saldo negativo. | G2 |
| TG-05-04 | G-12, C-04 | G4 | Execução | Concluir exceções e validação da aptidão na confirmação | Não apta/Pendente tratadas conforme política aprovada, com motivo/autorizador; validar família/data/revisões da avaliação sem recalcular o motor; sem bloqueio inventado. | G5 |
| TG-05-05 | G-11, G-12 | G5 | Execução | Entregar fluxo final de confirmação no celular | Tela integrada com transação/erros/justificativa e proteção de acesso; roteiro de repetição/falha entregue com evidências até 20/11. | G4 |

**Dois dias para conclusão:** integrar e validar trabalho iniciado nos ciclos 3/4. A carga precisa caber na disponibilidade confirmada; registrar impacto e renegociar se transação/exceções não puderem ser aceitas até 20/11.

## Ciclo 6 — 23/11/2026 a 27/11/2026

**Correspondência:** S6 geral.

| ID | Entrega | Executor principal / parcela | Apoio ou revisão | Fase/meta | Dependências |
|---|---|---|---|---|---|
| G-13 | Estornar entrega lançada por engano | G2 | G3 | S6 | G-11 |
| G-14 | Relatórios de estoque e de entregas por família/item | G3 | G4 | S6 | G-08, G-09, G-11, G-13 |
| G-15 | Fornecer atendimentos e entregas ao histórico comum | G5 | G3 | S6 | G-05, G-11, G-13 |

| Tarefa | Origem | Principal | Tipo | Entrega | Evidência de conclusão | Revisor |
|---|---|---|---|---|---|---|
| TG-06-01 | G-13, G-14, G-15, C-05, C-06, C-08, C-09 | Gabriel (líder) | Revisão | Revisar estorno, relatórios, migração e operação | Parecer sobre saldo/estorno, contagens, histórico, importação e restauração com evidências dos executores; nenhuma execução de infraestrutura/importação atribuída ao líder. | — |
| TG-06-02 | G-13 | G2 | Execução | Implementar estorno integral da entrega | Recompor lotes originais e atualizar entrega/atendimento atomicamente; repetição não duplica recomposição; vencido volta ao físico e permanece indisponível. | G3 |
| TG-06-03 | G-14, C-06, C-08 | G3 | Execução | Implementar relatório de estoque, alcance e conferência da migração | Saldo inicial + movimentos = saldo final; pessoas/famílias únicas e atendimento/entrega sem dupla contagem; conferir importação de estoque/origens com fonte disponível e detalhamento dos totais. | G4 |
| TG-06-04 | G-14, C-06, C-08 | G4 | Execução | Implementar relatório de entregas e importação de atendimentos | Entregas por família/item/período com estorno identificado; implementar/conferir ATD/ENT da fonte e fornecer totais a G3. Fonte ausente mantém bloqueio de migração. | G3 |
| TG-06-05 | G-15, C-05, C-09 | G5 | Execução | Entregar fatos ao histórico e ensaio operacional | Fornecer fatos/status com família histórica a C-05; executar ensaio de implantação/backup/restauração e contingência com Kauã; guardar evidências e corrigir falhas. | G2 |

## Ciclo 7 — 30/11/2026 a 04/12/2026

**Correspondência:** S7 geral.

Sem novo G: ciclo dedicado à parcela de C-10, com tarefas próprias de correção/documentação/entrega e revisão do líder.

| Tarefa | Origem | Principal | Tipo | Entrega | Evidência de conclusão | Revisor |
|---|---|---|---|---|---|---|
| TG-07-01 | C-10 | Gabriel (líder) | Revisão | Revisar versão final e documentação da frente Gabriel | Parecer final de código, manuais, resultados de testes e pendências; aprovação técnica separada do aceite institucional. Sem implementação/documentação/implantação pelo líder. | — |
| TG-07-02 | C-10 | G2 | Execução | Entregar correções e documentação de atendimentos/entregas | Bloqueadores de transação/atendimento/estorno corrigidos; roteiro e instruções técnicas atualizados. | G3 |
| TG-07-03 | C-10 | G3 | Execução | Entregar conferência final de saldo, relatórios e migração | Casos de repetição/conciliação e contagens registrados; correções e relatório de pendências disponíveis. | G4 |
| TG-07-04 | C-10 | G4 | Execução | Entregar manual operacional de estoque/Bazar/entregas | Roteiro de recebimento, triagem, transferência e exceção atualizado; telas/regras impeditivas corrigidas. | G5 |
| TG-07-05 | C-10, C-09 | G5 | Execução | Preparar versão final, capacitação e evidências operacionais | Pacote/versão e instruções de instalação/backup/restauração entregues; capacitação e roteiro móvel executados com evidência; líder recebe para revisão. | G2 |

## Sequência corrigida e marcos de integração

| Meta | Entrega/condição | Execução | Revisão |
|---|---|---|---|
| 23/10 — S1 | C-01/C-02/C-03 e cadastro mínimo/projetos; avanço dos catálogos G-01/G-02 | Alan/Kauã/Gabriel (dev da equipe Fabricio) + G3 e demais responsáveis | Fabricio + Gabriel (líder) |
| 30/10 — S2 | Busca/vínculos/atividades e catálogos G-01/G-02 concluídos; C-07 e amostra ou bloqueio registrado | Gabriel/Ruan/Alan/Kauã (Fabricio) + G2–G5 | Ambos |
| 06/11 — S3 | Ficha/participantes/política e atendimentos/visita/correção; lacunas decididas ou bloqueadas | Responsáveis PB/G; Alan implementa PB-19 | Ambos |
| 13/11 — S4 | Primeira chamada e recebimento/triagem/saldo; base transacional de G-11 já em construção | Alan/Kauã (Fabricio) + G2–G5 | Ambos |
| 17/11 — meta interna proposta | PB-17 pronto para integração ao motor | Alan; Kauã verifica cenários; Gabriel (dev da equipe Fabricio) integra | Fabricio |
| 18/11 — prazo do geral | PB-20 oficial e G-08/G-09/G-10 concluídos no ciclo 5a | Gabriel (dev da equipe Fabricio) produz; G2/G5 consomem; G3 inventário e G4 Bazar | Ambos |
| 20/11 — prazo do geral | G-11/G-12 e aceite real C-04, com confirmação repetida/concorrência | G2/G3 transação; G4 exceções; G5 interface; produtor PB-20 da equipe Fabricio | Ambos |
| 27/11 — S6 | Histórico, estorno, relatórios, migração disponível conferida e restauração ensaiada | Ruan/Gabriel/Alan/Kauã (Fabricio) + G2–G5 nas parcelas comuns | Ambos |
| 04/12 — S7 | Versão/documentação, demonstração e pendências entregues | Os oito executores | Líderes revisam; instituição aceita negócio |

**PB-17 → PB-20 → G-10:** para cumprir os prazos simultâneos de 18/11, propor PB-17 até 17/11 e PB-20 no início do expediente de 18/11; alinhar essa janela com a outra frente. O geral original fixa a data, não esse horário interno. Atraso deve ser registrado como bloqueio com impacto em G-10/G-11/G-12, sem substituir aceite real por mock.

**C-04 corrigido:** 16–17/11 é preparação/teste contratual, salvo se o produtor real estiver disponível antes. Validação com avaliação oficial ocorre quando PB-20 for disponibilizado, prevista para 18/11; aceite conjunto em 20/11. Não se declara avaliação real pronta desde 16/11 por ter exemplos fictícios.

**G-11/G-12 não começam do zero em 19/11:** base transacional, idempotência, estruturas de confirmação e casos de falha/concorrência são desenvolvidos no ciclo 3/S4 geral e no ciclo 4/5a. O ciclo 5/5b conclui integração e aceite após G-10. Antecipar subtarefas não antecipa o aceite do cartão nem ignora dependências.

**Trabalho comum ao longo do projeto:** C-03 e C-09 começam na S1; C-07 em S2; C-08 tem mapeamento/construção S3–S4, históricos/reexecução S5 e conferência S6. C-05 depende de PB-23/G-15, C-06 das consultas/totais, e C-10 de evidências do núcleo. Fonte ausente ou regra não aprovada gera bloqueio explícito e revisão de previsão, não migração fictícia nem autorização de produção.

## Critérios de conclusão e acompanhamento

Cada tarefa de execução exige a entrega indicada, teste apropriado e revisão por outra pessoa. Cada tarefa do líder exige parecer com PRs/evidências analisados, resultado e pendências; o líder não escreve a correção nem produz o artefato que deveria revisar. Se dois executores colaborarem no código, revisão é de um terceiro ou do líder. Todos os desenvolvedores testam/corrigem seus módulos; qualidade não pertence a um único integrante.

Cada cartão PB/G/C exige todo o aceite do Product Backlog. Um item com partes prontas não é concluído antes da integração exigida; tarefas TF/TG não duplicam pontos do pai. Cancelamentos/estornos são auditados; totais distinguem pessoas/famílias/ocorrências/unidades. Entrega e estorno são atômicos, repetição segura e saldo não negativo. Dados ausentes não viram zero/falso/ausência/Não apta. Autorização vale para tela, API, busca, relatório e exportação; chamada/entrega utilizáveis no celular.

Migração real exige arquivo de origem e conferência; ensaio sintético não conclui AC-12/13 nem autoriza encerrar Bússola. Não guardar prontuário. Critérios numéricos da ERS continuam propostas a validar com volumes/ambiente. F-R01 é essencial em conciliação; se mantido, estimar e selecionar formalmente. Desejáveis F-R02–06, G-R01–04 e C-R01–02 continuam no backlog, sem compromisso automático no prazo.

Planejar cada sprint/ciclo com capacidade real; descontar ausências/feriados. Acompanhamento breve e registro de bloqueios por responsável; revisão/demonstração em cada encerramento. Nos ciclos curtos 5a/5b, tarefas devem estar decompostas antes de 16/11. O planejamento não presume que tarefas anteriores à data de hoje já foram realizadas. O escopo mínimo e o prazo precisam de negociação explícita se algum essencial não couber.

