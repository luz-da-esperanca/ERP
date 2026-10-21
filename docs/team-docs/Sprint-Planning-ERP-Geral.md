# Sprint Planning — Geral revisado

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

## Limites e decisões de produto

CRM e doações financeiras, vendas/caixa/financeiro/estoque comercial do Bazar, Escola Espírita e prontuário clínico continuam fora do ERP. Identificar doador de itens não cria CRM. Recebimento manual com referência única do Bazar pode atender à integração se aprovado; não implica implementar o sistema comercial.

CPF opcional, válido e único quando informado, desde a criação de pessoas em S1. Busca preventiva/experiência de erro são completadas em PB-05/S2. Sem central de duplicidades conforme o PRD atualizado; F-R01 mantém a conciliação de RF-CAD-07/RF-REL-09 com a SPEC-CAD não anexada. Saúde/religião e uso de dados reais dependem das decisões institucionais; enquanto pendentes, dados sintéticos e campos bloqueados. Aptidão sem política/evidência suficiente é Pendente. Migração continua essencial, condicionada à fonte e conferência; não é silenciosamente removida por falta de exportação.

## Calendário geral de integração

| Semana geral | Início | Fim | Equipe Fabricio | Equipe Gabriel |
|---|---|---|---|---|
| S1 | 19/10/2026 | 23/10/2026 | Sprint 1 | Ciclo 1 — início |
| S2 | 26/10/2026 | 30/10/2026 | Sprint 2 | Ciclo 1 — conclusão |
| S3 | 02/11/2026 | 06/11/2026 | Sprint 3 | Ciclo 2 |
| S4 | 09/11/2026 | 13/11/2026 | Sprint 4 | Ciclo 3 |
| S5 | 16/11/2026 | 20/11/2026 | Sprint 5 | Ciclos 4/5 — 5a e 5b |
| S6 | 23/11/2026 | 27/11/2026 | Sprint 6 | Ciclo 6 |
| S7 | 30/11/2026 | 04/12/2026 | Sprint 7 | Ciclo 7 |

## Correspondência dos ciclos Gabriel

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

## Semana geral S1 — 19/10/2026 a 23/10/2026

### Cartões/fases de produto e base comum

| ID | Entrega | Executor principal / parcela | Apoio ou revisão | Fase/meta | Dependências |
|---|---|---|---|---|---|
| PB-03 | Como operador, cadastrar e consultar uma família identificada por número único | Gabriel (dev da equipe Fabricio) | Ruan | S1 | C-01, C-02, C-03 |
| PB-04 | Como operador, cadastrar pessoa e vínculo familiar, inclusive cadastro mínimo | Ruan | Gabriel (dev da equipe Fabricio) | S1 | C-01, C-02, C-03, PB-03 |
| PB-12 | Manter institutos e projetos com situação e vigência | Alan | Kauã | S1 | C-01, C-02, C-03 |
| G-01 | Cadastrar itens, categorias, unidades e numerações | G2 | G3 | S1–S2 (fim 30/10) | C-01, C-02, C-03 |
| G-02 | Identificar origens: doadores de itens e campanhas | G4 | G5 | S1–S2 (fim 30/10) | C-02 |
| C-01 | Acordar arquitetura, contratos, decisões e ambiente integrado | Alan (Fabricio) + G3 (Gabriel) | Fabricio + Gabriel (líder) | S1; contrato revisado durante o projeto | — |
| C-02 | Login, usuários, perfis e proteção de acesso | Alan + Kauã (Fabricio) | Fabricio; Gabriel (líder) revisa acesso da sua frente | S1; aplicar perfis em todos os módulos | C-01 |
| C-03 | Auditoria, datas históricas e consistência das operações | G3 | Gabriel (líder) + Fabricio | S1; transações próprias integradas durante o desenvolvimento | C-01 |

G-01/G-02 apenas iniciam nesta semana; não contar conclusão antes de 30/10.

### Equipe Fabricio — tarefas principais

| Tarefa | Origem | Principal | Tipo | Entrega | Evidência de conclusão | Revisor |
|---|---|---|---|---|---|---|
| TF-01-01 | C-01, C-02, C-03, C-04, PB-03, PB-04, PB-12 | Fabricio | Revisão | Revisar contratos, segurança e cadastros da S1 | Parecer registrado sobre contratos/autenticação, autorização, CPF e vínculo mínimo, projetos e auditoria; PRs/evidências analisados e pendências com item responsável. | — (parecer do revisor) |
| TF-01-02 | PB-03, PB-04, C-01 | Gabriel (dev da equipe Fabricio) | Execução | Implementar família/pessoa/vínculo e contratos cadastrais | APIs e contratos de família/pessoa/vínculo publicados; CPF opcional válido/único quando informado, autoria e permissões aplicadas; dados recuperáveis pela interface. | Ruan |
| TF-01-03 | PB-03, PB-04 | Ruan | Execução | Entregar formulários de família e cadastro mínimo de pessoa | Fluxo completo de família → pessoa vinculada integrado à API, com campos pendentes sinalizados e sem CPF obrigatório. | Gabriel (dev da equipe Fabricio) |
| TF-01-04 | PB-12, C-01, C-02, C-03 | Alan | Execução | Implementar projetos e integração de autenticação/autorização no servidor | Cadastro de institutos/projetos disponível; autenticação e perfis comuns integrados; autoria/auditoria conectadas ao mecanismo conduzido pela outra frente. Contratos/documentação técnica produzidos. | Fabricio |
| TF-01-05 | C-02 | Kauã | Execução | Entregar login, sessão e navegação protegida na interface | Login integrado ao serviço comum; logout, sessão inválida e negação de acesso tratados. Tela não substitui autorização no servidor. Kauã é responsável principal por esta tarefa. | Fabricio |

### Equipe Gabriel — ciclo 1

| Tarefa | Origem | Principal | Tipo | Entrega | Evidência de conclusão | Revisor |
|---|---|---|---|---|---|---|
| TG-01-01 | C-01, C-02, C-03, G-01, G-02 | Gabriel (líder) | Revisão | Revisar contratos, acesso, auditoria e catálogos | Parecer sobre PRs/contratos, unidades e origem; registrar pendências. Revisão intermediária em 23/10 e final dos catálogos em 30/10; não conta duas conclusões. | — |
| TG-01-02 | G-01 | G2 | Execução | Implementar catálogo de itens e unidades | API/persistência de item/categoria/unidade/numeração implementadas com quantidade decimal e bloqueio de conversão implícita; versão mínima demonstrada em 23/10 e concluída em 30/10. | G3 |
| TG-01-03 | C-01, C-03, G-01 | G3 | Execução | Implementar auditoria/repetição comuns e validar unidades | Mecanismo de auditoria com datas do fato/lançamento e conflito/repetição disponível na S1 geral; aplicação dos tipos/unidades conferida com G2 até 30/10. | Gabriel (líder) |
| TG-01-04 | G-02, C-07 | G4 | Execução | Implementar origens de itens e mapear dados da fonte | Doador de itens/campanha registrados sem criar CRM; cadastro inicial em 23/10 e integração em 30/10; mapear origem/exportação do seu recorte com Ruan para C-07, ou registrar bloqueio. | G5 |
| TG-01-05 | G-01, G-02, C-09 | G5 | Execução | Entregar interfaces dos catálogos e ambiente operacional inicial | Listas/formulários integrados a G2/G4, com permissões e dados desconhecidos; ambiente, controles e rotina inicial de backup configurados com a base comum desde S1 geral. | G2 |

As TG-01 são as mesmas tarefas em andamento ao longo do ciclo de duas semanas; o quadro registra progresso/fim sem duplicar trabalho.

## Semana geral S2 — 26/10/2026 a 30/10/2026

### Cartões/fases de produto e base comum

| ID | Entrega | Executor principal / parcela | Apoio ou revisão | Fase/meta | Dependências |
|---|---|---|---|---|---|
| PB-05 | Buscar cadastros antes de criar e impedir CPF inválido ou repetido | Gabriel (dev da equipe Fabricio) | Kauã | S2 | C-01, C-02, C-03, PB-04 |
| PB-06 | Trocar titular, encerrar/alterar vínculos e consultar composição histórica | Gabriel (dev da equipe Fabricio) | Fabricio | S2 | C-01, C-02, C-03, PB-04 |
| PB-13 | Cadastrar atividades periódicas/pontuais e encerrá-las preservando registros | Alan | Kauã | S2 | C-01, C-02, C-03, PB-12 |
| G-01 | Cadastrar itens, categorias, unidades e numerações | G2 | G3 | S1–S2 (fim 30/10) | C-01, C-02, C-03 |
| G-02 | Identificar origens: doadores de itens e campanhas | G4 | G5 | S1–S2 (fim 30/10) | C-02 |
| C-07 | Mapear exportação do Bússola e planejar corte | Ruan (Fabricio) + G4 | Fabricio + Gabriel (líder) | S2, fonte/mapeamento/corte | C-01 |

### Equipe Fabricio — tarefas principais

| Tarefa | Origem | Principal | Tipo | Entrega | Evidência de conclusão | Revisor |
|---|---|---|---|---|---|---|
| TF-02-01 | C-07, PB-05, PB-06, PB-13 | Fabricio | Revisão | Revisar busca, vínculos, atividades e plano de migração | Revisar validação/unicidade de CPF, histórico de titular/vínculos, natureza/encerramento da atividade e mapa de exportação produzido pelos executores; registrar parecer e bloqueios. | — (parecer do revisor) |
| TF-02-02 | PB-05, PB-06 | Gabriel (dev da equipe Fabricio) | Execução | Entregar busca/validações no servidor e manutenção dos vínculos | Busca por critérios disponíveis; unicidade de CPF verificada em criação/edição e concorrência; troca de titular e vínculos mantém história e contagem correta. | Fabricio |
| TF-02-03 | PB-05, PB-06, C-07 | Ruan | Execução | Entregar telas cadastrais e mapa de exportação/migração | Busca e manutenção de titular/vínculos integradas; amostra/formato/IDs e plano de corte documentados com a outra frente, com insumos de Gabriel; fonte ausente registrada como bloqueio. | Fabricio |
| TF-02-04 | PB-13 | Alan | Execução | Entregar regras, API e persistência do catálogo de atividades | Natureza periódica/pontual obrigatória; horários/responsável ou tipo pontual registrados; não trocar natureza com fatos nem apagar histórico ao encerrar. | Kauã |
| TF-02-05 | PB-13 | Kauã | Execução | Entregar interface de criação, consulta e encerramento de atividades | Telas integradas com natureza e campos correspondentes, validação, mensagens de bloqueio e preservação dos registros ao encerrar. | Alan |

### Equipe Gabriel — ciclo 1

| Tarefa | Origem | Principal | Tipo | Entrega | Evidência de conclusão | Revisor |
|---|---|---|---|---|---|---|
| TG-01-01 | C-01, C-02, C-03, G-01, G-02 | Gabriel (líder) | Revisão | Revisar contratos, acesso, auditoria e catálogos | Parecer sobre PRs/contratos, unidades e origem; registrar pendências. Revisão intermediária em 23/10 e final dos catálogos em 30/10; não conta duas conclusões. | — |
| TG-01-02 | G-01 | G2 | Execução | Implementar catálogo de itens e unidades | API/persistência de item/categoria/unidade/numeração implementadas com quantidade decimal e bloqueio de conversão implícita; versão mínima demonstrada em 23/10 e concluída em 30/10. | G3 |
| TG-01-03 | C-01, C-03, G-01 | G3 | Execução | Implementar auditoria/repetição comuns e validar unidades | Mecanismo de auditoria com datas do fato/lançamento e conflito/repetição disponível na S1 geral; aplicação dos tipos/unidades conferida com G2 até 30/10. | Gabriel (líder) |
| TG-01-04 | G-02, C-07 | G4 | Execução | Implementar origens de itens e mapear dados da fonte | Doador de itens/campanha registrados sem criar CRM; cadastro inicial em 23/10 e integração em 30/10; mapear origem/exportação do seu recorte com Ruan para C-07, ou registrar bloqueio. | G5 |
| TG-01-05 | G-01, G-02, C-09 | G5 | Execução | Entregar interfaces dos catálogos e ambiente operacional inicial | Listas/formulários integrados a G2/G4, com permissões e dados desconhecidos; ambiente, controles e rotina inicial de backup configurados com a base comum desde S1 geral. | G2 |

As TG-01 são as mesmas tarefas em andamento ao longo do ciclo de duas semanas; o quadro registra progresso/fim sem duplicar trabalho.

## Semana geral S3 — 02/11/2026 a 06/11/2026

### Cartões/fases de produto e base comum

| ID | Entrega | Executor principal / parcela | Apoio ou revisão | Fase/meta | Dependências |
|---|---|---|---|---|---|
| PB-07 | Registrar numerações de calçado e vestuário por pessoa | Ruan | Gabriel (dev da equipe Fabricio) | S3 | C-01, C-02, C-03, PB-04 |
| PB-08 | Preencher situação domiciliar e composição econômica por membro | Ruan | Gabriel (dev da equipe Fabricio) | S3 | C-01, C-02, C-03, PB-06 |
| PB-14 | Manter participantes e períodos de participação nas atividades | Kauã | Alan | S3 | C-01, C-02, C-03, PB-04, PB-06, PB-13 |
| PB-19 | Configurar e versionar a política de aptidão, sem valores presumidos | Alan | Fabricio (somente revisão) | S3 | C-01, C-02, C-03, PB-13 |
| G-03 | Registrar atendimento à pessoa ou à família | G2 | G3 | S3 | PB-04, PB-13, C-02, C-03 |
| G-04 | Registrar visita domiciliar | G4 | G2 | S3 | G-03 |
| G-05 | Corrigir e cancelar atendimentos | G5 | G3 | S3 | G-03, C-03 |

### Equipe Fabricio — tarefas principais

| Tarefa | Origem | Principal | Tipo | Entrega | Evidência de conclusão | Revisor |
|---|---|---|---|---|---|---|
| TF-03-01 | PB-07, PB-08, PB-14, PB-19, C-08 | Fabricio | Revisão | Revisar ficha, participantes e política versionada | Parecer sobre versões da ficha, numerações, participação, vigência da política implementada por Alan e mapa de migração; campos/regras não aprovados sinalizados. | — (parecer do revisor) |
| TF-03-02 | PB-08, C-08 | Gabriel (dev da equipe Fabricio) | Execução | Implementar persistência versionada da ficha e mapas da migração | Primeira ficha preserva contexto/autor/data; mapas cadastral e de atividades/frequência da fonte disponíveis para os importadores. Fonte ausente vira bloqueio explícito; nenhuma migração é declarada concluída. | Ruan |
| TF-03-03 | PB-07, PB-08 | Ruan | Execução | Entregar numerações e formulário domiciliar/econômico | Numerações por pessoa com data; moradia/renda por membro persistidas; nenhuma classificação automática; leitura da versão inicial conferida. | Gabriel (dev da equipe Fabricio) |
| TF-03-04 | PB-19 | Alan | Execução | Implementar configuração e versões da política de aptidão | Parâmetros institucionais aprovados, início de vigência/autor e seleção histórica da versão implementados; sem política válida, não há valor padrão. Alan produz contratos e testes; Fabricio revisa. | Fabricio |
| TF-03-05 | PB-14 | Kauã | Execução | Entregar gestão de participantes e períodos de participação | Inscrição, encerramento e lista na data de referência integrados; inscrição sozinha não gera presença; vínculo válido respeitado. | Alan |

### Equipe Gabriel — ciclo 2

| Tarefa | Origem | Principal | Tipo | Entrega | Evidência de conclusão | Revisor |
|---|---|---|---|---|---|---|
| TG-02-01 | G-03, G-04, G-05 | Gabriel (líder) | Revisão | Revisar atendimentos, visita e correções | Parecer sobre vínculo histórico, executor/operador, cancelamento e observações sem prontuário; PRs/evidências e pendências registrados. | — |
| TG-02-02 | G-03 | G2 | Execução | Implementar registro de atendimento | Atendimento à pessoa ou família com data, tipo, executor e operador; cadastro mínimo integrado; repetição em outras datas não cria presença. | G3 |
| TG-02-03 | G-03, C-03 | G3 | Execução | Entregar interface de atendimento e integração à auditoria | Fluxo de escolha pessoa/família/atividade e confirmação integrado; datas, autoria e dados autorizados conferidos. | G2 |
| TG-02-04 | G-04 | G4 | Execução | Implementar visita domiciliar | Visita vinculada à família com data, executor e situação encontrada; acesso restrito e sem sobrescrever ficha automaticamente; LAC-13 aplicada. | G2 |
| TG-02-05 | G-05 | G5 | Execução | Implementar correção e cancelamento do atendimento | Motivo, autor, revisão esperada e valores anteriores preservados; cancelados separados dos atendimentos válidos nos totais. | G3 |

## Semana geral S4 — 09/11/2026 a 13/11/2026

### Cartões/fases de produto e base comum

| ID | Entrega | Executor principal / parcela | Apoio ou revisão | Fase/meta | Dependências |
|---|---|---|---|---|---|
| PB-09 | Registrar escolaridade, necessidades e situação encontrada | Kauã | Ruan | S4 | C-01, C-02, C-03, PB-08 |
| PB-10 | Consultar versões da ficha e registrar ciência do titular | Ruan | Gabriel (dev da equipe Fabricio) | S4 | C-01, C-02, C-03, PB-08, PB-09 |
| PB-11 | Aplicar proteção da ficha e habilitação condicionada de dados sensíveis | Gabriel (dev da equipe Fabricio) | Ruan | S4 | C-01, C-02, C-03, PB-08 |
| PB-15 | Registrar encontro realizado e chamada em uma tela utilizável no celular | Alan | Kauã | S4 | C-01, C-02, C-03, PB-14 |
| G-06 | Registrar entrada e triagem de itens | G4 | G5 | S4 | G-01, G-02, C-03 |
| G-07 | Consultar lotes, validade, disponibilidade e movimentos | G2 | G4 | S4 | G-06 |

### Equipe Fabricio — tarefas principais

| Tarefa | Origem | Principal | Tipo | Entrega | Evidência de conclusão | Revisor |
|---|---|---|---|---|---|---|
| TF-04-01 | PB-09, PB-10, PB-11, PB-15, C-04, C-08 | Fabricio | Revisão | Revisar ficha protegida, chamada e contrato de aptidão | Revisar PRs, testes e evidências de versionamento/ciência, negação de acesso, chamada atômica e repetição; exemplos de aptidão identificados como fictícios; parecer de prontidão para S5. | — (parecer do revisor) |
| TF-04-02 | PB-11, C-08 | Gabriel (dev da equipe Fabricio) | Execução | Entregar proteção da ficha e importador inicial de cadastros | Campos/perfis negados no servidor conforme matriz; saúde/religião continuam desativadas sem aprovação; importador marca origem/IDs e rejeições quando fonte disponível. | Ruan |
| TF-04-03 | PB-10 | Ruan | Execução | Entregar consulta de versões e registro de ciência | Nova edição cria versão, anterior continua consultável; troca posterior de titular não altera ficha antiga; ciência ausente não é consentimento. | Gabriel (dev da equipe Fabricio) |
| TF-04-04 | PB-15, C-04, PB-19 | Alan | Execução | Implementar chamada e casos contratuais da aptidão | Chamada atômica com marcação explícita, repetição/conflito e família histórica; contrato/retornos da avaliação documentados e exercitados com exemplos fictícios até o motor real da S5. | Fabricio |
| TF-04-05 | PB-09, PB-15 | Kauã | Execução | Entregar blocos complementares da ficha e chamada responsiva | Escolaridade/necessidades/situação encontrada registradas antes de fechar PB-10; chamada móvel integrada, sem ausência automática. Participantes de PB-14 já concluídos na S3. | Ruan |

### Equipe Gabriel — ciclo 3

| Tarefa | Origem | Principal | Tipo | Entrega | Evidência de conclusão | Revisor |
|---|---|---|---|---|---|---|
| TG-03-01 | G-06, G-07, C-04, C-08 | Gabriel (líder) | Revisão | Revisar entrada/triagem, saldo e preparação da entrega | Parecer sobre aceitos/descartados, lotes/validade, saldo e fundamentos da transação; casos de aptidão ainda fictícios identificados. | — |
| TG-03-02 | G-07, G-11 | G2 | Execução | Implementar consulta de lotes/validade e iniciar serviço de entrega | Saldo físico/disponível e movimentos consultáveis; vencidos bloqueados. Estrutura do serviço de entrega iniciada sob o contrato, sem declarar G-11 concluído. | G4 |
| TG-03-03 | C-03, C-04, G-11, C-08 | G3 | Execução | Implementar base transacional/idempotência da entrega e mapear migração | Operação atômica e chave de repetição integradas em ambiente de teste; cenários de concorrência preparados com G2; histórico/origem do seu recorte mapeados. Aceite real aguarda G-10/PB-20. | G2 |
| TG-03-04 | G-06 | G4 | Execução | Implementar entrada e triagem de itens | Recebido/aceito/descartado com motivo; apenas aceito gera lote/saldo; repetição da confirmação não duplica efeitos. | G5 |
| TG-03-05 | G-06, G-07, C-09 | G5 | Execução | Entregar interfaces de recebimento e disponibilidade | Registro e consulta de lotes/validade/saldo integrados com mensagens de erro e perfil; backups/controles operacionais mantidos. | G4 |

## Semana geral S5 — 16/11/2026 a 20/11/2026

### Cartões/fases de produto e base comum

| ID | Entrega | Executor principal / parcela | Apoio ou revisão | Fase/meta | Dependências |
|---|---|---|---|---|---|
| PB-16 | Registrar presença de pessoa fora da lista, incluindo cadastro mínimo | Kauã | Gabriel (dev da equipe Fabricio) | S5 | C-01, C-02, C-03, PB-15 |
| PB-17 | Corrigir chamada, lançar retroativamente e cancelar encontro com motivo | Alan | Kauã | S5 | C-01, C-02, C-03, PB-15 |
| PB-18 | Consultar frequência por pessoa, atividade e período com cálculo explicável | Ruan | Alan | S5 | C-01, C-02, C-03, PB-17 |
| PB-20 | Avaliar aptidão por data com três estados e evidências | Gabriel (dev da equipe Fabricio) | Fabricio (somente revisão) | S5 | C-01, C-02, C-03, PB-06, PB-17, PB-19 |
| G-08 | Registrar ajustes, inventário e saldo inicial | G3 | G5 | S5/5a (18/11) | G-07 |
| G-09 | Receber e conferir transferências do Bazar | G4 | G3 | S5/5a (18/11) | G-06, G-07 |
| G-10 | Preparar entrega consultando família, necessidades e aptidão | G2 | G5 | S5/5a (18/11) | PB-04, PB-09, PB-20, G-07 |
| G-11 | Confirmar entrega e baixa atômica, segura contra repetição | G2 | G3 | S5/5b (20/11) | G-10, G-03, C-03 |
| G-12 | Tratar exceções de aptidão na entrega | G4 | G5 | S5/5b (20/11) | G-10, PB-20 |
| C-04 | Formalizar e validar integração de aptidão com entregas | Gabriel (dev da equipe Fabricio) + G2/G4 | Fabricio + Gabriel (líder) | Contrato S1; exemplos S4; avaliação real 18/11; aceite 20/11 | PB-20, G-11, G-12 |

### Equipe Fabricio — tarefas principais

| Tarefa | Origem | Principal | Tipo | Entrega | Evidência de conclusão | Revisor |
|---|---|---|---|---|---|---|
| TF-05-01 | PB-16, PB-17, PB-18, PB-20, C-04 | Fabricio | Revisão | Revisar correções, motor de aptidão e integração real | Revisar PB-17 até a meta de 17/11 e PB-20 assim que Gabriel disponibilizar, com janela proposta no início de 18/11; registrar três estados/evidências e parecer da integração real até 20/11. Correções ficam com os executores. | — (parecer do revisor) |
| TF-05-02 | PB-20, C-04 | Gabriel (dev da equipe Fabricio) | Execução | Implementar motor de aptidão e integração oficial para 18/11 | Gabriel implementa consultas/evidências e os três estados por data/política; integra PB-17 após disponibilidade em 17/11. Disponibiliza avaliação no início de 18/11 como meta interna e participa do aceite real C-04 em 20/11. Fabricio revisa sem programar. | Fabricio |
| TF-05-03 | PB-18 | Ruan | Execução | Entregar consulta de frequência com totais explicáveis | Até 20/11, filtros, numerador/denominador e detalhamento corretos sobre correções já integradas; cancelados excluídos, denominador zero desconhecido. | Alan |
| TF-05-04 | PB-17, C-08 | Alan | Execução | Implementar correções, retroatividade e cancelamento antes do motor | PB-17 entregue até a meta interna de 17/11 com autoria/motivo/revisão e atualização dos cálculos. Depois do marco crítico, adaptar histórico de frequência para migração conforme fonte e capacidade disponíveis. | Fabricio |
| TF-05-05 | PB-16, PB-17 | Kauã | Execução | Entregar presença avulsa e roteiro da chamada corrigida | Até 20/11 presença fora da lista com vínculo válido e cadastro mínimo integrada, sem inscrição automática; revisar cenários de PB-17 até 17/11. | Gabriel (dev da equipe Fabricio) |

### Equipe Gabriel — ciclo 4

| Tarefa | Origem | Principal | Tipo | Entrega | Evidência de conclusão | Revisor |
|---|---|---|---|---|---|---|
| TG-04-01 | G-08, G-09, G-10, C-04 | Gabriel (líder) | Revisão | Revisar inventário, Bazar e preparação real da entrega | Parecer até 18/11: inventário, referência única Bazar, aptidão e necessidades autorizadas. Em 16–17/11 revisar preparação; avaliação oficial só após PB-20 disponível. | — |
| TG-04-02 | G-10, G-11 | G2 | Execução | Entregar preparação da entrega e integrar avaliação oficial | Família/retirante/itens/saldo/necessidades selecionados; integrar PB-20 em 18/11 antes do aceite de G-10. Continuar a transação iniciada no ciclo anterior; mock não conclui integração. | G5 |
| TG-04-03 | G-08, G-11 | G3 | Execução | Implementar inventário, ajustes e saldo inicial | Contagem/diferença e ajuste confirmado com motivo/revisão; saldo inicial por lote sem doação fictícia e sem duplicar histórico. Casos de repetição/concorrência de entrega prontos antes do ciclo 5b. | G5 |
| TG-04-04 | G-09, G-12 | G4 | Execução | Implementar recebimento Bazar e preparar exceções de entrega | Referência única e conferência informado/recebido; só aceito disponível; origem separada da arrecadação. Estrutura de exceção sob política aprovada pronta para conclusão no ciclo seguinte. | G3 |
| TG-04-05 | G-08, G-10 | G5 | Execução | Entregar telas de inventário e preparação da entrega | Contagem/ajuste integrados a G3; tela de entrega consome G2 e exibe evidência real em 18/11, respeitando dados permitidos. | G2 |

### Equipe Gabriel — ciclo 5

| Tarefa | Origem | Principal | Tipo | Entrega | Evidência de conclusão | Revisor |
|---|---|---|---|---|---|---|
| TG-05-01 | G-11, G-12, C-04 | Gabriel (líder) | Revisão | Revisar confirmação atômica, exceções e integração real | Parecer sobre tudo-ou-nada, repetição/concorrência, saldo, avaliação vigente e justificativa/autorizador; bloqueadores identificados antes do aceite em 20/11. | — |
| TG-05-02 | G-11, C-04 | G2 | Execução | Concluir confirmação atômica da entrega | Entrega, atendimento e movimento gravados juntos ou nada; saldo protegido; com saldo 5 e entrega repetida de 2 resta 3 e existe uma única entrega. | G3 |
| TG-05-03 | G-11, C-03 | G3 | Execução | Concluir idempotência, concorrência e recuperação de falhas | Reexecução e conteúdo conflitante tratados; falha não deixa fatos parciais nem consome operação indevidamente; concorrência não causa saldo negativo. | G2 |
| TG-05-04 | G-12, C-04 | G4 | Execução | Concluir exceções e validação da aptidão na confirmação | Não apta/Pendente tratadas conforme política aprovada, com motivo/autorizador; validar família/data/revisões da avaliação sem recalcular o motor; sem bloqueio inventado. | G5 |
| TG-05-05 | G-11, G-12 | G5 | Execução | Entregar fluxo final de confirmação no celular | Tela integrada com transação/erros/justificativa e proteção de acesso; roteiro de repetição/falha entregue com evidências até 20/11. | G4 |

## Semana geral S6 — 23/11/2026 a 27/11/2026

### Cartões/fases de produto e base comum

| ID | Entrega | Executor principal / parcela | Apoio ou revisão | Fase/meta | Dependências |
|---|---|---|---|---|---|
| PB-21 | Consultar famílias por situação de aptidão e data, com evidências | Ruan | Fabricio | S6 | C-01, C-02, C-03, PB-20 |
| PB-23 | Consultar histórico dos módulos próprios e fornecer dados ao histórico comum | Gabriel (dev da equipe Fabricio) | Ruan | S6 | C-01, C-02, C-03, PB-06, PB-10, PB-18 |
| G-13 | Estornar entrega lançada por engano | G2 | G3 | S6 | G-11 |
| G-14 | Relatórios de estoque e de entregas por família/item | G3 | G4 | S6 | G-08, G-09, G-11, G-13 |
| G-15 | Fornecer atendimentos e entregas ao histórico comum | G5 | G3 | S6 | G-05, G-11, G-13 |
| C-05 | Histórico familiar/pessoal consolidado | Ruan (Fabricio) + G5 | Fabricio + Gabriel (líder) | S6, após PB-23/G-15 | PB-23, G-15 |
| C-06 | Alcance consolidado e detalhes dos totais | G3 + G4 + Alan (Fabricio) | Gabriel (líder) + Fabricio | S6, após C-05 e relatórios dos módulos | C-05, PB-18, PB-21, G-14 |
| C-08 | Importar cadastros e históricos com conferência | Gabriel (dev da equipe Fabricio) + G3/G4 | Fabricio + Gabriel (líder) | S3–S5 construção; S6 conferência | C-07, PB-06, PB-10, PB-17, G-05, G-11, G-08 |
| C-09 | Operação: implantação, backup, restauração e contingência | G5 + Kauã (Fabricio) | Gabriel (líder) + Fabricio | S1–S5 controles/backup; S6 restauração/manual | C-01, C-02 |

### Equipe Fabricio — tarefas principais

| Tarefa | Origem | Principal | Tipo | Entrega | Evidência de conclusão | Revisor |
|---|---|---|---|---|---|---|
| TF-06-01 | PB-21, PB-23, C-05, C-06, C-08, C-09 | Fabricio | Revisão | Revisar histórico, relatórios, migração e restauração | Revisar código e relatórios de conferência fornecidos pelos executores; verificar preservação histórica, totais e evidências de restauração/migração; registrar pendências sem executar importação ou implantação. | — (parecer do revisor) |
| TF-06-02 | PB-23, C-08 | Gabriel (dev da equipe Fabricio) | Execução | Entregar dados do histórico e conciliação da migração | Fatos CAD/FIC/FRQ fornecidos; contagens, origens e rejeições conciliadas para C-08; não duplicar histórico/saldo inicial nem declarar fonte indisponível como migrada. | Fabricio |
| TF-06-03 | PB-21, C-05 | Ruan | Execução | Implementar consulta de aptidão e histórico consolidado | Ruan implementa composição/consulta do histórico com PB-23 e G-15, e lista/detalhe de aptidão com autorização, data e evidências; Fabricio revisa os resultados. | Fabricio |
| TF-06-04 | C-06, C-08 | Alan | Execução | Entregar conjunto conciliado de frequência para alcance/migração | Contagens e detalhes de encontros/pessoas batem; cancelamento e vínculo histórico aplicados; registros de conferência entregues. | Gabriel (dev da equipe Fabricio) |
| TF-06-05 | C-09 | Kauã | Execução | Entregar roteiro de restauração do recorte e executá-lo com a operação | Restaurar ambiente de ensaio com dados aprovados/sintéticos; confirmar cadastro/ficha/chamada e permissões; registrar resultado e corrigir falhas do recorte. | Alan |

### Equipe Gabriel — ciclo 6

| Tarefa | Origem | Principal | Tipo | Entrega | Evidência de conclusão | Revisor |
|---|---|---|---|---|---|---|
| TG-06-01 | G-13, G-14, G-15, C-05, C-06, C-08, C-09 | Gabriel (líder) | Revisão | Revisar estorno, relatórios, migração e operação | Parecer sobre saldo/estorno, contagens, histórico, importação e restauração com evidências dos executores; nenhuma execução de infraestrutura/importação atribuída ao líder. | — |
| TG-06-02 | G-13 | G2 | Execução | Implementar estorno integral da entrega | Recompor lotes originais e atualizar entrega/atendimento atomicamente; repetição não duplica recomposição; vencido volta ao físico e permanece indisponível. | G3 |
| TG-06-03 | G-14, C-06, C-08 | G3 | Execução | Implementar relatório de estoque, alcance e conferência da migração | Saldo inicial + movimentos = saldo final; pessoas/famílias únicas e atendimento/entrega sem dupla contagem; conferir importação de estoque/origens com fonte disponível e detalhamento dos totais. | G4 |
| TG-06-04 | G-14, C-06, C-08 | G4 | Execução | Implementar relatório de entregas e importação de atendimentos | Entregas por família/item/período com estorno identificado; implementar/conferir ATD/ENT da fonte e fornecer totais a G3. Fonte ausente mantém bloqueio de migração. | G3 |
| TG-06-05 | G-15, C-05, C-09 | G5 | Execução | Entregar fatos ao histórico e ensaio operacional | Fornecer fatos/status com família histórica a C-05; executar ensaio de implantação/backup/restauração e contingência com Kauã; guardar evidências e corrigir falhas. | G2 |

## Semana geral S7 — 30/11/2026 a 04/12/2026

### Cartões/fases de produto e base comum

| ID | Entrega | Executor principal / parcela | Apoio ou revisão | Fase/meta | Dependências |
|---|---|---|---|---|---|
| C-10 | Homologação integrada, correções, capacitação e entrega final | Gabriel/Ruan/Alan/Kauã (Fabricio) + G2–G5 | Fabricio + Gabriel (líder) | S7 | C-04, C-05, C-06, C-08, C-09, G-13 |

### Equipe Fabricio — tarefas principais

| Tarefa | Origem | Principal | Tipo | Entrega | Evidência de conclusão | Revisor |
|---|---|---|---|---|---|---|
| TF-07-01 | C-10 | Fabricio | Revisão | Revisar versão final, documentação e evidências de aceite | Parecer final registrado sobre os PRs, documentação, resultados dos roteiros e pendências da versão preparada pelos executores; aceite institucional identificado separadamente. | — (parecer do revisor) |
| TF-07-02 | C-10 | Gabriel (dev da equipe Fabricio) | Execução | Entregar validação final e documentação de cadastro/dados | Cenários de CPF/vínculo/histórico/migração registrados, bloqueadores corrigidos e instruções de dados entregues. | Ruan |
| TF-07-03 | C-10 | Ruan | Execução | Entregar manual e validação final da ficha social | Manual do operador, versão/ciência/perfil exercitados, telas e erros impeditivos corrigidos. | Kauã |
| TF-07-04 | C-10 | Alan | Execução | Entregar validação final e documentação de atividades/frequência | Roteiro de participação/chamada/correção/cancelamento aprovado e regras/documentação atualizadas. | Fabricio |
| TF-07-05 | C-10 | Kauã | Execução | Entregar pacote final, roteiro integrado e validação em celular | Kauã prepara a versão/pacote de entrega com os demais executores, realiza roteiro integrado e capacitação, documenta evidências e corrige interfaces. Fabricio recebe os materiais para revisão. | Fabricio |

### Equipe Gabriel — ciclo 7

| Tarefa | Origem | Principal | Tipo | Entrega | Evidência de conclusão | Revisor |
|---|---|---|---|---|---|---|
| TG-07-01 | C-10 | Gabriel (líder) | Revisão | Revisar versão final e documentação da frente Gabriel | Parecer final de código, manuais, resultados de testes e pendências; aprovação técnica separada do aceite institucional. Sem implementação/documentação/implantação pelo líder. | — |
| TG-07-02 | C-10 | G2 | Execução | Entregar correções e documentação de atendimentos/entregas | Bloqueadores de transação/atendimento/estorno corrigidos; roteiro e instruções técnicas atualizados. | G3 |
| TG-07-03 | C-10 | G3 | Execução | Entregar conferência final de saldo, relatórios e migração | Casos de repetição/conciliação e contagens registrados; correções e relatório de pendências disponíveis. | G4 |
| TG-07-04 | C-10 | G4 | Execução | Entregar manual operacional de estoque/Bazar/entregas | Roteiro de recebimento, triagem, transferência e exceção atualizado; telas/regras impeditivas corrigidas. | G5 |
| TG-07-05 | C-10, C-09 | G5 | Execução | Preparar versão final, capacitação e evidências operacionais | Pacote/versão e instruções de instalação/backup/restauração entregues; capacitação e roteiro móvel executados com evidência; líder recebe para revisão. | G2 |

## Donos de execução da base comum

| ID | Entrega | Executor principal / parcela | Apoio ou revisão | Fase/meta | Dependências |
|---|---|---|---|---|---|
| C-01 | Acordar arquitetura, contratos, decisões e ambiente integrado | Alan (Fabricio) + G3 (Gabriel) | Fabricio + Gabriel (líder) | S1; contrato revisado durante o projeto | — |
| C-02 | Login, usuários, perfis e proteção de acesso | Alan + Kauã (Fabricio) | Fabricio; Gabriel (líder) revisa acesso da sua frente | S1; aplicar perfis em todos os módulos | C-01 |
| C-03 | Auditoria, datas históricas e consistência das operações | G3 | Gabriel (líder) + Fabricio | S1; transações próprias integradas durante o desenvolvimento | C-01 |
| C-04 | Formalizar e validar integração de aptidão com entregas | Gabriel (dev da equipe Fabricio) + G2/G4 | Fabricio + Gabriel (líder) | Contrato S1; exemplos S4; avaliação real 18/11; aceite 20/11 | PB-20, G-11, G-12 |
| C-05 | Histórico familiar/pessoal consolidado | Ruan (Fabricio) + G5 | Fabricio + Gabriel (líder) | S6, após PB-23/G-15 | PB-23, G-15 |
| C-06 | Alcance consolidado e detalhes dos totais | G3 + G4 + Alan (Fabricio) | Gabriel (líder) + Fabricio | S6, após C-05 e relatórios dos módulos | C-05, PB-18, PB-21, G-14 |
| C-07 | Mapear exportação do Bússola e planejar corte | Ruan (Fabricio) + G4 | Fabricio + Gabriel (líder) | S2, fonte/mapeamento/corte | C-01 |
| C-08 | Importar cadastros e históricos com conferência | Gabriel (dev da equipe Fabricio) + G3/G4 | Fabricio + Gabriel (líder) | S3–S5 construção; S6 conferência | C-07, PB-06, PB-10, PB-17, G-05, G-11, G-08 |
| C-09 | Operação: implantação, backup, restauração e contingência | G5 + Kauã (Fabricio) | Gabriel (líder) + Fabricio | S1–S5 controles/backup; S6 restauração/manual | C-01, C-02 |
| C-10 | Homologação integrada, correções, capacitação e entrega final | Gabriel/Ruan/Alan/Kauã (Fabricio) + G2–G5 | Fabricio + Gabriel (líder) | S7 | C-04, C-05, C-06, C-08, C-09, G-13 |

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

