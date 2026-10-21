# Sprint Planning — Equipe Fabricio

ERP Social Luz da Esperança • Versão 3.2 • 21/10/2026

**Base:** Sprint Planning — Geral v2.3, de 21/10/2026, enviado como definição das equipes. Datas, cartões PB e dependências seguem esse arquivo; a instrução posterior de Fabricio prevalece na atribuição de implementação/revisão. Responsáveis nominais, tarefas TF e metas internas são a decomposição da equipe Fabricio. Prazo final ainda apresentado no geral como provável: **04/12/2026**.

## Escopo da equipe Fabricio

Equipe: **Fabricio (líder), Gabriel, Ruan, Alan e Kauã**. Entrega cadastro de pessoas/famílias/vínculos, ficha social, institutos/projetos/atividades, frequência e aptidão. Atendimentos, visitas, estoque, entregas e recebimento do Bazar pertencem à outra frente; aparecem aqui apenas como dependências de integração.

P2 = Gabriel; P3 = Ruan; P4 = Alan; P5 = Kauã. As duplas do geral orientam a distribuição, com a atualização solicitada de Fabricio somente como revisor: Alan implementa PB-19 e Gabriel implementa PB-20. Cada tarefa TF tem seu próprio responsável principal e revisor: apoio a um PB não impede ser responsável principal por uma entrega concreta dentro dele. “Gabriel” em atribuições internas é o integrante de Fabricio; “liderança da outra equipe” é o papel que coordena a outra frente.

Os 20 PB principais e os itens de reserva permanecem os mesmos. As 35 TF (28 de execução e 7 de revisão) decompõem os PB e a parcela de C da equipe Fabricio; não são novos requisitos nem duplicam estimativas. Um cartão só termina quando todo o seu aceite foi atendido, mesmo que uma TF já esteja pronta. Cada implementador responde por uma tarefa de execução em cada sprint; Fabricio responde pela revisão da semana. Responsabilidades não comprovam equilíbrio em horas: estimar disponibilidade e esforço antes do compromisso.

## Papéis atualizados — Fabricio somente na revisão

Por definição de Fabricio, sua atuação é **exclusivamente revisar código, contratos, regras, testes, documentação e evidências de entrega**, registrando parecer e pendências. Ele não implementa código, APIs, integrações, importadores ou configuração de infraestrutura; não recebe execução de migração, implantação ou produção de documentação de entrega. A aceitação de negócio continua com o representante institucional.

**Executores:** Gabriel, Ruan, Alan e Kauã. **Revisor técnico:** Fabricio, com revisões cruzadas entre os executores. Cada sprint tem quatro tarefas de execução (uma principal para cada executor) e uma tarefa principal de revisão para Fabricio: **28 tarefas de execução + 7 tarefas de revisão = 35 tarefas TF**. Tarefas maiores podem ser decompostas; a quantidade não indica equilíbrio em horas.

A atualização altera a atribuição nominal em relação ao geral v2.3: **PB-19 será implementado por Alan e PB-20 por Gabriel; ambos revisados por Fabricio**. O geral continua sendo a referência de escopo, datas e dependências, mas essas atribuições executoras precisam ser refletidas em sua próxima atualização. Nenhum item de implementação deve permanecer no nome de Fabricio. P2–P5 continuam correspondendo a Gabriel, Ruan, Alan e Kauã.

A capacidade de desenvolvimento passa a ser calculada com **quatro implementadores**, somada à disponibilidade separada de Fabricio para revisão. Reestimar a seleção, especialmente S1, S3, S5 e S6, antes de afirmar que cabe nos prazos. As datas atuais são preservadas como metas do planejamento recebido, não como viabilidade comprovada após a redistribuição.

## Conferência do geral v2.3

O documento é utilizável como plano de coordenação: escopos estão separados, dependências são rastreáveis e as sete semanas da equipe Fabricio terminam em 04/12. A aprovação do cronograma exige conferir capacidade e andamento real; não há estimativas nem evidência de execução neste arquivo.

| Ponto | Avaliação e tratamento neste recorte |
|---|---|
| Calendários das equipes | Fabricio segue S1–S7 semanais. A outra equipe usa ciclo próprio, inclusive 5a/5b na semana da S5. São sete janelas gerais de integração; a duração variável da outra frente não deve ser apresentada como Scrum de duração uniforme. |
| PB-17 → PB-20 → G-10 | Dependência crítica: PB-17 precisa terminar antes de PB-20. Propõem-se PB-17 até 17/11 e PB-20 no início de 18/11 para reservar o restante do dia à validação de G-10. Esses horários/datas internos são metas de execução novas, a alinhar entre líderes; o geral só fixa PB-20 e G-10 até 18/11. |
| “Avaliação real desde 16/11” em C-04 | O geral também prevê PB-20 só em 18/11. Em 16–17/11 pode ocorrer preparação/teste contratual com exemplos; validação com avaliação oficial começa quando PB-20 estiver disponível, prevista em 18/11. Aceite real de C-04 permanece em 20/11. Essa interpretação precisa ser refletida na próxima revisão do geral. |
| G-01/G-02 em S1 e S2 | O geral informa início em S1 e conclusão em S2; contar uma única conclusão em 30/10. A demonstração de S1 é do avanço do catálogo, não prova de conclusão dos dois cartões. Não são atribuições desta equipe. |
| CPF e proteção desde S1 | PB-04 já cria pessoas em S1: CPF informado precisa ser válido/único e dados protegidos desde a primeira gravação. PB-05 na S2 completa busca e mensagens; não adia a integridade cadastral. PB-11 na S4 completa controles específicos da ficha; acesso básico vem de C-02. |
| Carga de S5/S6 e migração | S5 integra aptidão/entrega; S6 reúne histórico, relatórios, migração e restauração. Manter C-08 em construção desde S3 e C-09 desde S1, como o geral prevê; medir capacidade para evitar concentrar toda implementação na última semana. |

O arquivo geral anexado permanece como referência recebida. Este recorte explicita os ajustes de execução acima e não altera unilateralmente os cartões ou prazos da outra equipe.

## Calendário das sete sprints da equipe

| Sprint | Início | Fim | Duração proposta |
|---|---|---|---|
| S1 | 19/10/2026 | 23/10/2026 | 1 semana |
| S2 | 26/10/2026 | 30/10/2026 | 1 semana |
| S3 | 02/11/2026 | 06/11/2026 | 1 semana |
| S4 | 09/11/2026 | 13/11/2026 | 1 semana |
| S5 | 16/11/2026 | 20/11/2026 | 1 semana |
| S6 | 23/11/2026 | 27/11/2026 | 1 semana |
| S7 | 30/11/2026 | 04/12/2026 | 1 semana |

## Cobertura de responsabilidades principais

| Sprint | Fabricio | Gabriel | Ruan | Alan | Kauã |
|---|---|---|---|---|---|
| S1 | TF-01-01 | TF-01-02 | TF-01-03 | TF-01-04 | TF-01-05 |
| S2 | TF-02-01 | TF-02-02 | TF-02-03 | TF-02-04 | TF-02-05 |
| S3 | TF-03-01 | TF-03-02 | TF-03-03 | TF-03-04 | TF-03-05 |
| S4 | TF-04-01 | TF-04-02 | TF-04-03 | TF-04-04 | TF-04-05 |
| S5 | TF-05-01 | TF-05-02 | TF-05-03 | TF-05-04 | TF-05-05 |
| S6 | TF-06-01 | TF-06-02 | TF-06-03 | TF-06-04 | TF-06-05 |
| S7 | TF-07-01 | TF-07-02 | TF-07-03 | TF-07-04 | TF-07-05 |

Todas as células indicam uma tarefa própria detalhada adiante; não há integrante contando apenas como apoio/revisor.

## Sprint 1 — 19/10/2026 a 23/10/2026

**Objetivo:** Família, pessoa/vínculo mínimo e institutos/projetos integrados.

### Cartões da equipe — mesmos IDs e semana do geral

| ID | Entrega | Principal do cartão | Apoio/revisor | Dependências | Prazo |
|---|---|---|---|---|---|
| PB-03 | Como operador, cadastrar e consultar uma família identificada por número único | Gabriel | Ruan | C-01, C-02, C-03 | Fim da sprint |
| PB-04 | Como operador, cadastrar pessoa e vínculo familiar, inclusive cadastro mínimo | Ruan | Gabriel | C-01, C-02, C-03, PB-03 | Fim da sprint |
| PB-12 | Manter institutos e projetos com situação e vigência | Alan | Kauã | C-01, C-02, C-03 | Fim da sprint |

### Tarefas individuais — cada pessoa como responsável principal

| Tarefa | Origem | Responsável principal | Tipo | Entrega | Evidência de conclusão | Revisor |
|---|---|---|---|---|---|---|
| TF-01-01 | C-01, C-02, C-03, C-04, PB-03, PB-04, PB-12 | Fabricio | Revisão | Revisar contratos, segurança e cadastros da S1 | Parecer registrado sobre contratos/autenticação, autorização, CPF e vínculo mínimo, projetos e auditoria; PRs/evidências analisados e pendências com item responsável. | — (parecer do revisor) |
| TF-01-02 | PB-03, PB-04, C-01 | Gabriel | Execução | Implementar família/pessoa/vínculo e contratos cadastrais | APIs e contratos de família/pessoa/vínculo publicados; CPF opcional válido/único quando informado, autoria e permissões aplicadas; dados recuperáveis pela interface. | Ruan |
| TF-01-03 | PB-03, PB-04 | Ruan | Execução | Entregar formulários de família e cadastro mínimo de pessoa | Fluxo completo de família → pessoa vinculada integrado à API, com campos pendentes sinalizados e sem CPF obrigatório. | Gabriel |
| TF-01-04 | PB-12, C-01, C-02, C-03 | Alan | Execução | Implementar projetos e integração de autenticação/autorização no servidor | Cadastro de institutos/projetos disponível; autenticação e perfis comuns integrados; autoria/auditoria conectadas ao mecanismo conduzido pela outra frente. Contratos/documentação técnica produzidos. | Fabricio |
| TF-01-05 | C-02 | Kauã | Execução | Entregar login, sessão e navegação protegida na interface | Login integrado ao serviço comum; logout, sessão inválida e negação de acesso tratados. Tela não substitui autorização no servidor. Kauã é responsável principal por esta tarefa. | Fabricio |

**Parcela dos itens comuns:** Gabriel produz contratos cadastrais; Alan integra autenticação/perfis e auditoria na base comum com a outra frente; Kauã implementa login/sessão na interface. Fabricio revisa contratos, PRs e evidências.

**Sequência e demonstração:** Integrar C-01/C-02/C-03 antes das gravações; família PB-03 precede pessoa/vínculo PB-04. PB-04 prioriza cadastro mínimo conforme o geral, com campos complementares explicitamente pendentes. Regras de integridade do CPF e autoria já se aplicam. Alan e Kauã trabalham em projetos/login em paralelo.

## Sprint 2 — 26/10/2026 a 30/10/2026

**Objetivo:** Busca/CPF, composição histórica e catálogo de atividades.

### Cartões da equipe — mesmos IDs e semana do geral

| ID | Entrega | Principal do cartão | Apoio/revisor | Dependências | Prazo |
|---|---|---|---|---|---|
| PB-05 | Buscar cadastros antes de criar e impedir CPF inválido ou repetido | Gabriel | Kauã | C-01, C-02, C-03, PB-04 | Fim da sprint |
| PB-06 | Trocar titular, encerrar/alterar vínculos e consultar composição histórica | Gabriel | Fabricio | C-01, C-02, C-03, PB-04 | Fim da sprint |
| PB-13 | Cadastrar atividades periódicas/pontuais e encerrá-las preservando registros | Alan | Kauã | C-01, C-02, C-03, PB-12 | Fim da sprint |

### Tarefas individuais — cada pessoa como responsável principal

| Tarefa | Origem | Responsável principal | Tipo | Entrega | Evidência de conclusão | Revisor |
|---|---|---|---|---|---|---|
| TF-02-01 | C-07, PB-05, PB-06, PB-13 | Fabricio | Revisão | Revisar busca, vínculos, atividades e plano de migração | Revisar validação/unicidade de CPF, histórico de titular/vínculos, natureza/encerramento da atividade e mapa de exportação produzido pelos executores; registrar parecer e bloqueios. | — (parecer do revisor) |
| TF-02-02 | PB-05, PB-06 | Gabriel | Execução | Entregar busca/validações no servidor e manutenção dos vínculos | Busca por critérios disponíveis; unicidade de CPF verificada em criação/edição e concorrência; troca de titular e vínculos mantém história e contagem correta. | Fabricio |
| TF-02-03 | PB-05, PB-06, C-07 | Ruan | Execução | Entregar telas cadastrais e mapa de exportação/migração | Busca e manutenção de titular/vínculos integradas; amostra/formato/IDs e plano de corte documentados com a outra frente, com insumos de Gabriel; fonte ausente registrada como bloqueio. | Fabricio |
| TF-02-04 | PB-13 | Alan | Execução | Entregar regras, API e persistência do catálogo de atividades | Natureza periódica/pontual obrigatória; horários/responsável ou tipo pontual registrados; não trocar natureza com fatos nem apagar histórico ao encerrar. | Kauã |
| TF-02-05 | PB-13 | Kauã | Execução | Entregar interface de criação, consulta e encerramento de atividades | Telas integradas com natureza e campos correspondentes, validação, mensagens de bloqueio e preservação dos registros ao encerrar. | Alan |

**Parcela dos itens comuns:** Ruan executa C-07 com insumos de Gabriel e da outra frente, documentando fonte/mapeamento/corte. Fabricio revisa o plano e registra inconsistências.

**Sequência e demonstração:** PB-05 conclui busca e prevenção de duplicidade sobre o cadastro da S1; PB-06 mantém composição e titular histórico. Alan/Kauã concluem catálogo PB-13 para os atendimentos da outra frente na S3.

## Sprint 3 — 02/11/2026 a 06/11/2026

**Objetivo:** Numerações, ficha domiciliar/econômica, participantes e política versionada.

### Cartões da equipe — mesmos IDs e semana do geral

| ID | Entrega | Principal do cartão | Apoio/revisor | Dependências | Prazo |
|---|---|---|---|---|---|
| PB-07 | Registrar numerações de calçado e vestuário por pessoa | Ruan | Gabriel | C-01, C-02, C-03, PB-04 | Fim da sprint |
| PB-08 | Preencher situação domiciliar e composição econômica por membro | Ruan | Gabriel | C-01, C-02, C-03, PB-06 | Fim da sprint |
| PB-14 | Manter participantes e períodos de participação nas atividades | Kauã | Alan | C-01, C-02, C-03, PB-04, PB-06, PB-13 | Fim da sprint |
| PB-19 | Configurar e versionar a política de aptidão, sem valores presumidos | Alan | Fabricio (revisão) | C-01, C-02, C-03, PB-13 | Fim da sprint |

### Tarefas individuais — cada pessoa como responsável principal

| Tarefa | Origem | Responsável principal | Tipo | Entrega | Evidência de conclusão | Revisor |
|---|---|---|---|---|---|---|
| TF-03-01 | PB-07, PB-08, PB-14, PB-19, C-08 | Fabricio | Revisão | Revisar ficha, participantes e política versionada | Parecer sobre versões da ficha, numerações, participação, vigência da política implementada por Alan e mapa de migração; campos/regras não aprovados sinalizados. | — (parecer do revisor) |
| TF-03-02 | PB-08, C-08 | Gabriel | Execução | Implementar persistência versionada da ficha e mapas da migração | Primeira ficha preserva contexto/autor/data; mapas cadastral e de atividades/frequência da fonte disponíveis para os importadores. Fonte ausente vira bloqueio explícito; nenhuma migração é declarada concluída. | Ruan |
| TF-03-03 | PB-07, PB-08 | Ruan | Execução | Entregar numerações e formulário domiciliar/econômico | Numerações por pessoa com data; moradia/renda por membro persistidas; nenhuma classificação automática; leitura da versão inicial conferida. | Gabriel |
| TF-03-04 | PB-19 | Alan | Execução | Implementar configuração e versões da política de aptidão | Parâmetros institucionais aprovados, início de vigência/autor e seleção histórica da versão implementados; sem política válida, não há valor padrão. Alan produz contratos e testes; Fabricio revisa. | Fabricio |
| TF-03-05 | PB-14 | Kauã | Execução | Entregar gestão de participantes e períodos de participação | Inscrição, encerramento e lista na data de referência integrados; inscrição sozinha não gera presença; vínculo válido respeitado. | Alan |

**Parcela dos itens comuns:** Gabriel executa mapas/importadores iniciais de C-08 e persistência da ficha; Alan implementa PB-19. Fabricio revisa a aderência às regras e às decisões institucionais.

**Sequência e demonstração:** PB-06 já está disponível da S2. PB-08 começa com armazenamento versionado; PB-07 e PB-14 podem avançar em paralelo. Alan implementa política PB-19 e Fabricio revisa conforme decisão institucional; sem regra aprovada, função permanece pendente/bloqueada, não concluída ficticiamente.

## Sprint 4 — 09/11/2026 a 13/11/2026

**Objetivo:** Ficha completa/protegida e primeira chamada utilizável no celular.

### Cartões da equipe — mesmos IDs e semana do geral

| ID | Entrega | Principal do cartão | Apoio/revisor | Dependências | Prazo |
|---|---|---|---|---|---|
| PB-09 | Registrar escolaridade, necessidades e situação encontrada | Kauã | Ruan | C-01, C-02, C-03, PB-08 | Fim da sprint |
| PB-10 | Consultar versões da ficha e registrar ciência do titular | Ruan | Gabriel | C-01, C-02, C-03, PB-08, PB-09 | Fim da sprint |
| PB-11 | Aplicar proteção da ficha e habilitação condicionada de dados sensíveis | Gabriel | Ruan | C-01, C-02, C-03, PB-08 | Fim da sprint |
| PB-15 | Registrar encontro realizado e chamada em uma tela utilizável no celular | Alan | Kauã | C-01, C-02, C-03, PB-14 | Fim da sprint |

### Tarefas individuais — cada pessoa como responsável principal

| Tarefa | Origem | Responsável principal | Tipo | Entrega | Evidência de conclusão | Revisor |
|---|---|---|---|---|---|---|
| TF-04-01 | PB-09, PB-10, PB-11, PB-15, C-04, C-08 | Fabricio | Revisão | Revisar ficha protegida, chamada e contrato de aptidão | Revisar PRs, testes e evidências de versionamento/ciência, negação de acesso, chamada atômica e repetição; exemplos de aptidão identificados como fictícios; parecer de prontidão para S5. | — (parecer do revisor) |
| TF-04-02 | PB-11, C-08 | Gabriel | Execução | Entregar proteção da ficha e importador inicial de cadastros | Campos/perfis negados no servidor conforme matriz; saúde/religião continuam desativadas sem aprovação; importador marca origem/IDs e rejeições quando fonte disponível. | Ruan |
| TF-04-03 | PB-10 | Ruan | Execução | Entregar consulta de versões e registro de ciência | Nova edição cria versão, anterior continua consultável; troca posterior de titular não altera ficha antiga; ciência ausente não é consentimento. | Gabriel |
| TF-04-04 | PB-15, C-04, PB-19 | Alan | Execução | Implementar chamada e casos contratuais da aptidão | Chamada atômica com marcação explícita, repetição/conflito e família histórica; contrato/retornos da avaliação documentados e exercitados com exemplos fictícios até o motor real da S5. | Fabricio |
| TF-04-05 | PB-09, PB-15 | Kauã | Execução | Entregar blocos complementares da ficha e chamada responsiva | Escolaridade/necessidades/situação encontrada registradas antes de fechar PB-10; chamada móvel integrada, sem ausência automática. Participantes de PB-14 já concluídos na S3. | Ruan |

**Parcela dos itens comuns:** Alan prepara os casos de consumo de C-04; Gabriel continua importadores/controles de acesso, Kauã/Ruan entregam os blocos da ficha. Fabricio revisa contratos, testes e evidências, sem escrever os casos ou o código.

**Sequência e demonstração:** Kauã entrega PB-09 no início da semana para Ruan concluir PB-10; esse ordenamento é proposta interna, não novo prazo do geral. Alan constrói chamada sobre participantes PB-14 já concluídos na S3; Kauã implementa interface móvel. Gabriel aplica proteção específica da ficha.

## Sprint 5 — 16/11/2026 a 20/11/2026

**Objetivo:** Frequência corrigível e aptidão oficial para integração com a entrega.

### Cartões da equipe — mesmos IDs e semana do geral

| ID | Entrega | Principal do cartão | Apoio/revisor | Dependências | Prazo |
|---|---|---|---|---|---|
| PB-16 | Registrar presença de pessoa fora da lista, incluindo cadastro mínimo | Kauã | Gabriel | C-01, C-02, C-03, PB-15 | 20/11 |
| PB-17 | Corrigir chamada, lançar retroativamente e cancelar encontro com motivo | Alan | Kauã | C-01, C-02, C-03, PB-15 | Antes de PB-20 (pré-requisito) |
| PB-18 | Consultar frequência por pessoa, atividade e período com cálculo explicável | Ruan | Alan | C-01, C-02, C-03, PB-17 | 20/11 |
| PB-20 | Avaliar aptidão por data com três estados e evidências | Gabriel | Fabricio (revisão) | C-01, C-02, C-03, PB-06, PB-17, PB-19 | 18/11 |

### Tarefas individuais — cada pessoa como responsável principal

| Tarefa | Origem | Responsável principal | Tipo | Entrega | Evidência de conclusão | Revisor |
|---|---|---|---|---|---|---|
| TF-05-01 | PB-16, PB-17, PB-18, PB-20, C-04 | Fabricio | Revisão | Revisar correções, motor de aptidão e integração real | Revisar PB-17 até a meta de 17/11 e PB-20 assim que Gabriel disponibilizar, com janela proposta no início de 18/11; registrar três estados/evidências e parecer da integração real até 20/11. Correções ficam com os executores. | — (parecer do revisor) |
| TF-05-02 | PB-20, C-04 | Gabriel | Execução | Implementar motor de aptidão e integração oficial para 18/11 | Gabriel implementa consultas/evidências e os três estados por data/política; integra PB-17 após disponibilidade em 17/11. Disponibiliza avaliação no início de 18/11 como meta interna e participa do aceite real C-04 em 20/11. Fabricio revisa sem programar. | Fabricio |
| TF-05-03 | PB-18 | Ruan | Execução | Entregar consulta de frequência com totais explicáveis | Até 20/11, filtros, numerador/denominador e detalhamento corretos sobre correções já integradas; cancelados excluídos, denominador zero desconhecido. | Alan |
| TF-05-04 | PB-17, C-08 | Alan | Execução | Implementar correções, retroatividade e cancelamento antes do motor | PB-17 entregue até a meta interna de 17/11 com autoria/motivo/revisão e atualização dos cálculos. Depois do marco crítico, adaptar histórico de frequência para migração conforme fonte e capacidade disponíveis. | Fabricio |
| TF-05-05 | PB-16, PB-17 | Kauã | Execução | Entregar presença avulsa e roteiro da chamada corrigida | Até 20/11 presença fora da lista com vínculo válido e cadastro mínimo integrada, sem inscrição automática; revisar cenários de PB-17 até 17/11. | Gabriel |

**Parcela dos itens comuns:** Gabriel implementa PB-20 e a parcela produtora de C-04; outra frente consome. Alan/Kauã entregam e verificam correções. Fabricio revisa PB-17/PB-20 e as evidências da integração real. Depois dos marcos críticos, Alan adapta o histórico FRQ conforme capacidade.

**Sequência e demonstração:** 16–17/11: Alan/Kauã concluem e verificam PB-17, Gabriel implementa consultas/evidências e PB-20; Fabricio revisa as entregas. 18/11: meta de disponibilizar PB-20 cedo para a outra frente validar G-10 até o fim do ciclo 5a. 19–20/11: teste real com entrega/exceções para C-04; Ruan conclui PB-18 e Kauã PB-16 até 20/11. Qualquer atraso em PB-17/PB-20 é comunicado à outra liderança como bloqueio.

## Sprint 6 — 23/11/2026 a 27/11/2026

**Objetivo:** Consultas de aptidão, histórico e contribuições a relatórios/migração/operação.

### Cartões da equipe — mesmos IDs e semana do geral

| ID | Entrega | Principal do cartão | Apoio/revisor | Dependências | Prazo |
|---|---|---|---|---|---|
| PB-21 | Consultar famílias por situação de aptidão e data, com evidências | Ruan | Fabricio | C-01, C-02, C-03, PB-20 | Fim da sprint |
| PB-23 | Consultar histórico dos módulos próprios e fornecer dados ao histórico comum | Gabriel | Ruan | C-01, C-02, C-03, PB-06, PB-10, PB-18 | Fim da sprint |

### Tarefas individuais — cada pessoa como responsável principal

| Tarefa | Origem | Responsável principal | Tipo | Entrega | Evidência de conclusão | Revisor |
|---|---|---|---|---|---|---|
| TF-06-01 | PB-21, PB-23, C-05, C-06, C-08, C-09 | Fabricio | Revisão | Revisar histórico, relatórios, migração e restauração | Revisar código e relatórios de conferência fornecidos pelos executores; verificar preservação histórica, totais e evidências de restauração/migração; registrar pendências sem executar importação ou implantação. | — (parecer do revisor) |
| TF-06-02 | PB-23, C-08 | Gabriel | Execução | Entregar dados do histórico e conciliação da migração | Fatos CAD/FIC/FRQ fornecidos; contagens, origens e rejeições conciliadas para C-08; não duplicar histórico/saldo inicial nem declarar fonte indisponível como migrada. | Fabricio |
| TF-06-03 | PB-21, C-05 | Ruan | Execução | Implementar consulta de aptidão e histórico consolidado | Ruan implementa composição/consulta do histórico com PB-23 e G-15, e lista/detalhe de aptidão com autorização, data e evidências; Fabricio revisa os resultados. | Fabricio |
| TF-06-04 | C-06, C-08 | Alan | Execução | Entregar conjunto conciliado de frequência para alcance/migração | Contagens e detalhes de encontros/pessoas batem; cancelamento e vínculo histórico aplicados; registros de conferência entregues. | Gabriel |
| TF-06-05 | C-09 | Kauã | Execução | Entregar roteiro de restauração do recorte e executá-lo com a operação | Restaurar ambiente de ensaio com dados aprovados/sintéticos; confirmar cadastro/ficha/chamada e permissões; registrar resultado e corrigir falhas do recorte. | Alan |

**Parcela dos itens comuns:** Ruan implementa a composição/consulta de C-05; Gabriel fornece PB-23 e confere migração; Alan fornece dados de C-06/C-08; Kauã executa o ensaio de C-09. Fabricio revisa o código, os relatórios e a evidência operacional, sem implementar ou executar importação/restauração.

**Sequência e demonstração:** PB-23 e G-15 fornecem os fatos antes do aceite de C-05; C-06 depende ainda de PB-18/PB-21 e G-14. A equipe entrega somente sua parcela desses cartões compartilhados. Conferir migração e restauração com as fontes/decisões disponíveis.

## Sprint 7 — 30/11/2026 a 04/12/2026

**Objetivo:** Homologação, correções, capacitação e entrega final do recorte.

Sem novo PB: as tarefas desta semana são a parcela nominal de C-10, com entregas próprias por integrante.

### Tarefas individuais — cada pessoa como responsável principal

| Tarefa | Origem | Responsável principal | Tipo | Entrega | Evidência de conclusão | Revisor |
|---|---|---|---|---|---|---|
| TF-07-01 | C-10 | Fabricio | Revisão | Revisar versão final, documentação e evidências de aceite | Parecer final registrado sobre os PRs, documentação, resultados dos roteiros e pendências da versão preparada pelos executores; aceite institucional identificado separadamente. | — (parecer do revisor) |
| TF-07-02 | C-10 | Gabriel | Execução | Entregar validação final e documentação de cadastro/dados | Cenários de CPF/vínculo/histórico/migração registrados, bloqueadores corrigidos e instruções de dados entregues. | Ruan |
| TF-07-03 | C-10 | Ruan | Execução | Entregar manual e validação final da ficha social | Manual do operador, versão/ciência/perfil exercitados, telas e erros impeditivos corrigidos. | Kauã |
| TF-07-04 | C-10 | Alan | Execução | Entregar validação final e documentação de atividades/frequência | Roteiro de participação/chamada/correção/cancelamento aprovado e regras/documentação atualizadas. | Fabricio |
| TF-07-05 | C-10 | Kauã | Execução | Entregar pacote final, roteiro integrado e validação em celular | Kauã prepara a versão/pacote de entrega com os demais executores, realiza roteiro integrado e capacitação, documenta evidências e corrige interfaces. Fabricio recebe os materiais para revisão. | Fabricio |

**Parcela dos itens comuns:** Gabriel, Ruan, Alan e Kauã corrigem, documentam, demonstram e preparam a versão final de C-10. Fabricio faz somente revisão final de código, documentação e evidências; o aceite de negócio é institucional.

**Sequência e demonstração:** Demonstrar jornadas, corrigir bloqueadores e entregar documentação/versão até 04/12. Sem dados migrados e conferidos, registrar pendência e não declarar substituição do Bússola. Evitar novos desejáveis.

## Marcos internos da equipe

| Meta | Entrega | Responsável |
|---|---|---|
| 23/10 | PB-03/PB-04/PB-12 e acesso comum integrados; contratos de C-04 conhecidos. | Gabriel/Ruan/Alan/Kauã executam; Fabricio revisa |
| 30/10 | PB-05/PB-06/PB-13 e amostra/plano de corte encaminhados. | Gabriel/Alan/Ruan/Kauã executam; Fabricio revisa |
| 06/11 | PB-07/PB-08/PB-14/PB-19 demonstrados; campos, acesso e regra decididos ou bloqueados. | Ruan, Gabriel, Kauã e Alan executam; Fabricio revisa |
| 13/11 | PB-09/PB-10/PB-11/PB-15 e verificação do contrato C-04 disponíveis. | Kauã/Ruan/Gabriel/Alan executam; Fabricio revisa |
| 17/11 — meta interna proposta | PB-17 e evidências/vínculos prontos para PB-20. | Alan entrega; Kauã confere cenários; Gabriel prepara o motor; Fabricio revisa |
| 18/11 — prazo do geral | PB-20 oficial; meta interna de entrega cedo para viabilizar G-10 no mesmo dia. | Gabriel implementa/disponibiliza; Fabricio revisa; outra liderança confirma consumo |
| 20/11 | PB-16/PB-18 e aceite real C-04 com G-11/G-12 da outra frente. | Kauã/Ruan/Alan/Gabriel executam; Fabricio revisa evidências |
| 27/11 | PB-21/PB-23 e parcela de C-05/C-06/C-08/C-09 conferidos. | Os quatro executores conforme TF da S6; Fabricio revisa |
| 04/12 | Parcela de C-10 entregue e pendências identificadas. | Os quatro executores preparam/entregam; Fabricio revisa a versão e os materiais |

## Conclusão, capacidade e acompanhamento

Estimar tarefas com o código e a disponibilidade reais; reservar tempo para liderança, revisão e correções e descontar ausências/feriados. Não há declaração de viabilidade em horas sem essas informações. Como S1 já começou no calendário, registrar o andamento real na próxima reunião; nenhuma tarefa deste documento foi presumida concluída.

As TF de execução exigem a implementação/entrega e evidência indicadas, revisadas por outra pessoa. As sete TF de Fabricio exigem um parecer de revisão com referências aos PRs/evidências, resultado e pendências; não exigem implementação nem produção dos artefatos revisados. Se principal e revisor escreverem a mesma mudança, um terceiro revisa. Os quatro executores testam e corrigem seus módulos; Fabricio revisa código e evidências de testes. Kauã não é responsável exclusivo pela qualidade. Cada PB exige também todo o aceite do Product Backlog. Tarefas comuns consomem a mesma capacidade da equipe, sem uma terceira equipe fictícia.

Interface em português e formatos locais; chamada utilizável no celular; autorização no servidor; auditoria e contexto histórico preservados. Informação ausente não vira zero, ausência ou Não apta. Operações repetidas não duplicam fatos; conflitos não sobrescrevem silenciosamente. Dados sensíveis e uso de dados reais dependem das decisões institucionais aplicáveis; enquanto pendentes, usar dados sintéticos e campos bloqueados.

As TF de migração podem entregar mapeamento/implementação com exemplos, mas migração real só é aceita com fonte e conferência. Se a fonte não chegar, registrar bloqueio de C-08; não trocar a entrega por mock nem declarar Bússola substituído. Sem regra aprovada, aptidão permanece Pendente e o aceite institucional da função está bloqueado.

F-R01 continua essencial em conciliação; decidir e estimar impacto se mantido. F-R02 a F-R06 continuam desejáveis de reserva, sem inclusão automática nas sete sprints. AC-15 depende de F-R01; AC-17 pertence à evolução da outra frente. Acompanhamento breve por dia de trabalho; revisão/demonstração ao fim de cada semana; bloqueios têm dono e impacto registrados.
