# Product Backlog — Fabricio

ERP Social Luz da Esperança • Versão 3.2 • 21/10/2026

**Base:** Sprint Planning — Geral v2.3, de 21/10/2026, enviado como definição das equipes. Datas, cartões PB e dependências seguem esse arquivo; a instrução posterior de Fabricio prevalece na atribuição de implementação/revisão. Responsáveis nominais, tarefas TF e metas internas são a decomposição da equipe Fabricio. Prazo final ainda apresentado no geral como provável: **04/12/2026**.

**Situação:** proposta para validação das equipes. Prazo final informado como provável: **04/12/2026**; início em 19/10/2026 é premissa, não fato já ocorrido.

## Escopo e divisão

| Frente | Responsabilidade confirmada / proposta |
|---|---|
| Fabricio — equipe de 5 pessoas | Pessoas, famílias e vínculos; ficha social; institutos/projetos/atividades; frequência e aptidão. |
| Outra frente — equipe de 5 pessoas, líder e Erick, Felipe, Samuel e Paulo conforme o geral | Atendimentos pontuais e visita domiciliar; estoque social e entregas; recebimento de itens do Bazar. |
| Comum — trabalho das duas equipes, não uma terceira equipe | Acesso, auditoria, contratos, histórico e relatórios consolidados, migração, implantação e homologação. Lideranças executoras abaixo são propostas a confirmar na S1. |

CRM, captação/doações financeiras, vendas/caixa/financeiro/estoque comercial do Bazar e Escola Espírita continuam fora do ERP. Identificar doador de itens não é implementar CRM. O ERP recebe itens do Bazar; não implementa o sistema comercial nem exige integração automática quando o lançamento manual referenciado for aprovado.

Fontes: PRD 1.1 (inclui mudanças de 07/10/2026 e CPF obrigatório definido em 21/10/2026), ERS 1.1 e Modelagem lógica v1.1 anexados; divisão atualizada por Fabricio em 19/10. Não houve inspeção de código ou entrevista institucional nova.

## Integrantes e regra de atribuição

Equipe: **Fabricio (líder), Gabriel, Ruan, Alan e Kauã**. Esta divisão nominal traduz P2–P5 do geral v2.3, com a instrução posterior de Fabricio somente revisar; as especialidades individuais e horas disponíveis ainda não foram informadas. O responsável principal pela implementação é um dos quatro executores. O apoio pode implementar subtarefas; quando Fabricio consta como revisor, sua função é exclusivamente analisar código, regras, testes e evidências. Gabriel, Ruan, Alan e Kauã implementam, testam, corrigem e documentam.

**Identificação:** “Gabriel”, nas atribuições internas deste documento, é o membro da equipe de Fabricio informado em 20/10. As referências ao responsável pela frente ATD/EST/ENT/BAZ aparecem como “liderança da outra equipe”. Essa distinção é de papel; não presume se os dois nomes se referem ou não à mesma pessoa.

| Pessoa | Foco principal |
|---|---|
| Fabricio | Somente revisão técnica de código, regras, contratos, testes, documentação e evidências |
| Gabriel | Cadastro, vínculos, persistência, histórico, migração e implementação do motor de aptidão (PB-20) |
| Ruan | Formulários, ficha social, versionamento e consultas |
| Alan | Institutos, projetos, atividades, frequência e implementação da política de aptidão (PB-19) |
| Kauã | Participantes, interfaces de chamada, integração e cenários de verificação |

## Papéis atualizados — Fabricio somente na revisão

Por definição de Fabricio, sua atuação é **exclusivamente revisar código, contratos, regras, testes, documentação e evidências de entrega**, registrando parecer e pendências. Ele não implementa código, APIs, integrações, importadores ou configuração de infraestrutura; não recebe execução de migração, implantação ou produção de documentação de entrega. A aceitação de negócio continua com o representante institucional.

**Executores:** Gabriel, Ruan, Alan e Kauã. **Revisor técnico:** Fabricio, com revisões cruzadas entre os executores. Cada sprint tem quatro tarefas de execução (uma principal para cada executor) e uma tarefa principal de revisão para Fabricio: **28 tarefas de execução + 7 tarefas de revisão = 35 tarefas TF**. Tarefas maiores podem ser decompostas; a quantidade não indica equilíbrio em horas.

A atualização altera a atribuição nominal em relação ao geral v2.3: **PB-19 será implementado por Alan e PB-20 por Gabriel; ambos revisados por Fabricio**. O geral continua sendo a referência de escopo, datas e dependências, mas essas atribuições executoras precisam ser refletidas em sua próxima atualização. Nenhum item de implementação deve permanecer no nome de Fabricio. P2–P5 continuam correspondendo a Gabriel, Ruan, Alan e Kauã.

A capacidade de desenvolvimento passa a ser calculada com **quatro implementadores**, somada à disponibilidade separada de Fabricio para revisão. Reestimar a seleção, especialmente S1, S3, S5 e S6, antes de afirmar que cabe nos prazos. As datas atuais são preservadas como metas do planejamento recebido, não como viabilidade comprovada após a redistribuição.

## Como usar este backlog

Esta é uma única lista de produto, publicada em recortes por equipe. IDs iguais designam o mesmo trabalho, nunca uma segunda entrega. Cartões comuns são contados uma vez no backlog geral; sua execução consome capacidade das equipes envolvidas. Prioridade de execução: dependências habilitadoras primeiro, essenciais do ciclo em seguida e desejáveis após validação do núcleo.

**Estimativas:** a refinar pelos executores. As pontuações preliminares da versão anterior não foram tratadas como velocidade nem convertidas em promessa para o novo prazo. Cada cartão inclui interface, regras, persistência, autorização e verificações; itens grandes devem virar subtarefas antes de entrar na sprint. “Tudo no backlog” não significa “tudo assumido até 04/12”. Essenciais condicionados continuam essenciais; se bloqueados, exigem decisão explícita sobre prazo/escopo, não descarte silencioso.

**Conciliação:** CPF obrigatório, válido e único; sem central de duplicidades na interface conforme PRD atualizado. F-R01 mantém a pendência RF-CAD-07/RF-REL-09 até consulta à SPEC-CAD não anexada. Saúde/religião só após aprovação. Aptidão sem regra/evidência suficiente permanece Pendente. Migração é parte do mínimo do produto e está no backlog comum, condicionada à exportação e ao aceite.


## Backlog — Fabricio

| ID | Entrega | Natureza/prioridade | Principal | Apoio/revisor | Sprint no geral | Referências |
|---|---|---|---|---|---|---|
| PB-03 | Como operador, cadastrar e consultar uma família identificada por número único | Essencial | Gabriel | Ruan | S1 | RF-CAD-01 |
| PB-04 | Como operador, cadastrar pessoa e vínculo familiar, inclusive cadastro mínimo | Essencial | Ruan | Gabriel | S1 | RF-CAD-02, RF-CAD-03, RF-CAD-08, RF-CAD-11 |
| PB-05 | Buscar cadastros antes de criar e impedir CPF inválido ou repetido | Essencial | Gabriel | Kauã | S2 | RF-CAD-06 |
| PB-06 | Trocar titular, encerrar/alterar vínculos e consultar composição histórica | Essencial | Gabriel | Fabricio | S2 | RF-CAD-04, RF-CAD-05, RF-CAD-09 |
| PB-07 | Registrar numerações de calçado e vestuário por pessoa | Essencial | Ruan | Gabriel | S3 | RF-CAD-10 |
| PB-08 | Preencher situação domiciliar e composição econômica por membro | Essencial | Ruan | Gabriel | S3 | RF-FIC-01, RF-FIC-02 |
| PB-09 | Registrar escolaridade, necessidades e situação encontrada | Essencial | Kauã | Ruan | S4 | RF-FIC-04, RF-FIC-05, RF-FIC-07 |
| PB-10 | Consultar versões da ficha e registrar ciência do titular | Essencial condicionado | Ruan | Gabriel | S4 | RF-FIC-08, RF-FIC-09 |
| PB-11 | Aplicar proteção da ficha e habilitação condicionada de dados sensíveis | Essencial condicionado | Gabriel | Ruan | S4 | RF-FIC-06 |
| PB-12 | Manter institutos e projetos com situação e vigência | Essencial | Alan | Kauã | S1 | RF-ATV-01, RF-ATV-02 |
| PB-13 | Cadastrar atividades periódicas/pontuais e encerrá-las preservando registros | Essencial | Alan | Kauã | S2 | RF-ATV-03, RF-ATV-04, RF-ATV-05, RF-ATV-06, RF-ATV-08 |
| PB-14 | Manter participantes e períodos de participação nas atividades | Essencial | Kauã | Alan | S3 | RF-ATV-07 |
| PB-15 | Registrar encontro realizado e chamada em uma tela utilizável no celular | Essencial | Alan | Kauã | S4 | RF-FRQ-01, RF-FRQ-02 |
| PB-16 | Registrar presença de pessoa fora da lista, incluindo cadastro mínimo | Essencial | Kauã | Gabriel | S5 | RF-FRQ-03 |
| PB-17 | Corrigir chamada, lançar retroativamente e cancelar encontro com motivo | Essencial | Alan | Kauã | S5 | RF-FRQ-04, RF-FRQ-07 |
| PB-18 | Consultar frequência por pessoa, atividade e período com cálculo explicável | Essencial | Ruan | Alan | S5 | RF-FRQ-06, RF-REL-04 |
| PB-19 | Configurar e versionar a política de aptidão, sem valores presumidos | Essencial condicionado | Alan | Fabricio (revisão) | S3 | RF-APT-02, RF-APT-03 |
| PB-20 | Avaliar aptidão por data com três estados e evidências | Essencial | Gabriel | Fabricio (revisão) | S5 | RF-APT-01, RF-APT-04, RF-APT-05, RF-APT-06 |
| PB-21 | Consultar famílias por situação de aptidão e data, com evidências | Essencial | Ruan | Fabricio | S6 | RF-APT-07, RF-REL-08 |
| PB-23 | Consultar histórico dos módulos próprios e fornecer dados ao histórico comum | Essencial | Gabriel | Ruan | S6 | Técnico / integração conforme PRD e modelagem |
| F-R01 | Conciliar e implementar unificação/qualidade cadastral se mantida | Essencial em conciliação | Gabriel | Fabricio | Conciliação S1 | RF-CAD-07, RF-REL-09 |
| F-R02 | Renda total e per capita | Desejável | Ruan | Gabriel | Reserva | RF-FIC-03 |
| F-R03 | Alerta de ficha desatualizada | Desejável | Ruan | Kauã | Reserva | RF-FIC-10 |
| F-R04 | Turmas, vagas e lista de espera | Desejável | Alan | Kauã | Reserva | RF-ATV-09 |
| F-R05 | Justificativa de ausência | Desejável | Kauã | Alan | Reserva | RF-FRQ-05 |
| F-R06 | Alerta de interrupção de participação | Desejável | Alan | Fabricio | Reserva | RF-FRQ-08 |

## Detalhamento e aceite

### PB-03 — Como operador, cadastrar e consultar uma família identificada por número único

**Equipe:** Fabricio. **Responsável principal:** Gabriel. **Apoio/revisor:** Ruan. **Estimativa:** a refinar. **Dependências:** C-01, C-02, C-03.

**Aceite:** Família recebe número único; endereço/contatos previstos podem ser registrados; consulta por número/nome disponível; dados ausentes são explícitos e não impedem assistência por exigência documental inventada.

**Requisitos cobertos (ERS):**

- **RF-CAD-01:** O sistema deve cadastrar a família com número único, endereço, bairro, CEP, localização (urbana ou rural) e telefone de contato. — Essencial.

### PB-04 — Como operador, cadastrar pessoa e vínculo familiar, inclusive cadastro mínimo

**Equipe:** Fabricio. **Responsável principal:** Ruan. **Apoio/revisor:** Gabriel. **Estimativa:** a refinar. **Dependências:** C-01, C-02, C-03, PB-03.

**Aceite:** Pessoa é criada com vínculo identificado e data de início; cadastro mínimo exige nome, CPF próprio válido e único e família. Nascimento desconhecido fica sinalizado e não bloqueia enquanto LAC-02 não aprovar sua obrigatoriedade; sexo, RG e campos complementares podem ficar pendentes. LAC-02 não permite dispensar o CPF obrigatório nem autoriza exigir titular sem decisão.

**Requisitos cobertos (ERS):**

- **RF-CAD-02:** O sistema deve cadastrar a pessoa com nome e CPF próprio obrigatório, válido e único, registrando nascimento quando conhecido. Sexo, RG, ocupação, nível escolar e telefone são opcionais no cadastro mínimo. Nascimento desconhecido fica sinalizado e não bloqueia esse fluxo enquanto sua obrigatoriedade não for validada em LAC-02. Validar CPF conforme VAL-02 em criação, edição e importação; CPF ausente impede concluir a gravação. Homônimos com CPFs distintos são permitidos. — Essencial.
- **RF-CAD-03:** O sistema deve vincular a pessoa à família, com início de vigência e parentesco quando informado e aplicável à referência familiar aprovada. A ausência de titular ainda não definido não impede criar o vínculo. O mesmo par pessoa–família não pode ter períodos sobrepostos; vínculos simultâneos com famílias diferentes dependem de LAC-02. Cada fato assistencial identifica sua família na data do fato. — Essencial.
- **RF-CAD-08:** O sistema deve sinalizar dados ausentes no cadastro sem impedir seu uso em atendimentos e entregas. — Essencial.
- **RF-CAD-11:** O sistema deve permitir cadastro mínimo com nome, CPF próprio obrigatório e família no momento do atendimento. Registrar nascimento quando conhecido e sinalizar sua ausência, sem exigir data fictícia ou bloquear esse fluxo enquanto LAC-02 não aprovar sua obrigatoriedade. Sexo, RG e contato não são exigidos. Pessoa e vínculo são gravados juntos ou nenhum; CPF ausente, inválido ou repetido impede concluir o cadastro. — Essencial.

### PB-05 — Buscar cadastros antes de criar e impedir CPF inválido ou repetido

**Equipe:** Fabricio. **Responsável principal:** Gabriel. **Apoio/revisor:** Kauã. **Estimativa:** a refinar. **Dependências:** C-01, C-02, C-03, PB-04.

**Aceite:** Busca por nome, nascimento, CPF e endereço encontra candidatos; homônimos não são fundidos; CPF ausente, vazio, inválido ou já usado é rejeitado em criação/edição/importação, inclusive sob concorrência; homônimos com CPFs próprios distintos são aceitos. Sem central de duplicidades.

**Requisitos cobertos (ERS):**

- **RF-CAD-06:** Antes de criar pessoa ou família, o sistema deve buscar cadastros parecidos por nome, data de nascimento, CPF e endereço, e mostrá-los ao operador. — Essencial.

### PB-06 — Trocar titular, encerrar/alterar vínculos e consultar composição histórica

**Equipe:** Fabricio. **Responsável principal:** Gabriel. **Apoio/revisor:** Fabricio. **Estimativa:** a refinar. **Dependências:** C-01, C-02, C-03, PB-04.

**Aceite:** Vínculos e contagem histórica funcionam sem exigir titular enquanto LAC-02 estiver pendente. Necessidade, quantidade e substituição de referências familiares seguem somente política aprovada; trocas preservam o anterior. Alteração não transfere fatos passados; início inclusivo e fim exclusivo; sobreposições de vínculos respeitam LAC-02. Não presumir sucessor obrigatório nem encerramento da família.

**Requisitos cobertos (ERS):**

- **RF-CAD-04:** Proposta condicionada a LAC-02: permitir indicar e substituir a referência familiar conforme política aprovada. A instituição define necessidade de titular, quantidade de referências, critérios de designação e substituição. Enquanto pendente, não exigir titular nem designá-lo automaticamente para concluir o cadastro. Se a função for aprovada, preservar referências anteriores, períodos, autoria e motivo das trocas. — Essencial, condicionado a LAC-02.
- **RF-CAD-05:** O sistema deve encerrar ou mudar vínculos preservando seus períodos e os anteriores. Efeitos sobre eventual referência familiar seguem somente a política aprovada em LAC-02; a saída de um membro não exige por inferência um sucessor ou o encerramento da família. Alteração retroativa deve detectar fatos afetados e exigir correção explícita, sem transferir silenciosamente presenças, atendimentos ou entregas. — Essencial.
- **RF-CAD-09:** O sistema deve calcular o número de pessoas da família a partir dos vínculos ativos. — Essencial.

### PB-07 — Registrar numerações de calçado e vestuário por pessoa

**Equipe:** Fabricio. **Responsável principal:** Ruan. **Apoio/revisor:** Gabriel. **Estimativa:** a refinar. **Dependências:** C-01, C-02, C-03, PB-04.

**Aceite:** Numerações e data da informação ficam na pessoa; desconhecido não vira tamanho zero; uso para adultos depende de LAC-12.

**Requisitos cobertos (ERS):**

- **RF-CAD-10:** O sistema deve registrar a numeração de calçado e de vestuário por pessoa, com a data da informação. — Essencial.

### PB-08 — Preencher situação domiciliar e composição econômica por membro

**Equipe:** Fabricio. **Responsável principal:** Ruan. **Apoio/revisor:** Gabriel. **Estimativa:** a refinar. **Dependências:** C-01, C-02, C-03, PB-06.

**Aceite:** Blocos aprovados são persistidos por família e membro; desconhecido não vira renda zero; gravação cria versão identificada, com autor/data e contexto dos membros/endereço; nenhuma classificação automática de vulnerabilidade.

**Requisitos cobertos (ERS):**

- **RF-FIC-01:** O sistema deve registrar a situação domiciliar com as opções da ficha: moradia, localização, cômodos, dormitórios, local de risco, domicílio, construção, piso, energia, abastecimento e consumo de água, escoamento, lixo, deslocamento e higiene. — Essencial.
- **RF-FIC-02:** O sistema deve registrar a composição econômica: quantos trabalham, aposentados ou pensionistas, auxílio do governo e qual; e, por membro, ocupação, bico ou pensão e renda em R$. — Essencial.

### PB-09 — Registrar escolaridade, necessidades e situação encontrada

**Equipe:** Fabricio. **Responsável principal:** Kauã. **Apoio/revisor:** Ruan. **Estimativa:** a refinar. **Dependências:** C-01, C-02, C-03, PB-08.

**Aceite:** Escolaridade pertence à criança/adolescente correto; necessidades aceitam opções previstas e outros; situação encontrada tem autor/data e acesso restrito; texto livre não vira alternativa para registrar prontuário ou dados sensíveis proibidos.

**Requisitos cobertos (ERS):**

- **RF-FIC-04:** O sistema deve registrar, para crianças e adolescentes, se estuda, escolarização ou série e modo de estudo. — Essencial.
- **RF-FIC-05:** O sistema deve registrar as necessidades declaradas: alimento, vestuário, calçado, emprego, médico e outros. — Essencial.
- **RF-FIC-07:** O sistema deve registrar a "situação encontrada" em texto livre, com data e autor. — Essencial.

### PB-10 — Consultar versões da ficha e registrar ciência do titular

**Equipe:** Fabricio. **Responsável principal:** Ruan. **Apoio/revisor:** Gabriel. **Estimativa:** a refinar. **Dependências:** C-01, C-02, C-03, PB-08, PB-09.

**Aceite:** Edição publica nova versão completa; versão anterior permanece consultável por autorizado; mudança posterior de endereço ou referência familiar não altera ficha antiga. Ciência guarda forma, data e pessoa conforme decisões de LAC-02/LAC-08; ausência não vira consentimento nem designação automática de titular.

**Requisitos cobertos (ERS):**

- **RF-FIC-08:** O sistema deve registrar a data e o responsável por cada preenchimento da ficha e manter as versões anteriores consultáveis. — Essencial.
- **RF-FIC-09:** O sistema deve registrar forma e data da ciência, pessoa que a prestou e versão da ficha, conforme os responsáveis e procedimentos aprovados em LAC-02 e LAC-08. A ficha em papel identifica um titular, mas não autoriza impor esse papel no ERP antes da decisão. Ausência de ciência ou de referência familiar aprovada não equivale a assinatura ou consentimento; não atribuir um signatário automaticamente. — Essencial.

### PB-11 — Aplicar proteção da ficha e habilitação condicionada de dados sensíveis

**Equipe:** Fabricio. **Responsável principal:** Gabriel. **Apoio/revisor:** Ruan. **Estimativa:** a refinar. **Dependências:** C-01, C-02, C-03, PB-08.

**Aceite:** Saúde, religião, medicamentos e evangelização só são habilitados com decisões registradas; sem aprovação ficam desativados na interface e no servidor; perfil de frequência não recebe ficha, renda ou saúde em busca, API, histórico ou relatório. Campos de saúde não são estendidos automaticamente a todos os membros.

**Requisitos cobertos (ERS):**

- **RF-FIC-06:** O sistema deve registrar saúde espiritual, saúde física, quadro geral, posto de saúde, ACS, medicamentos e participação na evangelização somente se aprovados em LAC-05, com acesso restrito (RF-ACS-03). — Essencial, se aprovado.

### PB-12 — Manter institutos e projetos com situação e vigência

**Equipe:** Fabricio. **Responsável principal:** Alan. **Apoio/revisor:** Kauã. **Estimativa:** a refinar. **Dependências:** C-01, C-02, C-03.

**Aceite:** Institutos e projetos podem ser cadastrados; projeto possui nome, descrição, vigência e situação. Enquanto LAC-04 estiver pendente, instituto não é obrigatório para gravar projeto e não há exclusividade presumida; associação segue somente a cardinalidade e obrigatoriedade aprovadas.

**Requisitos cobertos (ERS):**

- **RF-ATV-01:** O sistema deve manter a lista de institutos: Criança, Jovem, Esclarecimento e Família, Caridade, Divulgação e Mediunidade. — Essencial.
- **RF-ATV-02:** O sistema deve cadastrar projetos com nome, descrição, vigência e situação, validando seus períodos. A associação com institutos, sua obrigatoriedade e cardinalidade dependem de LAC-04; enquanto pendente, não exigir instituto para gravar o projeto nem impor vínculo exclusivo. Encerramento ou mudança cadastral preserva o contexto das atividades e fatos já registrados. — Essencial.

### PB-13 — Cadastrar atividades periódicas/pontuais e encerrá-las preservando registros

**Equipe:** Fabricio. **Responsável principal:** Alan. **Apoio/revisor:** Kauã. **Estimativa:** a refinar. **Dependências:** C-01, C-02, C-03, PB-12.

**Aceite:** Natureza é obrigatória; periódica registra previsão de dias/horários e responsável; pontual registra tipo; natureza de atividade com fatos não pode mudar; encerrar não apaga histórico.

**Requisitos cobertos (ERS):**

- **RF-ATV-03:** O sistema deve cadastrar atividades dentro de um projeto, com natureza obrigatória: periódica ou atendimento pontual. — Essencial.
- **RF-ATV-04:** Para atividade periódica, o sistema deve registrar dias e horários previstos e o responsável. — Essencial.
- **RF-ATV-05:** Para atendimento pontual, o sistema deve registrar o tipo: doação de itens, médico, psicológico, fisioterapia, visita domiciliar ou outro cadastrado. — Essencial.
- **RF-ATV-06:** O sistema não deve permitir mudar a natureza de uma atividade que já tenha registros. — Essencial.
- **RF-ATV-08:** O sistema deve permitir encerrar projetos e atividades sem apagar seus registros. — Essencial.

### PB-14 — Manter participantes e períodos de participação nas atividades

**Equipe:** Fabricio. **Responsável principal:** Kauã. **Apoio/revisor:** Alan. **Estimativa:** a refinar. **Dependências:** C-01, C-02, C-03, PB-04, PB-06, PB-13.

**Aceite:** Entrada/saída da lista mantém período de participação; lista na data passada é recuperável; inscrição sozinha não cria presença nem aptidão.

**Requisitos cobertos (ERS):**

- **RF-ATV-07:** O sistema deve manter a lista de participantes de cada atividade periódica. Estar na lista não conta como presença. — Essencial.

### PB-15 — Registrar encontro realizado e chamada em uma tela utilizável no celular

**Equipe:** Fabricio. **Responsável principal:** Alan. **Apoio/revisor:** Kauã. **Estimativa:** a refinar. **Dependências:** C-01, C-02, C-03, PB-14.

**Aceite:** Só atividade periódica recebe chamada; abrir tela não cria encontro realizado; confirmação grava encontro e marcações atomicamente; não há marcação automática de ausência; pessoa/encontro não duplica; repetição da mesma operação retorna resultado; conflitos não sobrescrevem mudanças; família do fato fica preservada. Encontros distintos no mesmo dia são permitidos.

**Requisitos cobertos (ERS):**

- **RF-FRQ-01:** O sistema deve criar o encontro de uma atividade periódica, com data e responsável. — Essencial.
- **RF-FRQ-02:** O sistema deve registrar presença ou ausência de cada participante no encontro. — Essencial.

### PB-16 — Registrar presença de pessoa fora da lista, incluindo cadastro mínimo

**Equipe:** Fabricio. **Responsável principal:** Kauã. **Apoio/revisor:** Gabriel. **Estimativa:** a refinar. **Dependências:** C-01, C-02, C-03, PB-15.

**Aceite:** Pessoa fora da lista com vínculo válido na data recebe presença; cadastro mínimo é acessível; isso não a inscreve automaticamente nos próximos encontros.

**Requisitos cobertos (ERS):**

- **RF-FRQ-03:** O sistema deve registrar a presença de quem não está na lista de participantes, desde que a pessoa esteja cadastrada com família (RF-CAD-11). — Essencial.

### PB-17 — Corrigir chamada, lançar retroativamente e cancelar encontro com motivo

**Equipe:** Fabricio. **Responsável principal:** Alan. **Apoio/revisor:** Kauã. **Estimativa:** a refinar. **Dependências:** C-01, C-02, C-03, PB-15.

**Aceite:** Correção/cancelamento exige autorização e motivo, preserva antes/depois; cancelado sai do cálculo e não recebe novas presenças; lançamento retroativo diferencia data do fato da gravação e resolve vínculo histórico correto.

**Requisitos cobertos (ERS):**

- **RF-FRQ-04:** O sistema deve permitir corrigir uma presença informando o motivo, mantendo o valor anterior, o autor e a data da correção. — Essencial.
- **RF-FRQ-07:** O sistema deve permitir cancelar um encontro lançado por engano, com motivo, retirando-o do cálculo de frequência. — Essencial.

### PB-18 — Consultar frequência por pessoa, atividade e período com cálculo explicável

**Equipe:** Fabricio. **Responsável principal:** Ruan. **Apoio/revisor:** Alan. **Estimativa:** a refinar. **Dependências:** C-01, C-02, C-03, PB-17.

**Aceite:** Filtros funcionam; total abre registros componentes; percentual mostra numerador/denominador; cancelamentos são excluídos; denominador zero é desconhecido, não 0%/100%; informação faltante não é ausência.

**Requisitos cobertos (ERS):**

- **RF-FRQ-06:** O sistema deve consultar a frequência por pessoa, atividade e período, com encontros realizados, presenças e percentual. — Essencial.
- **RF-REL-04:** O sistema deve gerar o relatório de frequência por atividade e período. — Essencial.

### PB-19 — Configurar e versionar a política de aptidão, sem valores presumidos

**Equipe:** Fabricio. **Responsável principal:** Alan. **Apoio/revisor:** Fabricio (somente revisão). **Estimativa:** a refinar. **Dependências:** C-01, C-02, C-03, PB-13.

**Aceite:** Política possui autor, início de vigência e parâmetros aprovados; versões não se sobrepõem; consulta passada escolhe política daquela data; sem política vigente não há regra padrão. Sem LAC-01 resolvida, somente estrutura e testes com regra fictícia podem ser demonstrados; aceite institucional continua bloqueado.

**Requisitos cobertos (ERS):**

- **RF-APT-02:** O sistema deve permitir que a coordenação configure o critério: período de referência, frequência mínima e atividades que contam. Não há valor padrão; enquanto não for configurado, toda família fica Pendente. — Essencial.
- **RF-APT-03:** O sistema deve guardar cada versão do critério, com início de vigência e autor, e usar a versão vigente na data avaliada. — Essencial.

### PB-20 — Avaliar aptidão por data com três estados e evidências

**Equipe:** Fabricio. **Responsável principal:** Gabriel. **Apoio/revisor:** Fabricio (somente revisão). **Estimativa:** a refinar. **Dependências:** C-01, C-02, C-03, PB-06, PB-17, PB-19.

**Aceite:** Um membro que cumpra basta para Apta; cadastro/inscrição/atendimento/doação não são evidências; sem regra ou evidência suficiente resulta Pendente; Não apta exige evidência conclusiva; retorno inclui política aplicável, referência, motivo e evidências; avaliações anteriores não são reescritas.

**Requisitos cobertos (ERS):**

- **RF-APT-01:** O sistema deve calcular a situação de cada família em uma data de referência: Apta, Não apta ou Pendente. — Essencial.
- **RF-APT-04:** O sistema deve mostrar, junto da situação, o membro, a atividade, o período e a frequência que a sustentam. — Essencial.
- **RF-APT-05:** O sistema deve considerar apenas presença em atividade periódica. Cadastro, inscrição, atendimento pontual e recebimento de doação não tornam a família apta. — Essencial.
- **RF-APT-06:** O sistema deve mostrar as famílias Pendentes separadas, sem tratá-las como Não aptas. — Essencial.

### PB-21 — Consultar famílias por situação de aptidão e data, com evidências

**Equipe:** Fabricio. **Responsável principal:** Ruan. **Apoio/revisor:** Fabricio. **Estimativa:** a refinar. **Dependências:** C-01, C-02, C-03, PB-20.

**Aceite:** Apta, Não apta e Pendente são grupos distinguíveis para a data pedida; detalhe explica resultado; perfil distribuição recebe apenas os dados autorizados.

**Requisitos cobertos (ERS):**

- **RF-APT-07:** O sistema deve listar as famílias aptas em uma data, para uso da equipe de distribuição. — Essencial.
- **RF-REL-08:** O sistema deve gerar o relatório de situação de aptidão, com as famílias Aptas, Não aptas e Pendentes em uma data. — Essencial.

### PB-23 — Consultar histórico dos módulos próprios e fornecer dados ao histórico comum

**Equipe:** Fabricio. **Responsável principal:** Gabriel. **Apoio/revisor:** Ruan. **Estimativa:** a refinar. **Dependências:** C-01, C-02, C-03, PB-06, PB-10, PB-18.

**Aceite:** Fornecer fatos CAD/FIC/FRQ para C-05 com família histórica e controle de acesso; versão antiga da ficha e presenças permanecem corretas após mudança de vínculo. A tela consolidada pertence a C-05 e não é duplicada neste cartão.

### F-R01 — Conciliar e implementar unificação/qualidade cadastral se mantida

**Equipe:** Fabricio. **Responsável principal:** Gabriel. **Apoio/revisor:** Fabricio. **Estimativa:** a refinar. **Dependências:** C-01.

**Aceite:** Decisão na S1: PRD remove central, não elimina por si toda unificação; obter SPEC-CAD. Se mantido, estimar e alocar formalmente; histórico não é apagado.

**Requisitos cobertos (ERS):**

- **RF-CAD-07:** O sistema deve permitir que um usuário autorizado unifique dois cadastros duplicados, levando todo o histórico e registrando quem unificou e por quê. — Essencial.
- **RF-REL-09:** O sistema deve listar cadastros com possível duplicidade ou dados ausentes, com data de identificação e de resolução. — Essencial.

### F-R02 — Renda total e per capita

**Equipe:** Fabricio. **Responsável principal:** Ruan. **Apoio/revisor:** Gabriel. **Estimativa:** a refinar. **Dependências:** C-01.

**Aceite:** Exibir soma parcial e denominador quando renda incompleta; sem vulnerabilidade automática.

**Requisitos cobertos (ERS):**

- **RF-FIC-03:** O sistema deve calcular a renda familiar total e per capita apenas como informação, sem classificar vulnerabilidade automaticamente. — Desejável.

### F-R03 — Alerta de ficha desatualizada

**Equipe:** Fabricio. **Responsável principal:** Ruan. **Apoio/revisor:** Kauã. **Estimativa:** a refinar. **Dependências:** C-01.

**Aceite:** Prazo configurado, sem padrão inventado e sem impedir atendimento.

**Requisitos cobertos (ERS):**

- **RF-FIC-10:** O sistema deve sinalizar fichas sem atualização há mais tempo que o prazo configurado. Não há prazo padrão. — Desejável.

### F-R04 — Turmas, vagas e lista de espera

**Equipe:** Fabricio. **Responsável principal:** Alan. **Apoio/revisor:** Kauã. **Estimativa:** a refinar. **Dependências:** C-01.

**Aceite:** Validar LAC-04 antes de detalhar capacidade e inscrição.

**Requisitos cobertos (ERS):**

- **RF-ATV-09:** O sistema deve controlar turmas, número de vagas e lista de espera. — Desejável.

### F-R05 — Justificativa de ausência

**Equipe:** Fabricio. **Responsável principal:** Kauã. **Apoio/revisor:** Alan. **Estimativa:** a refinar. **Dependências:** C-01.

**Aceite:** Registrar justificativa; efeito no cálculo apenas conforme política aprovada.

**Requisitos cobertos (ERS):**

- **RF-FRQ-05:** O sistema deve registrar justificativa de ausência. O efeito da justificativa na aptidão depende de LAC-01. — Desejável.

### F-R06 — Alerta de interrupção de participação

**Equipe:** Fabricio. **Responsável principal:** Alan. **Apoio/revisor:** Fabricio. **Estimativa:** a refinar. **Dependências:** C-01.

**Aceite:** Critério configurável aprovado, sem ausência presumida.

**Requisitos cobertos (ERS):**

- **RF-FRQ-08:** O sistema deve sinalizar participantes com interrupção de participação, conforme critério configurado. — Desejável.

## Critérios comuns de conclusão

Código integrado/revisado; critérios de cada item demonstrados; testes de regras críticas; controle de acesso no servidor; autoria e histórico preservados; nenhuma informação ausente convertida em zero, falso, ausência ou Não apta; interface em português, datas/valores locais e chamada/entrega utilizáveis no celular. Cada sprint testa suas entregas; a S7 não é a primeira integração.

Operações repetidas não duplicam fatos; conflitos de revisão não sobrescrevem silenciosamente; entregas/estornos são atômicos e saldo nunca negativo. Declaração de produção exige decisões LAC aplicáveis e fonte real conferida. Enquanto LAC-08 não estiver resolvida, demonstrações usam dados sintéticos.


## Uso das atribuições de reserva

F-R01 tem Gabriel responsável pelo diagnóstico técnico e eventual implementação; Fabricio apenas revisa o diagnóstico. A decisão institucional de escopo cabe aos responsáveis de negócio. Se a implementação for mantida, estimar e selecionar explicitamente. Os responsáveis de F-R02 a F-R06 são referências para refinamento futuro; a atribuição não inclui esses desejáveis automaticamente nas sete sprints. O Sprint Planning detalha também a participação nominal nos cartões comuns.


## Correspondência com o planejamento geral v2.3

As semanas dos 20 PB principais são exatamente as do geral enviado: PB-03/PB-04/PB-12 na S1; PB-05/PB-06/PB-13 na S2; PB-07/PB-08/PB-14/PB-19 na S3; PB-09/PB-10/PB-11/PB-15 na S4; PB-16/PB-17/PB-18/PB-20 na S5; PB-21/PB-23 na S6. S7 encerra homologação em C-10. PB-05 fica coordenado por Gabriel e PB-07 por Ruan, conforme P2/P3 do geral; Kauã continua responsável principal por suas sete tarefas de execução, detalhadas no Sprint Planning.

PB-17 tem meta interna de conclusão em 17/11 para liberar PB-20 em 18/11, prazo do geral. Entregar PB-20 cedo em 18/11 é proposta interna para permitir validar G-10 no mesmo dia, a alinhar com a outra frente. A validação real de C-04 depende dessa disponibilidade e termina em 20/11; os testes anteriores são preparação contratual.

O Sprint Planning — Fabricio v3.2 contém 35 tarefas TF: 28 de execução para Gabriel/Ruan/Alan/Kauã e 7 de revisão exclusiva para Fabricio. Cada pessoa tem uma responsabilidade principal por semana. Essas tarefas detalham a implementação ou revisão dos PB/C existentes; não duplicam requisitos/estimativas nem se tornam novos itens de produto. A conferência do geral e suas ressalvas operacionais estão nesse documento.
