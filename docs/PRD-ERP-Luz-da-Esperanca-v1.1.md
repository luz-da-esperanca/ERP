# PRD do ERP Social Luz da Esperança

Documento canônico de negócio

**Versão:** 1.1 · **Data:** 18 de setembro de 2026  
**Situação:** base consolidada de produto, com decisões de negócio pendentes de validação institucional.  
**Público:** coordenação, responsáveis pela assistência, equipes operacionais e equipes de produto e desenvolvimento.  
**Responsável pela aprovação de negócio:** representante da instituição a designar.

Este PRD define o problema que o ERP Social deve resolver, os resultados esperados, o escopo e os comportamentos de negócio necessários para acompanhar pessoas, famílias, atividades, atendimentos e doações de itens. É a referência para derivar especificações e decisões de arquitetura. A família é a unidade de referência da assistência; a participação de seus membros, sua situação social e o auxílio recebido precisam ser compreendidos em conjunto.

O documento estabelece uma base única para o produto, preservando a distinção entre necessidades confirmadas no levantamento, propostas de produto e políticas ainda não definidas. A conclusão documental não equivale à aprovação institucional das pendências. O escopo mínimo aqui proposto entrega um ciclo completo de assistência, do cadastro ao registro da entrega e à consulta do histórico.

Esta revisão incorpora a ficha cadastral recebida e o esclarecimento de que o sistema próprio substituirá o Bússola Social, atualmente utilizado mediante pagamento. Corrige pendências documentais e explicita a transição. As políticas institucionais abertas continuam sujeitas a validação; a atualização não registra aprovação de negócio ainda não obtida. [F5–F8]

## 1 O problema de negócio

### 1.1 Contexto da instituição

O Luz da Esperança realiza atividades periódicas e atendimentos pontuais, além de receber e distribuir itens doados. A transcrição cita os institutos da Criança, do Jovem, do Esclarecimento e Família, da Caridade, da Divulgação e da Mediunidade. Cita também a Escola Espírita, cuja gestão foi expressamente adiada. Essa estrutura contextualiza a atuação da instituição; não implica um produto independente para cada instituto. [F1, §1]

As atividades periódicas incluem aulas, alfabetização, bordado e ações de mocidade. Os atendimentos pontuais incluem doação de itens, atendimento médico, psicológico e fisioterapia. Cada modalidade exige uma evidência diferente: participação ao longo de encontros ou registro de que um atendimento aconteceu. Os projetos reúnem atividades. [F1, §§3 e 5]

O sistema atualmente utilizado é o Bússola Social, pago, e a equipe informou a decisão de substituí-lo por um sistema próprio. A existência desse sistema afasta a suposição de que toda a operação esteja sem suporte digital. O custo contratado, os recursos efetivamente utilizados e as dificuldades observadas ainda não foram documentados. O desenvolvimento próprio deve sustentar a operação após a entrega e preservar os registros necessários ao atendimento. [F6]

### 1.2 Problema central

**A instituição precisa reunir evidências suficientes para decidir e explicar como atende cada família: quem participa, qual é sua situação social, por que pode receber doações, o que está disponível e o que já foi entregue.** Sem essa visão relacionada, um cadastro isolado, uma lista de presença ou um saldo de estoque não responde às perguntas necessárias à assistência.

O levantamento confirma a necessidade desses controles, mas não descreve integralmente o processo atual nem demonstra que todos os registros estejam ausentes. Portanto, dispersão de informação, retrabalho e decisões dependentes da memória são riscos que o produto deve reduzir; sua frequência e seu impacto precisam ser medidos no diagnóstico inicial. Não há linha de base de tempo, custo ou taxa de erro nos materiais.

### 1.3 Problemas que o produto deve enfrentar

| ID | Problema de negócio | Evidência e consequência |
|---|---|---|
| PROB-01 | Dificuldade de relacionar a pessoa atendida ao seu núcleo familiar e à assistência acumulada. | A fala exige cadastro de pessoas e famílias e consulta da situação social. Registros desconectados dificultam compreender quem está sendo beneficiado. [F1, §§2 e 6] |
| PROB-02 | Falta de uma definição operacional completa da aptidão para receber doações. | A participação de um membro é suficiente para incluir a família entre as possíveis beneficiárias, mas período e frequência mínima não foram definidos. Há risco de decisões inconsistentes. [F1, §2] |
| PROB-03 | Necessidade de acompanhar modalidades distintas de assistência sem perder o histórico comum. | Aulas exigem frequência; consultas e entregas exigem registro de realização. Confundir essas evidências distorce o acompanhamento. [F1, §§3, 5 e 18] |
| PROB-04 | Necessidade de saber quais itens estão disponíveis e quem recebeu cada entrega. | O levantamento pede explicitamente controle do estoque e de “quem recebeu o quê”. Sem relação entre entrada e destino, a prestação de informações fica incompleta. [F1, §§4 e 18] |
| PROB-05 | Risco de destinar um item a uma família que não possa utilizá-lo. | O exemplo de calçado número 39 evidencia a necessidade de compatibilidade. Não há quantidade medida de entregas inadequadas. [F1, §4] |
| PROB-06 | Baixa visibilidade da contribuição de doadores e campanhas e da passagem de itens pelo Bazar. | A fala declara desconhecimento do volume recebido de algumas origens e descreve a destinação de itens do Bazar ao estoque social. O alcance compartilhado entre produtos exige alinhamento. [F1, §§14, 16 e 17] |
| PROB-07 | Substituir o sistema pago atual preservando a continuidade do atendimento e a informação necessária. | Substituição do Bússola Social confirmada pela equipe; exportação, custos comparáveis e sustentação ainda não verificados. [F6; DEC-10 e DEC-11] |

### 1.4 Quem enfrenta o problema

As famílias e seus membros são os beneficiários. Precisam ser reconhecidos ao longo dos atendimentos e ter suas necessidades consideradas com informações corretas. Não se pressupõe que terão conta de acesso ao ERP.

Os papéis abaixo representam responsabilidades necessárias à operação, não cargos já confirmados nem uma lista definitiva de permissões.

| Papel de negócio | Necessidade principal |
|---|---|
| Coordenação institucional | Conhecer o alcance das ações e definir critérios coerentes de assistência. |
| Responsável pelo cadastro e acompanhamento social | Identificar pessoas e famílias, manter a situação social e recuperar seu histórico. |
| Responsável por atividades periódicas | Registrar participação e acompanhar a continuidade dos participantes. |
| Responsável por atendimentos pontuais | Registrar a realização do serviço e identificar a pessoa ou família atendida. |
| Equipe de recebimento e distribuição | Conhecer disponibilidade, conferir adequação e registrar origem e destino dos itens. |
| Responsável pelo Bazar | Comprovar a saída do estoque comercial e a destinação ao estoque social. |

### 1.5 O que caracteriza uma melhoria real

A melhoria ocorre quando a equipe consegue reconstruir a assistência a uma família, justificar uma decisão de distribuição com evidências e conferir o destino dos itens sem refazer a história a partir de registros desconectados. Ter mais cadastros ou mais telas não constitui, por si só, sucesso do produto.

Não há evidência suficiente para prometer redução percentual de desperdício, aumento de captação ou redução de filas. O ERP pode fornecer dados para essas avaliações; esses efeitos não são resultados garantidos desta versão.

### 1.6 Diagnóstico atual a completar

O diagnóstico deve registrar quais tarefas são executadas no Bússola Social e fora dele, quem registra e consulta cada informação, quais dificuldades foram observadas e quais históricos precisam continuar disponíveis. Para cada dificuldade, registrar exemplo, consequência, frequência observada e origem da evidência. Não assumir perdas, retrabalho ou limitações do fornecedor apenas porque haverá substituição.

Devem ser levantados o valor e as condições do contrato atual, o volume de famílias e registros, a viabilidade de exportação e os recursos disponíveis para operação futura. A comparação econômica considera implantação, migração, hospedagem, manutenção, suporte e capacitação no mesmo horizonte de análise. A decisão de construir não comprova economia; responsável, prazo de levantamento e resultado serão registrados em DEC-10 e DEC-11.

## 2 A solução de negócio

### 2.1 Visão do produto

O ERP Social será o registro comum da assistência prestada pelo Luz da Esperança. Relacionará pessoas a famílias, participação a atividades, atendimentos ao histórico familiar e doações à disponibilidade e ao destino dos itens. A equipe poderá consultar esse conjunto para agir com mais consistência e explicar o que foi realizado.

A solução apoia a decisão institucional. Estar apta a receber não significa ter prioridade sobre outras famílias nem ter uma entrega garantida. Necessidade, compatibilidade, disponibilidade e critérios institucionais continuam sendo considerados na distribuição.

### 2.2 Objetivos do produto

| ID | Resultado esperado | Problemas relacionados |
|---|---|---|
| OBJ-01 | Reconhecer cada pessoa assistida e sua família e consultar a assistência registrada ao longo do tempo. | PROB-01 e PROB-03 |
| OBJ-02 | Sustentar a avaliação da aptidão familiar com participação verificável e política institucional explícita. | PROB-02 |
| OBJ-03 | Registrar a execução das atividades conforme sua natureza e consolidar seu alcance. | PROB-03 |
| OBJ-04 | Explicar entradas, disponibilidade e destinos dos itens do estoque social. | PROB-04 e PROB-06 |
| OBJ-05 | Apoiar a escolha de itens adequados às famílias, mantendo a decisão de entrega com a equipe. | PROB-05 |
| OBJ-06 | Produzir informação de gestão consistente e acessível apenas a quem necessita dela para trabalhar. | PROB-01 a PROB-06 |
| OBJ-07 | Assumir a operação hoje apoiada pelo Bússola Social com histórico necessário acessível e responsabilidade de sustentação definida. | PROB-07 |

### 2.3 Princípios de negócio

- **Família como referência da assistência.** A participação é individual; o benefício pode alcançar o núcleo familiar.
- **Registro único e uso compartilhado.** Frequência, atendimentos e doações devem reconhecer as mesmas pessoas e famílias.
- **Evidência antes de conclusão.** Cadastro, presença, atendimento realizado e entrega efetiva têm significados distintos.
- **Decisão compreensível.** Deve ser possível identificar os fatos e o critério usados em uma decisão de aptidão ou entrega.
- **Histórico confiável.** Correções precisam ser explicáveis, sem reescrever silenciosamente fatos anteriores.
- **Coleta proporcional à finalidade.** Informações sociais e pessoais só devem circular conforme a necessidade de cada responsabilidade.

### 2.4 Conceitos que não podem ser confundidos

| Conceito | Significado para o negócio |
|---|---|
| Pessoa assistida | Pessoa que participa ou é beneficiada direta ou indiretamente e integra o cadastro familiar. Um operador do sistema não se torna assistido por ser usuário. |
| Família | Núcleo de referência para compreender a situação social e registrar a assistência recebida. Sua definição cadastral detalhada será validada com a instituição. |
| Participação | Presença de uma pessoa em uma ocorrência de atividade periódica. Inscrição ou cadastro isolado não comprova presença. |
| Atendimento pontual | Ocorrência de assistência registrada por realização. Pode acontecer novamente sem se transformar em controle de frequência. |
| Aptidão ou elegibilidade | Condição de integrar o conjunto de famílias que podem receber itens, segundo a política institucional. |
| Compatibilidade | Adequação de um item às características ou necessidades conhecidas dos membros da família. |
| Prioridade | Ordem de atendimento entre famílias aptas. Exige critérios próprios; não decorre automaticamente da aptidão. |
| Entrega | Transferência efetiva de itens para uma família, com quantidades e data identificáveis. |
| Estoque social | Itens destinados à distribuição assistencial, distinguíveis dos itens destinados à venda no Bazar. |

## 3 Escopo e prioridades

### 3.1 Leitura das prioridades e da evidência

**Mínimo** identifica a proposta de escopo necessário para validar o ciclo completo de assistência. **Evolução** identifica uma melhoria que pode ser incluída depois, sem impedir o núcleo. Essa priorização é uma decisão proposta por este PRD e deve ser ratificada pela coordenação.

Na origem dos requisitos, **C** significa necessidade confirmada no levantamento ou nos esclarecimentos da equipe, com a respectiva fonte indicada; **P** significa desdobramento de produto proposto para tornar a operação consistente; **D** significa decisão institucional pendente. Uma necessidade confirmada pode conter detalhes pendentes. Não se deve tratar P ou D como aprovação já obtida.

### 3.2 Capacidades do escopo mínimo

| ID | Capacidade e resultado de negócio | Origem |
|---|---|---|
| CAP-01 | Identificar pessoas assistidas, famílias e seus vínculos; localizar cadastros existentes e tratar possíveis duplicidades. | C para pessoas e famílias; P para o tratamento de duplicidades. |
| CAP-02 | Registrar e consultar a situação social conforme os campos da ficha recebida selecionados e validados para o produto. | C para acompanhamento; ficha disponível em F5; D para necessidade dos campos, atualização e responsabilidades. |
| CAP-03 | Organizar projetos e suas atividades, distinguindo frequência de atendimento pontual. | C; D para o vínculo exato com institutos. |
| CAP-04 | Registrar participação por pessoa e ocorrência de atividade periódica; consultar o histórico e corrigir registros de forma identificável. | C para frequência; P para controles de correção. |
| CAP-05 | Apoiar a avaliação da aptidão familiar com as evidências de participação e o critério vigente. | C para a regra central; D para sua aplicação operacional. |
| CAP-06 | Registrar atendimentos realizados e relacioná-los à pessoa atendida, quando aplicável, e à sua família. | C. |
| CAP-07 | Registrar entradas, disponibilidade, entregas e demais alterações do estoque social com quantidade, unidade e motivo. | C para estoque e entregas; P para controles operacionais detalhados. |
| CAP-08 | Registrar a entrega efetiva como atendimento pontual, vinculando família, itens, quantidades e redução de disponibilidade. | C para a relação doações e atendimentos; P para consistência dos registros. |
| CAP-09 | Reconhecer itens recebidos do Bazar, com referência que permita conferir sua origem e evitar contagem duplicada. | C para Bazar ao social; P para conferência. |
| CAP-10 | Consultar histórico familiar e resultados por período, atividade e movimentação de itens. | C para conhecer a assistência; P para consolidações gerenciais. |
| CAP-11 | Limitar acesso conforme responsabilidade e identificar autores de registros e correções relevantes. | P como requisito de confiança operacional. |
| CAP-12 | Preparar a substituição do Bússola Social, preservando o acesso ao histórico necessário, com conferência e aceite institucional. | C para substituição [F6]; P para o procedimento de transição; D para dados, viabilidade e condições [DEC-11]. |

O mínimo inclui a identificação da origem conhecida de cada entrada no estoque social. Um cadastro completo de relacionamento com doadores, a gestão de metas de campanhas e a valoração monetária não são pré-requisitos para registrar e entregar itens.

### 3.3 Evoluções propostas

| ID | Capacidade | Condição de inclusão |
|---|---|---|
| EVO-01 | Consultar famílias ou itens compatíveis por tamanho e outras características úteis. | Sugestão expressa no levantamento; validar prioridade e dados necessários. [F1, §4] |
| EVO-02 | Consolidar contribuições por doador ou campanha e estimar seu valor. | Definir a responsabilidade entre ERP e Bazar, o método de estimativa e a prevenção de dupla contagem. [F1, §§16 e 17] |
| EVO-03 | Sinalizar interrupções de participação e necessidade de atualização cadastral. | Validar os critérios de acompanhamento e a responsabilidade pela ação. |
| EVO-04 | Controlar capacidade de turmas, listas de espera e agenda de atendimentos. | Confirmar que esses controles fazem parte da operação real. |
| EVO-05 | Apoiar prioridade, intervalos entre entregas ou autorizações excepcionais. | Depende de política institucional; não implantar critérios sugeridos como padrão automático. |

### 3.4 Fronteiras com outros produtos

| Tema | Responsabilidade deste ERP |
|---|---|
| Doações financeiras e captação | Fora do escopo. A transcrição completa atribui ao CRM captação e relacionamento com doadores financeiros, incluindo doações pontuais e recorrentes. Não há integração obrigatória com CRM nesta versão. |
| Vendas e gestão financeira do Bazar | Fora do escopo. Ponto de venda, caixa, contas a pagar e a receber e estoque comercial pertencem ao Bazar. |
| Bazar para estoque social | Dentro do escopo de negócio. O ERP reconhece a entrada e sua referência; a forma de comunicação será definida posteriormente. |
| Estoque social para Bazar | Não confirmado no levantamento. Depende de decisão específica antes de ser incluído. |
| Gestão da Escola Espírita | Fora da fase atual, conforme orientação expressa. |
| Atendimento de saúde | Registro de realização incluído. Prontuário clínico, diagnóstico, prescrição e gestão de tratamento não foram solicitados. |
| Gestão de voluntários, divulgação e recursos humanos | Não incluída como módulo próprio. Identificar responsáveis pelas ações não exige ampliar o produto para essas gestões. |
| Contabilidade, obrigações fiscais e pagamentos | Fora do escopo deste PRD. Valorar itens, se aprovado, não equivale a registrar receita financeira ou emitir documento fiscal. |

## 4 Jornadas de negócio

As jornadas descrevem o trabalho e os resultados esperados. Não determinam telas, tecnologias ou a divisão interna do software.

### 4.1 Reconhecer e acompanhar uma família

O responsável pelo cadastro procura a pessoa e sua família antes de criar novos registros. Identifica os membros e os vínculos pertinentes, registra os dados necessários à assistência e consulta ou atualiza a ficha social conforme o instrumento institucional. A equipe passa a recuperar o histórico comum, respeitando os limites de acesso.

**Resultado esperado:** a mesma família é reconhecida em atividades e atendimentos diferentes. Uma correção de composição familiar preserva o contexto dos fatos anteriores. Dados ausentes e possíveis duplicidades são sinalizados para análise; exigências como CPF, telefone ou endereço completo não são presumidas como critérios de acesso à assistência.

**Atualização do recorte em 07/10/2026:** por exigência de Dário comunicada pelo responsável pelo projeto, a interface remove a central “Duplicidades e qualidade”. O CPF, quando conhecido e informado, deve ser válido e único por pessoa canônica; o cadastro e a edição impedem repeti-lo, sem exceção por justificativa. O CPF continua opcional. A mudança não transforma homônimos em duplicados nem apaga cadastros ou históricos existentes; os critérios e o procedimento técnico estão em [SPEC-CAD, §3](specs/02-registration.md#3-busca-dados-ausentes-e-duplicidades).

### 4.2 Registrar participação e avaliar aptidão

O responsável identifica a atividade periódica e a ocorrência realizada, registra a participação das pessoas e corrige eventuais erros com justificativa. A avaliação da aptidão familiar considera os registros pertinentes e a política aprovada.

**Resultado esperado:** a equipe consegue identificar qual membro, atividade e evidência sustentam a aptidão. Se a política ainda não estiver definida ou a evidência estiver incompleta, a situação fica pendente de avaliação; ausência de informação não é convertida silenciosamente em decisão negativa. Esse tratamento de pendência é uma proposta de produto a validar em DEC-02.

### 4.3 Registrar um atendimento pontual

O responsável identifica a pessoa ou família, a atividade e o atendimento efetivamente realizado. Registra quando ocorreu, sua natureza e quem respondeu pela execução, no nível necessário para comprovar a assistência.

**Resultado esperado:** o histórico permite saber que o atendimento aconteceu sem exigir uma sequência de presenças. Um novo atendimento pode ser registrado em outra data. Marcação de horário ou intenção de atender não equivale a atendimento realizado. Detalhamento clínico não integra esta jornada.

### 4.4 Receber e disponibilizar itens

A equipe identifica a origem conhecida, confere os itens, suas quantidades e unidades e distingue o que está em condição de distribuição. Quando a origem é o Bazar, associa a entrada à referência de transferência e confere eventuais diferenças.

**Resultado esperado:** somente itens efetivamente aceitos e disponíveis compõem o saldo distribuível. Itens inadequados não são tratados como disponíveis. A forma de registrar triagem, descarte, perdas e origem desconhecida precisa ser acordada, sem impedir a rastreabilidade do que de fato entrou no estoque social.

### 4.5 Decidir e registrar uma entrega

A equipe identifica a família, consulta sua aptidão, seu histórico e as necessidades pertinentes. Confere a disponibilidade e a adequação dos itens, aplica os critérios de distribuição aprovados e registra a entrega efetiva, com os itens e quantidades correspondentes.

**Resultado esperado:** a mesma entrega aparece no histórico da família e nas saídas do estoque, uma única vez. Uma seleção ou sugestão de itens não é tratada como entrega. Se houver impedimento, os itens não são contabilizados como entregues. Se a instituição autorizar exceções, o motivo e a autoridade responsável precisam ser identificáveis; a política de exceção ainda não está definida.

### 4.6 Conferir a operação e prestar informações

A coordenação consulta resultados por período e identifica os registros que explicam os totais. Distingue pessoas únicas, famílias únicas, ocorrências de atendimento e quantidades de itens. A equipe de estoque confronta os registros com a contagem física e justifica diferenças.

**Resultado esperado:** uma família atendida várias vezes não é contada como várias famílias; uma entrega não é duplicada ao ser consolidada com os atendimentos pontuais. O nível de detalhe fornecido a cada público respeita sua necessidade de acesso.

### 4.7 Uso da ficha recebida

A Ficha de Cadastro de Famílias 2025 — Completo, de duas páginas, identifica o Instituto da Caridade e reúne identificação do beneficiário, situação domiciliar, composição familiar e econômica, informações de saúde, crianças e adolescentes, necessidades e acompanhamento de doações, ações e visitas. Ela é uma fonte primária disponível, e não uma pendência de envio. [F5]

A presença de um campo no formulário comprova sua existência no instrumento recebido; não comprova sua necessidade, obrigatoriedade ou autorização de uso no ERP. Devem ser validados finalidade, pessoas autorizadas, atualização e tratamento de dados ausentes em DEC-05 e DEC-08. Em especial, os campos de saúde, medicamentos, saúde espiritual e participação em evangelização exigem análise de pertinência antes da reprodução digital. [F5; F8, seção 4]

A numeração de calçado e vestuário aparece no quadro de crianças e adolescentes. Isso apoia o estudo de EVO-01, sem tornar a recomendação de itens obrigatória nem presumir que esses dados já existam para todos os adultos. O quadro de doações, ações e visitas é referência de acompanhamento; não substitui a definição de movimentação de estoque. O ERP registra a ocorrência dos atendimentos de saúde; diagnóstico, prescrição e prontuário clínico permanecem fora do escopo.

## 5 Regras de negócio

### 5.1 Regras confirmadas no levantamento

**RN-01 — Vínculo familiar.** Pessoas assistidas ou participantes devem ser relacionadas às respectivas famílias. A regra não impõe cadastro assistencial a usuários, doadores ou profissionais apenas por exercerem esses papéis. [F1, §2]

**RN-02 — Aptidão por participação de um membro.** Uma família pode integrar o conjunto de possíveis beneficiárias de doações quando pelo menos um membro frequenta diretamente uma atividade. Não é exigida a participação de todos. A medida de frequência e o período válido permanecem pendentes. [F1, §2; DEC-02]

**RN-03 — Aptidão não garante entrega.** A condição permite considerar a família para distribuição. A entrega depende dos itens disponíveis e da decisão de distribuição; cadastro ou aptidão não constitui promessa de benefício. [F1, §§2 e 4; F2, seção 3]

**RN-04 — Atividades por projeto e por natureza.** Projetos contêm atividades. O controle deve distinguir atividades periódicas com frequência e atividades pontuais com registro de realização. O vínculo obrigatório e exclusivo de cada projeto a um instituto depende de validação. [F1, §§3 e 5; DEC-04]

**RN-05 — Atendimento pontual como ocorrência.** Atendimentos como consultas e fisioterapia exigem comprovação de realização, sem a chamada periódica aplicável às aulas. A classificação não limita a pessoa a uma única ocorrência. [F1, §3; F2, seção 4]

**RN-06 — Doações no acompanhamento assistencial.** O controle de atendimentos pontuais abrange doações de itens e deve permitir identificar o que foi recebido por cada família e o estoque existente. [F1, §§4 e 18]

**RN-07 — Distinção entre destinação comercial e social.** Itens do Bazar podem ser destinados ao estoque de doações. O registro deve preservar essa origem sem confundir a transferência com uma nova doação externa à instituição. A segunda frase é o desdobramento operacional proposto para evitar dupla contagem. [F1, §14]

### 5.2 Regras operacionais propostas para o produto

Estas regras dão consistência ao escopo mínimo. São propostas de produto e não declarações de políticas já aprovadas pela instituição.

**RN-08 — Evidência identificável.** Cada presença, atendimento, entrada e entrega deve permitir identificar o fato ocorrido, sua data e o responsável pelo registro. Correções relevantes precisam indicar autor e motivo.

**RN-09 — Preservação do contexto histórico.** Mudanças cadastrais não devem atribuir retroativamente atendimentos e entregas a outra família. Registros utilizados para explicar a operação precisam permanecer recuperáveis conforme a política de guarda a definir; esta regra não determina retenção indefinida.

**RN-10 — Entrega e disponibilidade coerentes.** Toda entrega concluída deve corresponder à saída das mesmas quantidades do estoque social. Não se pode concluir entrega acima do saldo disponível nem registrar novamente a mesma entrega por repetição da confirmação. Falhas não podem deixar o histórico afirmando uma entrega sem a correspondente movimentação.

**RN-11 — Quantidades comparáveis.** Quantidades devem ter unidade identificada. Pares, peças, caixas e quilos não podem ser somados ou convertidos como equivalentes sem regra definida. Ajustes, perdas e correções precisam ter motivo e responsável.

**RN-12 — Condição de uso.** Itens reconhecidos como impróprios para a finalidade assistencial não devem estar disponíveis para entrega. Critérios de triagem, validade quando aplicável e registro de descarte serão definidos com a equipe operacional.

**RN-13 — Aptidão demonstrável e sem parâmetros inventados.** A avaliação deve registrar a referência temporal, o critério vigente e a evidência considerada. Cadastro ou inscrição isolados não substituem presença. Atendimento pontual e recebimento de doação não renovam automaticamente a aptidão; qualquer ampliação dessa regra exige decisão institucional explícita. Não haverá padrão presumido de 30 dias, percentual mínimo ou renovação por entrega.

**RN-14 — Compatibilidade com decisão humana.** Se EVO-01 for incluída, a compatibilidade ajuda a selecionar possíveis destinatários; não define prioridade nem executa a distribuição. Falta de numeração ou tamanho significa dado desconhecido, não incompatibilidade comprovada. Não se presume tolerância de tamanho, como calçado um número acima ou abaixo.

**RN-15 — Visibilidade conforme responsabilidade.** Consultar presença ou entregar itens não concede acesso irrestrito a informações sociais. A matriz de acesso, os dados necessários e as responsabilidades de tratamento devem ser definidos antes do uso com informações reais.

**RN-16 — Totais explicáveis.** Resultados devem explicitar período, unidade de contagem e quais registros foram considerados. Correções e cancelamentos devem refletir nesses resultados sem apagar a possibilidade de compreender o que ocorreu.

**RN-17 — Transferência não é nova arrecadação.** Uma entrada vinda do Bazar deve ser conferível por referência e quantidade e reconhecida uma única vez. Se houver consolidação institucional por doador, a passagem entre estoques não aumenta o total arrecadado. O recebimento no estoque social depende da confirmação do que foi efetivamente recebido.

### 5.3 Políticas que permanecem em aberto

Não são regras vigentes deste PRD: frequência mínima ou janela de participação; contribuição de atendimentos pontuais para aptidão; pontuação de vulnerabilidade; prioridade automática por renda; intervalo obrigatório entre entregas; prazo anual de ficha social; suspensão de famílias; exceções emergenciais; exigência universal de documentos; transferências do social ao Bazar; ou coleta de conteúdo clínico. Esses temas devem seguir as decisões da seção 8 quando forem pertinentes ao produto.

## 6 Critérios de aceite de negócio

Os cenários abaixo verificam resultados do escopo mínimo. As especificações derivadas podem detalhá-los, preservando seu significado. Os critérios propostos e as políticas aplicáveis devem ser ratificados antes do piloto.

| ID | Situação de validação | Resultado esperado |
|---|---|---|
| AC-01 | Dois membros da mesma família participam de ações diferentes. | A equipe identifica ambos e recupera um histórico familiar comum, sem criar duas famílias para representar o mesmo núcleo. |
| AC-02 | Apenas um membro atende ao critério de frequência aprovado. | A família é reconhecida como apta; os demais membros não precisam participar para que o núcleo seja considerado. |
| AC-03 | Uma família está cadastrada, mas faltam política ou evidências para avaliar a participação. | O produto não inventa aptidão nem aplica uma negativa automática pela mera ausência de informação; explicita a pendência conforme DEC-02. |
| AC-04 | Uma pessoa recebe atendimento pontual em duas datas. | Existem duas ocorrências de atendimento no histórico, sem transformá-las automaticamente em presenças de atividade periódica. |
| AC-05 | Há cinco unidades disponíveis e ocorre uma entrega de duas unidades. | O histórico registra duas unidades entregues à família e restam três disponíveis; a repetição da confirmação não duplica o fato. |
| AC-06 | Uma entrega pede quantidade superior ao saldo ou não chega a ser concluída. | Não há registro de entrega concluída nem redução indevida da disponibilidade. O motivo pode ser compreendido pela equipe. |
| AC-07 | A mesma remessa do Bazar é apresentada duas vezes para recebimento. | A entrada no social é reconhecida uma única vez; a referência permite conferir quantidade e origem. |
| AC-08 | Um vínculo familiar ou registro de assistência precisa ser corrigido. | A correção é identificável e o contexto anterior continua compreensível aos responsáveis autorizados. |
| AC-09 | Um responsável por frequência consulta informações de acompanhamento. | Tem acesso ao necessário para sua tarefa, sem receber acesso social irrestrito por consequência. |
| AC-10 | Uma família recebe duas entregas no período consultado. | O resultado distingue uma família beneficiada, duas entregas e as quantidades por unidade; as entregas não são duplicadas nos totais de atendimentos. |
| AC-11 | Um item é considerado impróprio ou uma contagem identifica diferença física. | O item impróprio não é oferecido como disponível; a diferença é registrada e explicada conforme a política de estoque. |
| AC-12 | Um conjunto de famílias e históricos é preparado para a transição. | Os responsáveis conferem os vínculos e registros contra a origem; divergências ficam identificadas. Dados indisponíveis não são apresentados como migrados. |
| AC-13 | A equipe avalia a entrada em operação e o encerramento do uso anterior. | As jornadas essenciais foram aceitas, o histórico necessário está acessível e há responsáveis pela operação e pelo tratamento de falhas, conforme DEC-11. |

Se EVO-01 for incluída, acrescentar a validação de um calçado número 39: a consulta reconhece membros com numeração correspondente e distingue perfis sem informação. A equipe mantém a decisão sobre a entrega.

## 7 Sucesso do produto e implantação

### 7.1 Indicadores de resultado

Não há valores de referência medidos nas fontes. As metas de cobertura integral abaixo são propostas de aceite para os registros do piloto, e não afirmações de desempenho atual. Os demais objetivos quantitativos serão definidos após a linha de base, sem inventar números de ganho.

| ID | Indicador e cálculo | Meta ou decisão necessária |
|---|---|---|
| IND-01 | Cobertura de registro: ocorrências registradas no ERP divididas pelas ocorrências efetivamente realizadas no piloto, conferidas pela equipe. | Meta proposta de 100% para o escopo e período acordados; acompanhar frequência, atendimentos e entregas separadamente. |
| IND-02 | Rastreabilidade de entregas: entregas com família, data, itens, unidades, quantidades e responsável identificáveis divididas pelas entregas registradas. | Meta proposta de 100% no piloto. Responsável: equipe de distribuição. |
| IND-03 | Explicabilidade da aptidão: avaliações com critério e evidência identificáveis divididas pelas avaliações concluídas. | Meta proposta de 100% após aprovação da política; pendências devem aparecer separadamente. |
| IND-04 | Acurácia de estoque: posições item e unidade sem divergência divididas pelas posições conferidas fisicamente. | Medir na abertura e no fechamento do piloto; definir tolerância e rotina de tratamento com a equipe. |
| IND-05 | Esforço para recuperar o histórico: mediana do tempo gasto nas mesmas tarefas antes e durante o piloto. | Medir linha de base e pactuar melhoria com os operadores; sem meta temporal arbitrária. |
| IND-06 | Cadastros potencialmente duplicados: casos identificados e casos resolvidos por período. | Acompanhar tendência e tempo de resolução; definir regra de identificação antes de comparar resultados. |

### 7.2 Sequência de adoção proposta

**Preparação institucional.** Designar responsável pelo produto, validar o uso da ficha social já recebida, compreender os registros atuais no Bússola Social e nos instrumentos complementares e validar as decisões que afetam cada capacidade. Confirmar quem usará o ERP, os recursos disponíveis e quais registros precisam ser trazidos para o início da operação.

**Base comum.** Organizar pessoas, famílias, projetos, atividades e responsabilidades de acesso. Conferir os cadastros iniciais e o saldo físico inicial para evitar que o produto comece com informação inconsistente.

**Piloto do ciclo completo.** Escolher um recorte operacional real que inclua atividade periódica, atendimento pontual e entrega de itens. Registrar os fatos, conferir os resultados com os responsáveis e acompanhar os indicadores. O tamanho e a duração do piloto serão acordados, sem compromisso de prazo não validado.

**Expansão.** Ampliar o uso após corrigir divergências e obter aceite de negócio. Avaliar evoluções pela contribuição aos objetivos, sem incluí-las automaticamente por constarem em documentos anteriores.

### 7.3 Condições para aceite do piloto

- Os responsáveis conseguem executar as jornadas incluídas e validar os critérios AC aplicáveis.
- As políticas que afetam decisões do piloto estão definidas; não há aprovação ou negativa de aptidão baseada em parâmetros provisórios ocultos.
- O estoque inicial foi conferido e as divergências do período foram explicadas ou encaminhadas com responsável.
- A equipe consegue relacionar cada entrega ao histórico familiar e à saída de itens, sem duplicidade ou perda de vínculo.
- A ficha social e os limites de acesso foram validados antes de uso com dados reais.
- Há responsáveis por corrigir cadastros, atender dúvidas e registrar a operação durante eventual indisponibilidade, para posterior conferência.

### 7.4 Substituição do Bússola Social

A preparação começa pela identificação dos dados e históricos necessários, das condições de exportação e dos responsáveis pela conferência. A equipe deverá avaliar o material efetivamente disponibilizado pelo sistema atual; nenhum formato de exportação, integração ou migração completa está confirmado. Caso um histórico necessário não possa ser migrado, a instituição deve decidir como manter sua consulta e registrar a limitação.

A conferência proposta inclui amostras de famílias e vínculos, contagens de registros por tipo e período e explicação das divergências relevantes. O saldo inicial de itens precisa ser confrontado com a contagem física. A quantidade e os critérios da amostra serão definidos com a equipe, sem meta arbitrária de migração integral.

A troca operacional depende do aceite dos responsáveis, da capacidade de realizar as jornadas essenciais e da definição de suporte, capacitação e procedimento de continuidade. A data de corte, a necessidade de convivência temporária dos sistemas e as condições de retorno ao processo anterior, se necessárias e viáveis, ficam em DEC-11. O encerramento do contrato atual é uma decisão institucional posterior a essas verificações.

## 8 Decisões pendentes e riscos

### 8.1 Decisões necessárias

Os responsáveis abaixo são papéis propostos. A coordenação deverá designar as pessoas. Uma pendência bloqueia a definição ou ativação da capacidade afetada, não a redação do restante do produto.

| ID | Decisão necessária | Quem deve decidir | Antes de quê |
|---|---|---|---|
| DEC-01 | Definir núcleo familiar, vínculo atual e histórico, responsável de referência, documentos necessários e tratamento de cadastro incompleto ou duplicado. | Coordenação e responsáveis pelo cadastro e acompanhamento social. | Fechar CAP-01 e preparar cadastros reais. |
| DEC-02 | Definir frequência válida, período, interrupções, atividades consideradas, evidência incompleta e eventual efeito de atendimentos pontuais. | Coordenação e responsáveis pelas atividades e assistência. | Automatizar ou usar aptidão para liberar ou impedir entregas. |
| DEC-03 | Definir prioridades, limites, urgências e possibilidade de exceções; identificar quem pode autorizar e como justificar. | Coordenação e equipe de assistência. | Aplicar bloqueios ou prioridades além da disponibilidade física. |
| DEC-04 | Confirmar relação entre institutos e projetos, organização dos encontros e necessidade de turmas ou inscrições. | Coordenação e responsáveis pelas atividades. | Detalhar CAP-03 e CAP-04. |
| DEC-05 | Validar o uso da ficha já recebida: finalidade dos campos, obrigatoriedade, acesso e atualização; conferir sua correspondência com a operação atual. | Responsável pelo acompanhamento social e coordenação. | Fechar CAP-02. |
| DEC-06 | Definir unidades, categorias, triagem, validade quando aplicável, perdas, ajustes, estornos e recebimentos de origem desconhecida. | Equipe de recebimento e distribuição. | Iniciar estoque e entregas reais. |
| DEC-07 | Acordar conferência, referência e tratamento de divergências nas transferências do Bazar; confirmar se haverá algum fluxo inverso. | Responsáveis pelo Bazar e pelo estoque social. | Ativar CAP-09 ou ampliar sua direção. |
| DEC-08 | Definir finalidade, acesso, bases aplicáveis, guarda e correção dos dados, incluindo saúde, informações religiosas e menores; validar o enquadramento institucional das normas e sua relação com as políticas de assistência. | Coordenação e responsáveis institucionais competentes. | Tratar dados reais. |
| DEC-09 | Definir responsabilidade por doadores e campanhas e método de estimativa de valores; distinguir entrada institucional de transferência interna. | Coordenação, Bazar e equipe de recebimento. | Incluir EVO-02. |
| DEC-10 | Confirmar volumes, condições de uso, recursos para operação, responsável pelo produto, piloto, metas e sustentação. | Coordenação e representantes operacionais. | Assumir prazo, custo, nível de serviço ou expansão. |
| DEC-11 | Levantar os dados usados no Bússola Social, exportação, históricos a preservar, conferência, corte operacional, continuidade e encerramento do uso anterior. | Coordenação, operadores atuais e responsável pela transição a designar. | Ativar CAP-12 e substituir a operação atual. |

A referência à LOAS no levantamento orienta a validação institucional da ficha e da atuação assistencial. Não define, por si, um formulário obrigatório, uma classificação automática de vulnerabilidade ou um conjunto completo de obrigações para o software. A denominação correta é Lei Orgânica da Assistência Social. A bibliografia revisada distingue normas, referências técnicas e regras locais e indica os limites de aplicação. Este PRD não declara conformidade jurídica já verificada. [F8]

### 8.2 Riscos de negócio e respostas

| Risco | Consequência | Resposta proposta |
|---|---|---|
| Transformar hipótese em política | Conceder ou negar assistência por critério que a instituição não definiu. | Resolver DEC-02 e DEC-03 e registrar a versão da política usada. |
| Permitir que a própria doação renove a aptidão automaticamente | Criar um ciclo em que receber benefício se torna sua própria evidência de elegibilidade. | Manter participação e entrega distintas; exigir decisão explícita para ampliar a regra. |
| Cadastro incompleto ou duplicado | Fragmentar históricos ou atribuir assistência ao núcleo errado. | Identificar casos pendentes e designar responsável pela correção. |
| Registro tardio de presenças e entregas | Produzir aptidão ou disponibilidade desatualizada. | Acordar rotina de lançamento e conferência com a equipe. |
| Confundir saída do Bazar com nova arrecadação | Superestimar contribuições e duplicar itens. | Conferir transferências e preservar a distinção entre origem externa e movimentação interna. |
| Acesso excessivo a informação social | Expor famílias além da finalidade do atendimento. | Validar responsabilidades de acesso e limitar os dados usados em cada tarefa. |
| Crescimento do escopo para CRM, Bazar ou prontuário | Atrasar o ciclo de assistência e tornar o produto difícil de operar. | Tratar novas capacidades como mudança de escopo, com justificativa de negócio. |
| Perda de histórico na substituição | Interromper o acompanhamento ou associar registros ao núcleo errado. | Conferir vínculos e históricos e validar alternativas de consulta antes da troca. [DEC-11] |
| Falta de sustentação após a entrega | Tornar a instituição dependente de pessoas sem disponibilidade para manter a operação. | Designar responsáveis e prever manutenção, suporte e custos continuados. [DEC-10] |

## 9 Governança do documento canônico

### 9.1 Autoridade e controle de mudança

Este PRD passa a ser a referência única de negócio para a organização das próximas entregas. Os materiais anteriores permanecem como fontes e histórico; seus detalhes não são incorporados automaticamente ao escopo. As políticas marcadas como pendentes continuam dependendo de validação institucional, mesmo que um documento anterior as apresente de forma definitiva.

Mudanças que alterem quem pode receber assistência, os critérios de distribuição, os dados coletados, a responsabilidade entre produtos ou os resultados esperados devem atualizar o PRD. O registro da mudança deve informar motivo, itens afetados, decisão, responsável e data. A autoridade para aprovar essas mudanças deverá ser designada em DEC-10.

Uma mudança de negócio pode exigir revisão das specs e dos ADRs. Uma escolha técnica que preserve o comportamento aprovado não exige reescrever o PRD. Uma escolha técnica que altere esse comportamento deve voltar à decisão de produto.

### 9.2 Derivação para specs e ADRs

Cada especificação deve identificar a versão do PRD e os objetivos, capacidades, regras e critérios de aceite que atende. Exemplo: uma spec de entrega referencia OBJ-04, CAP-08, RN-06, RN-10, RN-11, RN-16 e AC-05, AC-06 e AC-10.

As specs detalham comportamentos, fluxos alternativos e validações necessários para realizar essas intenções. Os ADRs documentam decisões técnicas e seus motivos. Nenhum desses documentos pode resolver silenciosamente uma política institucional pendente. Quando houver uma nova decisão de negócio, ela deve ser registrada aqui antes de ser tratada como regra aprovada nas entregas derivadas.

Este PRD não escolhe linguagem, banco de dados, arquitetura, modelo físico, endpoints, telas ou infraestrutura. A divisão de trabalho citada na transcrição mantém uma base comum e duas frentes de atuação, frequência e atendimentos com doações, sem determinar fronteiras técnicas. [F1, §18]

### 9.3 Versão de referência

O arquivo PRD-ERP-Luz-da-Esperanca-v1.1.md é a versão de referência para controle de alterações e acompanha esta entrega. A edição em Word reproduz o mesmo conteúdo para leitura e revisão. Alterações aprovadas devem ser incorporadas à referência e refletidas na edição de leitura para evitar documentos divergentes.

| Versão | Data | Alteração | Situação |
|---|---|---|---|
| 1.0 | 17/09/2026 | Consolidação do problema, solução, escopo, regras, critérios de aceite e decisões pendentes. | Base canônica entregue; validação institucional das propostas e pendências não registrada. |
| 1.1 | 18/09/2026 | Incorporação da ficha recebida, substituição do Bússola Social, diagnóstico a completar, transição e referências do dossiê; preservação das políticas pendentes. | Revisão documental; aprovação institucional ainda não registrada. |

## 10 Fontes e conciliação das divergências

### 10.1 Fontes consultadas

| Ref. | Documento | Uso neste PRD |
|---|---|---|
| F1 | trancription.md | Fonte primária do levantamento. Os localizadores §1 a §18 correspondem aos parágrafos não vazios, na ordem do arquivo. |
| F2 | ERP_Luz_da_Esperanca_Analise_Detalhada(1).docx | Síntese das necessidades, distinção entre pedidos e sugestões e levantamento de lacunas. |
| F3 | Dossie_ERP_Luz_da_Esperança.pdf | Consolidação anterior, com conteúdo de negócio e detalhamento técnico. |
| F4 | ERP-LuzDaEsperanca-Analise-Requisitos-v1.md | Catálogo anterior de requisitos, premissas, regras, modelos e questões abertas. |
| F5 | Ficha de Cadastro de Famílias 2025 — Completo.pdf | Fonte primária do formulário recebido; campos e organização, sem pressupor obrigatoriedade digital. |
| F6 | Esclarecimentos da equipe em 18/09/2026 | Bússola Social identificado como sistema pago atual; decisão de substituição por sistema próprio. |
| F7 | Pesquisa documental de sistemas para organizações sociais, v1.0 | Comparação de oito soluções; referência de mercado sem incorporação automática de funcionalidades. |
| F8 | Bibliografia e fundamentação do ERP Social, v1.1 | Estudos acadêmicos, normas e fontes técnicas; contribuição e limites de aplicação. |

F1 prevalece para verificar o que foi efetivamente solicitado na fala. F2, F3 e F4 ajudam a organizar o produto e identificar lacunas, sem constituírem evidências independentes de aprovação. A classificação P explicita os desdobramentos propostos neste PRD.

F5 e F6 complementam os fatos disponíveis na versão 1.0. F7 e F8 fundamentam a análise e não substituem decisões da instituição. Os documentos F2 a F4 são históricos citados na versão anterior; sua ausência na pasta compartilhada deve ser resolvida com cópias em arquivo histórico ou links de acesso. A ficha, a transcrição e a pesquisa de sistemas estão identificadas no índice do dossiê.

### 10.2 Divergências resolvidas nesta consolidação

| Tema | Diferença nos materiais | Tratamento canônico |
|---|---|---|
| Doações financeiras | F2 trata como tema sem detalhamento e F3 inclui seu registro no ERP. | F1, §§7 a 12, atribui a frente ao CRM. O ERP deste PRD trata assistência e itens. |
| Frequência ativa | F4 propõe 30 dias e possibilidade de contar atendimento pontual. | F1 não define esses parâmetros. DEC-02 permanece aberta, sem padrão automático. |
| Compatibilidade | F1 apresenta uma sugestão; F3 e F4 a elevam a requisito obrigatório. | Mantida como EVO-01, com decisão humana e prioridade a validar. |
| Vulnerabilidade, fila e ficha anual | F4 propõe classificação, ordenação, intervalos e revalidação em 12 meses. | Não adotados como política confirmada. Dependem de DEC-03 e DEC-05. |
| Direção das transferências | F1 descreve Bazar para doações; F4 também prevê social para Bazar. | Incluído apenas o sentido confirmado. Fluxo inverso depende de DEC-07. |
| Doadores e estimativa de valor | F1 discute a necessidade no contexto comercial; F4 a incorpora amplamente ao ERP. | Identificação da origem social no mínimo; consolidação institucional e valoração em EVO-02, com fronteira a validar. |
| Institutos e projetos | F2 ressalva que o vínculo cadastral não foi detalhado; F3 e F4 definem hierarquia rígida. | Projeto e atividade confirmados. Cardinalidade com instituto fica em DEC-04. |
| Aprovação | F3 apresenta o status “Aprovado para Engenharia”; F4 lista questões abertas. | Esse rótulo não é propagado como evidência de aprovação das políticas pendentes. |
| Dados e conformidade | F4 presume regras gerais de consentimento, acesso e campos obrigatórios. | Não são copiadas como política validada. DEC-01, DEC-05 e DEC-08 definem o que precisa ser decidido. |
| Detalhamento técnico | F3 e F4 incluem entidades, tipos de dados, interfaces e metas técnicas. | Separado do PRD de negócio; as specs e os ADRs serão derivados após definição dos comportamentos pertinentes. |
| Ficha e sistema atual | A versão 1.0 tratava a ficha como não recebida e não identificava o sistema atual. | F5 disponível; uso dos campos ainda a validar. Bússola Social e sua substituição registrados em F6 e DEC-11. |
| Bibliografia anterior | Apresentava compatibilidade obrigatória, política emergencial e mecanismos técnicos como decisões já tomadas. | EVO-01 preservada; emergências em DEC-03; mecanismos de segurança e consistência seguem para specs e ADRs, sem escolha antecipada. |

### 10.3 Mapa de rastreabilidade do negócio

| Problema | Objetivos | Capacidades principais | Evidência ou validação |
|---|---|---|---|
| PROB-01 | OBJ-01 e OBJ-06 | CAP-01, CAP-02, CAP-10 e CAP-11 | F1, §§2 e 6; AC-01, AC-08 e AC-09. |
| PROB-02 | OBJ-02 | CAP-04 e CAP-05 | F1, §2; DEC-02 e DEC-03; AC-02 e AC-03. |
| PROB-03 | OBJ-01 e OBJ-03 | CAP-03, CAP-04, CAP-06 e CAP-10 | F1, §§3, 5 e 18; AC-04 e AC-10. |
| PROB-04 | OBJ-04 | CAP-07, CAP-08 e CAP-10 | F1, §§4 e 18; AC-05, AC-06 e AC-11. |
| PROB-05 | OBJ-05 | EVO-01 | F1, §4; decisão de inclusão e validação de compatibilidade. |
| PROB-06 | OBJ-04 e OBJ-06 | CAP-09 e EVO-02 | F1, §§14, 16 e 17; DEC-07 e DEC-09; AC-07. |
| PROB-07 | OBJ-07 | CAP-12 | F6; DEC-10 e DEC-11; AC-12 e AC-13. |
