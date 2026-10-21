# Product Backlog — Geral

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

## Lista priorizada e responsáveis

Os itens são priorizados por dependências habilitadoras, ciclo essencial e depois desejáveis. Estimativas a refinar; as fases são previsão, não evidência de conclusão. Itens comuns são contados uma vez no geral e executados nas parcelas TF/TG de cada equipe.

| ID | Entrega | Natureza/prioridade | Execução principal | Apoio/revisão | Fase/meta | Referências |
|---|---|---|---|---|---|---|
| PB-03 | Como operador, cadastrar e consultar uma família identificada por número único | Essencial | Gabriel (dev da equipe Fabricio) | Ruan | S1 | RF-CAD-01 |
| PB-04 | Como operador, cadastrar pessoa e vínculo familiar, inclusive cadastro mínimo | Essencial | Ruan | Gabriel (dev da equipe Fabricio) | S1 | RF-CAD-02, RF-CAD-03, RF-CAD-08, RF-CAD-11 |
| PB-05 | Buscar cadastros antes de criar e impedir CPF inválido ou repetido | Essencial | Gabriel (dev da equipe Fabricio) | Kauã | S2 | RF-CAD-06 |
| PB-06 | Trocar titular, encerrar/alterar vínculos e consultar composição histórica | Essencial | Gabriel (dev da equipe Fabricio) | Fabricio | S2 | RF-CAD-04, RF-CAD-05, RF-CAD-09 |
| PB-07 | Registrar numerações de calçado e vestuário por pessoa | Essencial | Ruan | Gabriel (dev da equipe Fabricio) | S3 | RF-CAD-10 |
| PB-08 | Preencher situação domiciliar e composição econômica por membro | Essencial | Ruan | Gabriel (dev da equipe Fabricio) | S3 | RF-FIC-01, RF-FIC-02 |
| PB-09 | Registrar escolaridade, necessidades e situação encontrada | Essencial | Kauã | Ruan | S4 | RF-FIC-04, RF-FIC-05, RF-FIC-07 |
| PB-10 | Consultar versões da ficha e registrar ciência do titular | Essencial condicionado | Ruan | Gabriel (dev da equipe Fabricio) | S4 | RF-FIC-08, RF-FIC-09 |
| PB-11 | Aplicar proteção da ficha e habilitação condicionada de dados sensíveis | Essencial condicionado | Gabriel (dev da equipe Fabricio) | Ruan | S4 | RF-FIC-06 |
| PB-12 | Manter institutos e projetos com situação e vigência | Essencial | Alan | Kauã | S1 | RF-ATV-01, RF-ATV-02 |
| PB-13 | Cadastrar atividades periódicas/pontuais e encerrá-las preservando registros | Essencial | Alan | Kauã | S2 | RF-ATV-03, RF-ATV-04, RF-ATV-05, RF-ATV-06, RF-ATV-08 |
| PB-14 | Manter participantes e períodos de participação nas atividades | Essencial | Kauã | Alan | S3 | RF-ATV-07 |
| PB-15 | Registrar encontro realizado e chamada em uma tela utilizável no celular | Essencial | Alan | Kauã | S4 | RF-FRQ-01, RF-FRQ-02 |
| PB-16 | Registrar presença de pessoa fora da lista, incluindo cadastro mínimo | Essencial | Kauã | Gabriel (dev da equipe Fabricio) | S5 | RF-FRQ-03 |
| PB-17 | Corrigir chamada, lançar retroativamente e cancelar encontro com motivo | Essencial | Alan | Kauã | S5 | RF-FRQ-04, RF-FRQ-07 |
| PB-18 | Consultar frequência por pessoa, atividade e período com cálculo explicável | Essencial | Ruan | Alan | S5 | RF-FRQ-06, RF-REL-04 |
| PB-19 | Configurar e versionar a política de aptidão, sem valores presumidos | Essencial condicionado | Alan | Fabricio (somente revisão) | S3 | RF-APT-02, RF-APT-03 |
| PB-20 | Avaliar aptidão por data com três estados e evidências | Essencial | Gabriel (dev da equipe Fabricio) | Fabricio (somente revisão) | S5 | RF-APT-01, RF-APT-04, RF-APT-05, RF-APT-06 |
| PB-21 | Consultar famílias por situação de aptidão e data, com evidências | Essencial | Ruan | Fabricio | S6 | RF-APT-07, RF-REL-08 |
| PB-23 | Consultar histórico dos módulos próprios e fornecer dados ao histórico comum | Essencial | Gabriel (dev da equipe Fabricio) | Ruan | S6 | Técnico/integração conforme modelagem |
| G-01 | Cadastrar itens, categorias, unidades e numerações | Essencial | G2 | G3 | S1–S2 (fim 30/10) | RF-EST-01, RF-EST-08 |
| G-02 | Identificar origens: doadores de itens e campanhas | Essencial | G4 | G5 | S1–S2 (fim 30/10) | RF-EST-02 |
| G-03 | Registrar atendimento à pessoa ou à família | Essencial | G2 | G3 | S3 | RF-ATD-01, RF-ATD-02, RF-ATD-03, RF-ATD-04, RF-ATD-05, RF-ATD-08 |
| G-04 | Registrar visita domiciliar | Essencial condicionado | G4 | G2 | S3 | RF-ATD-06 |
| G-05 | Corrigir e cancelar atendimentos | Essencial | G5 | G3 | S3 | RF-ATD-07 |
| G-06 | Registrar entrada e triagem de itens | Essencial | G4 | G5 | S4 | RF-EST-03, RF-EST-04 |
| G-07 | Consultar lotes, validade, disponibilidade e movimentos | Essencial | G2 | G4 | S4 | RF-EST-05, RF-EST-09, RF-EST-10 |
| G-08 | Registrar ajustes, inventário e saldo inicial | Essencial | G3 | G5 | S5/5a (18/11) | RF-EST-06, RF-EST-07, RF-MIG-06 |
| G-09 | Receber e conferir transferências do Bazar | Essencial condicionado | G4 | G3 | S5/5a (18/11) | RF-BAZ-01, RF-BAZ-02, RF-BAZ-03, RF-BAZ-04 |
| G-10 | Preparar entrega consultando família, necessidades e aptidão | Essencial | G2 | G5 | S5/5a (18/11) | RF-ENT-01, RF-ENT-02 |
| G-11 | Confirmar entrega e baixa atômica, segura contra repetição | Essencial | G2 | G3 | S5/5b (20/11) | RF-ENT-03, RF-ENT-04, RF-ENT-05 |
| G-12 | Tratar exceções de aptidão na entrega | Essencial condicionado | G4 | G5 | S5/5b (20/11) | RF-ENT-06 |
| G-13 | Estornar entrega lançada por engano | Essencial | G2 | G3 | S6 | RF-ENT-07 |
| G-14 | Relatórios de estoque e de entregas por família/item | Essencial | G3 | G4 | S6 | RF-REL-05, RF-REL-06 |
| G-15 | Fornecer atendimentos e entregas ao histórico comum | Essencial | G5 | G3 | S6 | Técnico/integração conforme modelagem |
| C-01 | Acordar arquitetura, contratos, decisões e ambiente integrado | Habilitador | Alan (Fabricio) + G3 (Gabriel) | Fabricio + Gabriel (líder) | S1; contrato revisado durante o projeto | Técnico/integração conforme modelagem |
| C-02 | Login, usuários, perfis e proteção de acesso | Essencial | Alan + Kauã (Fabricio) | Fabricio; Gabriel (líder) revisa acesso da sua frente | S1; aplicar perfis em todos os módulos | RF-ACS-01, RF-ACS-02, RF-ACS-03, RF-ACS-06 |
| C-03 | Auditoria, datas históricas e consistência das operações | Essencial | G3 | Gabriel (líder) + Fabricio | S1; transações próprias integradas durante o desenvolvimento | RF-ACS-04, RF-ACS-05 |
| C-04 | Formalizar e validar integração de aptidão com entregas | Habilitador | Gabriel (dev da equipe Fabricio) + G2/G4 | Fabricio + Gabriel (líder) | Contrato S1; exemplos S4; avaliação real 18/11; aceite 20/11 | Técnico/integração conforme modelagem |
| C-05 | Histórico familiar/pessoal consolidado | Essencial | Ruan (Fabricio) + G5 | Fabricio + Gabriel (líder) | S6, após PB-23/G-15 | RF-REL-01, RF-REL-02 |
| C-06 | Alcance consolidado e detalhes dos totais | Essencial | G3 + G4 + Alan (Fabricio) | Gabriel (líder) + Fabricio | S6, após C-05 e relatórios dos módulos | RF-REL-03, RF-REL-07 |
| C-07 | Mapear exportação do Bússola e planejar corte | Essencial condicionado | Ruan (Fabricio) + G4 | Fabricio + Gabriel (líder) | S2, fonte/mapeamento/corte | Técnico/integração conforme modelagem |
| C-08 | Importar cadastros e históricos com conferência | Essencial condicionado | Gabriel (dev da equipe Fabricio) + G3/G4 | Fabricio + Gabriel (líder) | S3–S5 construção; S6 conferência | RF-MIG-01, RF-MIG-02, RF-MIG-03, RF-MIG-04, RF-MIG-05 |
| C-09 | Operação: implantação, backup, restauração e contingência | Habilitador | G5 + Kauã (Fabricio) | Gabriel (líder) + Fabricio | S1–S5 controles/backup; S6 restauração/manual | Técnico/integração conforme modelagem |
| C-10 | Homologação integrada, correções, capacitação e entrega final | Habilitador | Gabriel/Ruan/Alan/Kauã (Fabricio) + G2–G5 | Fabricio + Gabriel (líder) | S7 | Técnico/integração conforme modelagem |
| F-R01 | Conciliar e implementar unificação/qualidade cadastral se mantida | Essencial em conciliação | Gabriel (dev da equipe Fabricio) | Fabricio | Conciliação S1 | RF-CAD-07, RF-REL-09 |
| F-R02 | Renda total e per capita | Desejável | Ruan | Gabriel (dev da equipe Fabricio) | Reserva | RF-FIC-03 |
| F-R03 | Alerta de ficha desatualizada | Desejável | Ruan | Kauã | Reserva | RF-FIC-10 |
| F-R04 | Turmas, vagas e lista de espera | Desejável | Alan | Kauã | Reserva | RF-ATV-09 |
| F-R05 | Justificativa de ausência | Desejável | Kauã | Alan | Reserva | RF-FRQ-05 |
| F-R06 | Alerta de interrupção de participação | Desejável | Alan | Fabricio | Reserva | RF-FRQ-08 |
| G-R01 | Agendamento de atendimentos | Desejável | G2 | Gabriel (líder, somente revisão) | Reserva | RF-ATD-09 |
| G-R02 | Consolidação por doador/campanha com valor estimado | Desejável | G3 | Gabriel (líder, somente revisão) | Reserva | RF-EST-11 |
| G-R03 | Compatibilidade por tamanho | Desejável | G5 | Gabriel (líder, somente revisão) | Reserva | RF-ENT-08 |
| G-R04 | Prioridade, limites e intervalos de entrega | Desejável | G4 | Gabriel (líder, somente revisão) | Reserva | RF-ENT-09 |
| C-R01 | Exportar relatórios em CSV e PDF | Desejável | G5 + Ruan (Fabricio) | Fabricio + Gabriel (líder) | Reserva | RF-REL-10 |
| C-R02 | Auditar consulta à ficha e dados sensíveis | Desejável | Alan (Fabricio) + G3 | Fabricio + Gabriel (líder) | Reserva | RF-ACS-07 |

## Detalhamento e critérios de aceite

### PB-03 — Como operador, cadastrar e consultar uma família identificada por número único

**Equipe:** Fabricio. **Responsável principal:** Gabriel (dev da equipe Fabricio). **Apoio/revisor:** Ruan. **Estimativa:** a refinar. **Dependências:** C-01, C-02, C-03.

**Aceite:** Família recebe número único; endereço/contatos previstos podem ser registrados; consulta por número/nome disponível; dados ausentes são explícitos e não impedem assistência por exigência documental inventada.

**Requisitos cobertos (ERS):**

- **RF-CAD-01:** O sistema deve cadastrar a família com número único, endereço, bairro, CEP, localização (urbana ou rural) e telefone de contato. — Essencial.

### PB-04 — Como operador, cadastrar pessoa e vínculo familiar, inclusive cadastro mínimo

**Equipe:** Fabricio. **Responsável principal:** Ruan. **Apoio/revisor:** Gabriel (dev da equipe Fabricio). **Estimativa:** a refinar. **Dependências:** C-01, C-02, C-03, PB-03.

**Aceite:** Pessoa é criada com vínculo identificado e data de início; cadastro mínimo admite nome, nascimento e família, com campos restantes pendentes; CPF/RG opcionais; obrigatório completo depende de LAC-02, inclusive conciliação do campo sexo com CAD-11.

**Requisitos cobertos (ERS):**

- **RF-CAD-02:** O sistema deve cadastrar a pessoa com nome, data de nascimento e sexo. CPF, RG, ocupação, nível escolar e telefone são opcionais. — Essencial.
- **RF-CAD-03:** O sistema deve vincular cada pessoa assistida a uma família, com parentesco em relação ao titular e data de início do vínculo. — Essencial.
- **RF-CAD-08:** O sistema deve sinalizar dados ausentes no cadastro sem impedir seu uso em atendimentos e entregas. — Essencial.
- **RF-CAD-11:** O sistema deve permitir um cadastro mínimo (nome, data de nascimento e família) no momento de um atendimento, para completar depois. — Essencial.

### PB-05 — Buscar cadastros antes de criar e impedir CPF inválido ou repetido

**Equipe:** Fabricio. **Responsável principal:** Gabriel (dev da equipe Fabricio). **Apoio/revisor:** Kauã. **Estimativa:** a refinar. **Dependências:** C-01, C-02, C-03, PB-04.

**Aceite:** Busca por nome, nascimento, CPF e endereço encontra candidatos; homônimos não são fundidos; CPF preenchido inválido ou já usado é rejeitado em criação/edição, inclusive sob concorrência; vários cadastros sem CPF são aceitos. Sem central de duplicidades.

**Requisitos cobertos (ERS):**

- **RF-CAD-06:** Antes de criar pessoa ou família, o sistema deve buscar cadastros parecidos por nome, data de nascimento, CPF e endereço, e mostrá-los ao operador. — Essencial.

### PB-06 — Trocar titular, encerrar/alterar vínculos e consultar composição histórica

**Equipe:** Fabricio. **Responsável principal:** Gabriel (dev da equipe Fabricio). **Apoio/revisor:** Fabricio. **Estimativa:** a refinar. **Dependências:** C-01, C-02, C-03, PB-04.

**Aceite:** Um titular vigente conforme regra aprovada; troca preserva anterior; contagem usa vínculos ativos; alteração não transfere fatos passados; início inclusivo e fim exclusivo; sobreposições respeitam decisão de LAC-02, sem política presumida.

**Requisitos cobertos (ERS):**

- **RF-CAD-04:** O sistema deve indicar um titular por família e permitir trocá-lo, mantendo o anterior no histórico. — Essencial.
- **RF-CAD-05:** O sistema deve permitir encerrar ou mudar o vínculo de uma pessoa sem apagar os anteriores. Presenças, atendimentos e entregas continuam na família em que ocorreram. — Essencial.
- **RF-CAD-09:** O sistema deve calcular o número de pessoas da família a partir dos vínculos ativos. — Essencial.

### PB-07 — Registrar numerações de calçado e vestuário por pessoa

**Equipe:** Fabricio. **Responsável principal:** Ruan. **Apoio/revisor:** Gabriel (dev da equipe Fabricio). **Estimativa:** a refinar. **Dependências:** C-01, C-02, C-03, PB-04.

**Aceite:** Numerações e data da informação ficam na pessoa; desconhecido não vira tamanho zero; uso para adultos depende de LAC-12.

**Requisitos cobertos (ERS):**

- **RF-CAD-10:** O sistema deve registrar a numeração de calçado e de vestuário por pessoa, com a data da informação. — Essencial.

### PB-08 — Preencher situação domiciliar e composição econômica por membro

**Equipe:** Fabricio. **Responsável principal:** Ruan. **Apoio/revisor:** Gabriel (dev da equipe Fabricio). **Estimativa:** a refinar. **Dependências:** C-01, C-02, C-03, PB-06.

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

**Equipe:** Fabricio. **Responsável principal:** Ruan. **Apoio/revisor:** Gabriel (dev da equipe Fabricio). **Estimativa:** a refinar. **Dependências:** C-01, C-02, C-03, PB-08, PB-09.

**Aceite:** Edição publica nova versão completa; versão anterior permanece consultável por autorizado; mudança posterior de endereço/titular não altera ficha antiga; ciência/assinatura em papel guarda forma/data; ausência não vira consentimento.

**Requisitos cobertos (ERS):**

- **RF-FIC-08:** O sistema deve registrar a data e o responsável por cada preenchimento da ficha e manter as versões anteriores consultáveis. — Essencial.
- **RF-FIC-09:** O sistema deve registrar que o titular assinou a ficha em papel, com a data, ou outra forma de ciência definida em LAC-08. — Essencial.

### PB-11 — Aplicar proteção da ficha e habilitação condicionada de dados sensíveis

**Equipe:** Fabricio. **Responsável principal:** Gabriel (dev da equipe Fabricio). **Apoio/revisor:** Ruan. **Estimativa:** a refinar. **Dependências:** C-01, C-02, C-03, PB-08.

**Aceite:** Saúde, religião, medicamentos e evangelização só são habilitados com decisões registradas; sem aprovação ficam desativados na interface e no servidor; perfil de frequência não recebe ficha, renda ou saúde em busca, API, histórico ou relatório. Campos de saúde não são estendidos automaticamente a todos os membros.

**Requisitos cobertos (ERS):**

- **RF-FIC-06:** O sistema deve registrar saúde espiritual, saúde física, quadro geral, posto de saúde, ACS, medicamentos e participação na evangelização somente se aprovados em LAC-05, com acesso restrito (RF-ACS-03). — Essencial, se aprovado.

### PB-12 — Manter institutos e projetos com situação e vigência

**Equipe:** Fabricio. **Responsável principal:** Alan. **Apoio/revisor:** Kauã. **Estimativa:** a refinar. **Dependências:** C-01, C-02, C-03.

**Aceite:** Institutos previstos podem ser mantidos; projeto possui nome, descrição, instituto, vigência e situação; validação de vigência e organização segue LAC-04.

**Requisitos cobertos (ERS):**

- **RF-ATV-01:** O sistema deve manter a lista de institutos: Criança, Jovem, Esclarecimento e Família, Caridade, Divulgação e Mediunidade. — Essencial.
- **RF-ATV-02:** O sistema deve cadastrar projetos com nome, descrição, instituto, período de vigência e situação (ativo ou encerrado). — Essencial.

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

**Equipe:** Fabricio. **Responsável principal:** Kauã. **Apoio/revisor:** Gabriel (dev da equipe Fabricio). **Estimativa:** a refinar. **Dependências:** C-01, C-02, C-03, PB-15.

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

**Equipe:** Fabricio. **Responsável principal:** Gabriel (dev da equipe Fabricio). **Apoio/revisor:** Fabricio (somente revisão). **Estimativa:** a refinar. **Dependências:** C-01, C-02, C-03, PB-06, PB-17, PB-19.

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

**Equipe:** Fabricio. **Responsável principal:** Gabriel (dev da equipe Fabricio). **Apoio/revisor:** Ruan. **Estimativa:** a refinar. **Dependências:** C-01, C-02, C-03, PB-06, PB-10, PB-18.

**Aceite:** Fornecer fatos CAD/FIC/FRQ para C-05 com família histórica e controle de acesso; versão antiga da ficha e presenças permanecem corretas após mudança de vínculo. A tela consolidada pertence a C-05 e não é duplicada neste cartão.

### G-01 — Cadastrar itens, categorias, unidades e numerações

**Frente:** Gabriel. **Execução principal:** G2. **Revisão:** G3. **Estimativa:** a refinar. **Dependências:** C-01, C-02, C-03.

**Aceite:** Quantidade usa decimal exato e precisão da unidade; unidades diferentes não são somadas implicitamente; mudança de unidade não reinterpreta movimentos anteriores.

**Requisitos cobertos (ERS):**

- **RF-EST-01:** O sistema deve cadastrar itens com nome, categoria, unidade de medida e, quando fizer sentido, tamanho ou numeração. — Essencial.
- **RF-EST-08:** O sistema não deve somar quantidades de unidades diferentes (pares, peças, caixas, quilos) sem regra de conversão cadastrada. — Essencial.

### G-02 — Identificar origens: doadores de itens e campanhas

**Frente:** Gabriel. **Execução principal:** G4. **Revisão:** G5. **Estimativa:** a refinar. **Dependências:** C-02.

**Aceite:** Cadastrar origem física/jurídica e campanha; identificação do doador de itens não cria CRM financeiro. Origem desconhecida permanece explícita.

**Requisitos cobertos (ERS):**

- **RF-EST-02:** O sistema deve cadastrar as origens das doações: doador pessoa física, doador empresa e campanha. — Essencial.

### G-03 — Registrar atendimento à pessoa ou à família

**Frente:** Gabriel. **Execução principal:** G2. **Revisão:** G3. **Estimativa:** a refinar. **Dependências:** PB-04, PB-13, C-02, C-03.

**Aceite:** Registrar data, tipo, família, pessoa opcional, executor e operador distintos; duas realizações geram duas ocorrências, sem presença. Reusar cadastro mínimo; sem diagnóstico/prescrição.

**Requisitos cobertos (ERS):**

- **RF-ATD-01:** O sistema deve registrar o atendimento realizado: atividade, tipo, data, pessoa e família atendidas e responsável pela execução. — Essencial.
- **RF-ATD-02:** O sistema deve exigir que a pessoa atendida esteja cadastrada e vinculada a uma família, permitindo o cadastro mínimo (RF-CAD-11). — Essencial.
- **RF-ATD-03:** O sistema deve permitir registrar atendimento dirigido à família como um todo, sem indicar um membro. — Essencial.
- **RF-ATD-04:** O sistema deve aceitar vários atendimentos da mesma pessoa em datas diferentes, cada um como ocorrência própria, sem gerar presença. — Essencial.
- **RF-ATD-05:** O sistema deve permitir uma observação curta sobre o atendimento, sem campos de diagnóstico, prescrição ou prontuário. — Essencial.
- **RF-ATD-08:** O sistema deve identificar quem executou o atendimento, com nome e função, mesmo que a pessoa não seja usuária do sistema. — Essencial.

### G-04 — Registrar visita domiciliar

**Frente:** Gabriel. **Execução principal:** G4. **Revisão:** G2. **Estimativa:** a refinar. **Dependências:** G-03.

**Aceite:** Visita ligada à família com data, responsável e situação encontrada; respeitar acesso e LAC-13; não sobrescrever ficha social automaticamente.

**Requisitos cobertos (ERS):**

- **RF-ATD-06:** O sistema deve registrar a visita domiciliar com data, responsável e situação encontrada, ligada à família. — Essencial.

### G-05 — Corrigir e cancelar atendimentos

**Frente:** Gabriel. **Execução principal:** G5. **Revisão:** G3. **Estimativa:** a refinar. **Dependências:** G-03, C-03.

**Aceite:** Exigir motivo, autor e revisão esperada; manter original e família do fato; cancelamento deixa trilha e ajusta totais.

**Requisitos cobertos (ERS):**

- **RF-ATD-07:** O sistema deve permitir corrigir ou cancelar um atendimento com motivo, preservando o registro original. — Essencial.

### G-06 — Registrar entrada e triagem de itens

**Frente:** Gabriel. **Execução principal:** G4. **Revisão:** G5. **Estimativa:** a refinar. **Dependências:** G-01, G-02, C-03.

**Aceite:** Guardar recebido, aceito e descartado com motivo; só aceito gera lote/saldo. Confirmação repetida não duplica entrada; falha não grava parcialmente.

**Requisitos cobertos (ERS):**

- **RF-EST-03:** O sistema deve registrar cada entrada com data, origem (cadastrada, avulsa ou desconhecida), itens, quantidades, unidades e responsável pelo recebimento. — Essencial.
- **RF-EST-04:** O sistema deve registrar a triagem: quantidade aceita e quantidade descartada, com motivo. Só a aceita entra no saldo. — Essencial.

### G-07 — Consultar lotes, validade, disponibilidade e movimentos

**Frente:** Gabriel. **Execução principal:** G2. **Revisão:** G4. **Estimativa:** a refinar. **Dependências:** G-06.

**Aceite:** Vencido mantém saldo físico, mas fica indisponível; bloquear entrega vencida; sinalizar próximos do vencimento conforme parâmetro aprovado; histórico explica saldo por item/tamanho/unidade.

**Requisitos cobertos (ERS):**

- **RF-EST-05:** O sistema deve mostrar o saldo disponível por item, tamanho e unidade. — Essencial.
- **RF-EST-09:** O sistema deve registrar a validade de itens perecíveis, sinalizar os próximos do vencimento e impedir a entrega dos vencidos. — Essencial.
- **RF-EST-10:** O sistema deve mostrar o histórico de movimentações de cada item, com o saldo após cada uma. — Essencial.

### G-08 — Registrar ajustes, inventário e saldo inicial

**Frente:** Gabriel. **Execução principal:** G3. **Revisão:** G5. **Estimativa:** a refinar. **Dependências:** G-07.

**Aceite:** Contagem exibe diferença sem ajuste automático; confirmar com motivo e revisão; criar saldo inicial por lote/unidade/validade, sem doação fictícia e sem duplicar movimentos importados.

**Requisitos cobertos (ERS):**

- **RF-EST-06:** O sistema deve registrar ajustes por perda, avaria, vencimento ou contagem, sempre com motivo e responsável. — Essencial.
- **RF-EST-07:** O sistema deve registrar contagens físicas e mostrar as diferenças em relação ao saldo do sistema. — Essencial.
- **RF-MIG-06:** O sistema deve registrar o saldo inicial do estoque social a partir de uma contagem física. — Essencial.

### G-09 — Receber e conferir transferências do Bazar

**Frente:** Gabriel. **Execução principal:** G4. **Revisão:** G3. **Estimativa:** a refinar. **Dependências:** G-06, G-07.

**Aceite:** Referência única impede duplicidade concorrente; guardar informado, recebido e divergência; só quantidade efetivamente recebida e aceita fica disponível. Origem Bazar separada da arrecadação externa. Lançamento manual referenciado é a alternativa prevista, se aprovada.

**Requisitos cobertos (ERS):**

- **RF-BAZ-01:** O sistema deve registrar o recebimento de uma transferência do Bazar com a referência, os itens, as quantidades e as unidades informadas. — Essencial.
- **RF-BAZ-02:** O sistema deve registrar a quantidade efetivamente recebida e as diferenças em relação ao informado. Só o recebido entra no saldo. — Essencial.
- **RF-BAZ-03:** O sistema não deve aceitar a mesma referência de transferência duas vezes. — Essencial.
- **RF-BAZ-04:** Os relatórios devem mostrar a origem Bazar separada das doações externas, sem somá-la ao total arrecadado. — Essencial.

### G-10 — Preparar entrega consultando família, necessidades e aptidão

**Frente:** Gabriel. **Execução principal:** G2. **Revisão:** G5. **Estimativa:** a refinar. **Dependências:** PB-04, PB-09, PB-20, G-07.

**Aceite:** Selecionar família/retirante válido na data, itens e quantidades; mostrar avaliação oficial, evidências, necessidades autorizadas, entregas anteriores e saldo; nunca consultar toda ficha para distribuição.

**Requisitos cobertos (ERS):**

- **RF-ENT-01:** O sistema deve registrar a entrega a uma família com data, itens, quantidades, unidades e responsável e, opcionalmente, o membro que retirou. — Essencial.
- **RF-ENT-02:** Ao registrar a entrega, o sistema deve mostrar a aptidão da família com sua evidência, as necessidades declaradas, as entregas anteriores e o saldo dos itens. — Essencial.

### G-11 — Confirmar entrega e baixa atômica, segura contra repetição

**Frente:** Gabriel. **Execução principal:** G2. **Revisão:** G3. **Estimativa:** a refinar. **Dependências:** G-10, G-03, C-03.

**Aceite:** Gravar entrega, atendimento e saída juntos ou nada. Com 5 unidades, confirmar entrega de 2 duas vezes deixa uma entrega e saldo 3. Concorrência não causa saldo negativo; linhas repetidas do lote são agregadas.

**Requisitos cobertos (ERS):**

- **RF-ENT-03:** O sistema deve gravar a entrega como atendimento pontual e como saída do estoque na mesma operação: grava os dois ou nenhum. — Essencial.
- **RF-ENT-04:** O sistema deve impedir a entrega de quantidade maior que o saldo disponível, informando o saldo. — Essencial.
- **RF-ENT-05:** O sistema não deve duplicar uma entrega quando a confirmação for repetida. — Essencial.

### G-12 — Tratar exceções de aptidão na entrega

**Frente:** Gabriel. **Execução principal:** G4. **Revisão:** G5. **Estimativa:** a refinar. **Dependências:** G-10, PB-20.

**Aceite:** Não apta/Pendente exige justificativa e autorizador conforme política validada. Não inventar bloqueio; na confirmação, validar avaliação/revisões e preservar evidências usadas.

**Requisitos cobertos (ERS):**

- **RF-ENT-06:** Para família Não apta ou Pendente, o sistema deve exigir justificativa e identificar quem autorizou. Bloquear a entrega só depois de definida a política. — Essencial.

### G-13 — Estornar entrega lançada por engano

**Frente:** Gabriel. **Execução principal:** G2. **Revisão:** G3. **Estimativa:** a refinar. **Dependências:** G-11.

**Aceite:** Estorno integral recompõe lotes e altera atendimento/entrega juntos; repetição não duplica recomposição; lote vencido retorna ao físico, mas não ao disponível. Preservar motivo e saída original.

**Requisitos cobertos (ERS):**

- **RF-ENT-07:** O sistema deve permitir estornar uma entrega lançada por engano, com motivo, devolvendo as quantidades ao saldo e mantendo o registro original. — Essencial.

### G-14 — Relatórios de estoque e de entregas por família/item

**Frente:** Gabriel. **Execução principal:** G3. **Revisão:** G4. **Estimativa:** a refinar. **Dependências:** G-08, G-09, G-11, G-13.

**Aceite:** Saldo inicial + movimentos = saldo final; Bazar separado; unidades não somadas indevidamente; filtros de período e detalhes dos totais conferem com registros; estornos preservados na conciliação.

**Requisitos cobertos (ERS):**

- **RF-REL-05:** O sistema deve gerar o relatório de estoque por período: saldo inicial, entradas por origem, transferências do Bazar, entregas, ajustes e saldo final. — Essencial.
- **RF-REL-06:** O sistema deve gerar o relatório "quem recebeu o quê": entregas por família e por item no período. — Essencial.

### G-15 — Fornecer atendimentos e entregas ao histórico comum

**Frente:** Gabriel. **Execução principal:** G5. **Revisão:** G3. **Estimativa:** a refinar. **Dependências:** G-05, G-11, G-13.

**Aceite:** C-05 recebe fatos com vínculo histórico e status; entrega ligada ao atendimento não é contada duas vezes; informações sensíveis seguem perfil.

### C-01 — Acordar arquitetura, contratos, decisões e ambiente integrado

**Parcela de execução:** Contratos técnicos, ambiente integrado e responsáveis; Gabriel da equipe Fabricio fornece os contratos CAD.

**Fase:** S1; contrato revisado durante o projeto.

**Frente:** Comum. **Execução principal:** Alan (Fabricio) + G3 (Gabriel). **Revisão:** Fabricio + Gabriel (líder). **Estimativa:** a refinar. **Dependências:** nenhuma.

**Aceite:** Definir IDs comuns, formato de erros, APIs/serviços, dono de cada item comum, branches/migrations e ambiente compartilhado; registrar decisões LAC e evidências de aprovação.

### C-02 — Login, usuários, perfis e proteção de acesso

**Parcela de execução:** Autenticação/perfis no servidor por Alan e sessão/interface por Kauã; G3 aplica o contrato de acesso nos módulos da sua frente.

**Fase:** S1; aplicar perfis em todos os módulos.

**Frente:** Comum. **Execução principal:** Alan + Kauã (Fabricio). **Revisão:** Fabricio; Gabriel (líder) revisa acesso da sua frente. **Estimativa:** a refinar. **Dependências:** C-01.

**Aceite:** Login individual; criar/desativar usuários e atribuir perfis; senhas com hash; autorização no servidor/telas/buscas/relatórios. Desativação não apaga autoria; política de tentativas/sessão validada.

**Requisitos cobertos (ERS):**

- **RF-ACS-01:** O sistema deve exigir login individual com usuário e senha; contas compartilhadas não são permitidas. — Essencial.
- **RF-ACS-02:** O sistema deve permitir ao administrador criar usuários e atribuir um ou mais perfis da seção 2.3. — Essencial.
- **RF-ACS-03:** O sistema deve restringir a ficha social e os dados de saúde e religião aos perfis autorizados. O perfil de frequência vê apenas nome, família e presenças. — Essencial.
- **RF-ACS-06:** O sistema deve permitir desativar usuários sem apagar a autoria dos registros que fizeram. — Essencial.

### C-03 — Auditoria, datas históricas e consistência das operações

**Parcela de execução:** G3 implementa auditoria e repetição comuns; executores de cada módulo aplicam transações e datas históricas.

**Fase:** S1; transações próprias integradas durante o desenvolvimento.

**Frente:** Comum. **Execução principal:** G3. **Revisão:** Gabriel (líder) + Fabricio. **Estimativa:** a refinar. **Dependências:** C-01.

**Aceite:** Mecanismo comum registra antes/depois, autor, motivo e datas do fato/lançamento; conflitos e repetição tratados; cada módulo implementa suas transações usando o contrato. Não conclui sozinho atomicidade de entregas.

**Requisitos cobertos (ERS):**

- **RF-ACS-04:** O sistema deve manter trilha de auditoria de criações, alterações, correções, cancelamentos e unificações: autor, data e hora, valor anterior, valor novo e motivo. — Essencial.
- **RF-ACS-05:** O sistema deve guardar separadamente a data do fato e a data do lançamento, permitindo lançamentos retroativos identificados. — Essencial.

### C-04 — Formalizar e validar integração de aptidão com entregas

**Parcela de execução:** Gabriel da equipe Fabricio produz a avaliação; G2/G4 implementam consumo e exceções; líderes revisam contratos e evidências.

**Fase:** Contrato S1; exemplos S4; avaliação real 18/11; aceite 20/11.

**Frente:** Comum. **Execução principal:** Gabriel (dev da equipe Fabricio) + G2/G4. **Revisão:** Fabricio + Gabriel (líder). **Estimativa:** a refinar. **Dependências:** PB-20, G-11, G-12.

**Aceite:** Contrato já acordado na S1; teste real cobre Apta/Não apta/Pendente, data histórica, evidência alterada e política vigente. A frente de entregas não recalcula aptidão; mock não conclui integração.

### C-05 — Histórico familiar/pessoal consolidado

**Parcela de execução:** Ruan implementa composição/consulta do histórico; Gabriel da equipe Fabricio e G5 fornecem fatos dos módulos.

**Fase:** S6, após PB-23/G-15.

**Frente:** Comum. **Execução principal:** Ruan (Fabricio) + G5. **Revisão:** Fabricio + Gabriel (líder). **Estimativa:** a refinar. **Dependências:** PB-23, G-15.

**Aceite:** Linha do tempo reúne vínculos, ficha autorizada, presenças, atendimentos e entregas; preservar família do fato e não duplicar o mesmo evento; testar acesso por perfil.

**Requisitos cobertos (ERS):**

- **RF-REL-01:** O sistema deve mostrar o histórico da família em ordem cronológica: membros e vínculos, versões da ficha, presenças, atendimentos e entregas, respeitando o perfil de quem consulta. — Essencial.
- **RF-REL-02:** O sistema deve mostrar o histórico de uma pessoa: famílias a que pertenceu, atividades, presenças e atendimentos. — Essencial.

### C-06 — Alcance consolidado e detalhes dos totais

**Parcela de execução:** G3 consolida alcance, G4 fornece dados de estoque/entrega e Alan fornece frequência; totais com detalhamento sem dupla contagem.

**Fase:** S6, após C-05 e relatórios dos módulos.

**Frente:** Comum. **Execução principal:** G3 + G4 + Alan (Fabricio). **Revisão:** Gabriel (líder) + Fabricio. **Estimativa:** a refinar. **Dependências:** C-05, PB-18, PB-21, G-14.

**Aceite:** Pessoas/famílias únicas, encontros, atendimentos e itens/unidades distintos; uma família com duas entregas conta uma família e duas entregas, sem quatro atendimentos. Detalhes respeitam filtros/perfis.

**Requisitos cobertos (ERS):**

- **RF-REL-03:** O sistema deve gerar o relatório de alcance por período: pessoas únicas, famílias únicas, encontros realizados, atendimentos por tipo, entregas e quantidades por item e unidade. — Essencial.
- **RF-REL-07:** Todo total exibido deve permitir abrir a lista dos registros que o compõem. — Essencial.

### C-07 — Mapear exportação do Bússola e planejar corte

**Parcela de execução:** Executores obtêm/mapeiam fonte e plano de corte com responsáveis institucionais; líderes apenas revisam o plano.

**Fase:** S2, fonte/mapeamento/corte.

**Frente:** Comum. **Execução principal:** Ruan (Fabricio) + G4. **Revisão:** Fabricio + Gabriel (líder). **Estimativa:** a refinar. **Dependências:** C-01.

**Aceite:** Obter amostra e formato, identificar IDs estáveis, históricos necessários, data de corte e plano de continuidade; registrar indisponibilidades. Não presumir arquivo ou esquema de exportação.

### C-08 — Importar cadastros e históricos com conferência

**Parcela de execução:** Gabriel da equipe Fabricio implementa CAD/FIC/FRQ, com Alan nas adaptações FRQ; G3/G4 implementam ATD/EST/ENT. Operação não contorna permissões.

**Fase:** S3–S5 construção; S6 conferência.

**Frente:** Comum. **Execução principal:** Gabriel (dev da equipe Fabricio) + G3/G4. **Revisão:** Fabricio + Gabriel (líder). **Estimativa:** a refinar. **Dependências:** C-07, PB-06, PB-10, PB-17, G-05, G-11, G-08.

**Aceite:** Importar cadastros antes de fatos; origem/data/IDs preservados; reexecução não duplica; erros listados; contagens origem/destino conciliadas; saldo inicial não duplica histórico. Requer fonte e regras resolvidas até fim da S2; sem isso, registrar bloqueio e renegociar, não declarar migração pronta.

**Requisitos cobertos (ERS):**

- **RF-MIG-01:** O sistema deve importar famílias, pessoas e vínculos a partir dos arquivos exportados do Bússola Social. — Essencial.
- **RF-MIG-02:** O sistema deve importar os históricos definidos como necessários em LAC-11. — Essencial.
- **RF-MIG-03:** O sistema deve gerar relatório de conferência: contagens por tipo e período na origem e no ERP, e registros rejeitados com motivo. — Essencial.
- **RF-MIG-04:** O sistema deve marcar cada registro importado com a origem e a data da importação. — Essencial.
- **RF-MIG-05:** O sistema deve permitir repetir a importação sem duplicar registros já importados. — Essencial.

### C-09 — Operação: implantação, backup, restauração e contingência

**Parcela de execução:** G5 implementa/ensaia operação, implantação, backup/restauração e contingência; Kauã valida e corrige seu recorte. Líderes revisam resultados, sem executar infraestrutura.

**Fase:** S1–S5 controles/backup; S6 restauração/manual.

**Frente:** Comum. **Execução principal:** G5 + Kauã (Fabricio). **Revisão:** Gabriel (líder) + Fabricio. **Estimativa:** a refinar. **Dependências:** C-01, C-02.

**Aceite:** Ambiente já disponível S1; concluir HTTPS, backups protegidos, restauração ensaiada, contingência em papel e manual operacional. Validar disponibilidade, guarda e responsáveis antes de produção.

### C-10 — Homologação integrada, correções, capacitação e entrega final

**Parcela de execução:** Oito executores corrigem, demonstram, documentam e preparam a versão. Líderes revisam; representante institucional aceita negócio.

**Fase:** S7.

**Frente:** Comum. **Execução principal:** Gabriel/Ruan/Alan/Kauã (Fabricio) + G2–G5. **Revisão:** Fabricio + Gabriel (líder). **Estimativa:** a refinar. **Dependências:** C-04, C-05, C-06, C-08, C-09, G-13.

**Aceite:** Demonstrar jornadas e critérios AC aplicáveis, inclusive concorrência e negação de acesso; corrigir bloqueadores; registrar aceite, pendências, manutenção e instruções. Se C-08 bloqueado, aceite acadêmico deve explicitar migração pendente e não autoriza encerrar Bússola.

### F-R01 — Conciliar e implementar unificação/qualidade cadastral se mantida

**Equipe:** Fabricio. **Responsável principal:** Gabriel (dev da equipe Fabricio). **Apoio/revisor:** Fabricio. **Estimativa:** a refinar. **Dependências:** C-01.

**Aceite:** Decisão na S1: PRD remove central, não elimina por si toda unificação; obter SPEC-CAD. Se mantido, estimar e alocar formalmente; histórico não é apagado.

**Requisitos cobertos (ERS):**

- **RF-CAD-07:** O sistema deve permitir que um usuário autorizado unifique dois cadastros duplicados, levando todo o histórico e registrando quem unificou e por quê. — Essencial.
- **RF-REL-09:** O sistema deve listar cadastros com possível duplicidade ou dados ausentes, com data de identificação e de resolução. — Essencial.

### F-R02 — Renda total e per capita

**Equipe:** Fabricio. **Responsável principal:** Ruan. **Apoio/revisor:** Gabriel (dev da equipe Fabricio). **Estimativa:** a refinar. **Dependências:** C-01.

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

### G-R01 — Agendamento de atendimentos

**Frente:** Gabriel. **Execução principal:** G2. **Revisão:** Gabriel (líder, somente revisão). **Estimativa:** a refinar. **Dependências:** C-01.

**Aceite:** Agendar não conta como atendimento realizado.

**Requisitos cobertos (ERS):**

- **RF-ATD-09:** O sistema deve agendar atendimentos. Agendamento não conta como atendimento realizado. — Desejável.

### G-R02 — Consolidação por doador/campanha com valor estimado

**Frente:** Gabriel. **Execução principal:** G3. **Revisão:** Gabriel (líder, somente revisão). **Estimativa:** a refinar. **Dependências:** C-01.

**Aceite:** Método aprovado em LAC-09; Bazar separado e sem financeiro comercial.

**Requisitos cobertos (ERS):**

- **RF-EST-11:** O sistema deve consolidar entradas por doador ou campanha, em quantidade e em valor estimado. — Desejável.

### G-R03 — Compatibilidade por tamanho

**Frente:** Gabriel. **Execução principal:** G5. **Revisão:** Gabriel (líder, somente revisão). **Estimativa:** a refinar. **Dependências:** C-01.

**Aceite:** Mostrar compatíveis e dados desconhecidos separadamente; nada entregue automaticamente.

**Requisitos cobertos (ERS):**

- **RF-ENT-08:** O sistema deve listar famílias com membros compatíveis com um item, como calçado nº 39, separando os membros sem numeração informada. — Desejável.

### G-R04 — Prioridade, limites e intervalos de entrega

**Frente:** Gabriel. **Execução principal:** G4. **Revisão:** Gabriel (líder, somente revisão). **Estimativa:** a refinar. **Dependências:** C-01.

**Aceite:** Aplicar apenas política aprovada em LAC-03; sem valores inventados.

**Requisitos cobertos (ERS):**

- **RF-ENT-09:** O sistema deve aplicar prioridade, limite por família e intervalo mínimo entre entregas. — Desejável.

### C-R01 — Exportar relatórios em CSV e PDF

**Frente:** Comum. **Execução principal:** G5 + Ruan (Fabricio). **Revisão:** Fabricio + Gabriel (líder). **Estimativa:** a refinar. **Dependências:** C-01.

**Aceite:** Mesmos filtros e permissões das telas.

**Requisitos cobertos (ERS):**

- **RF-REL-10:** O sistema deve exportar relatórios em planilha (CSV) e em PDF. — Desejável.

### C-R02 — Auditar consulta à ficha e dados sensíveis

**Frente:** Comum. **Execução principal:** Alan (Fabricio) + G3. **Revisão:** Fabricio + Gabriel (líder). **Estimativa:** a refinar. **Dependências:** C-01.

**Aceite:** Registrar quem consultou e quando; proteger o próprio registro.

**Requisitos cobertos (ERS):**

- **RF-ACS-07:** O sistema deve registrar quem consultou fichas sociais e dados sensíveis, e quando. — Desejável.

## Critérios de conclusão e acompanhamento

Cada tarefa de execução exige a entrega indicada, teste apropriado e revisão por outra pessoa. Cada tarefa do líder exige parecer com PRs/evidências analisados, resultado e pendências; o líder não escreve a correção nem produz o artefato que deveria revisar. Se dois executores colaborarem no código, revisão é de um terceiro ou do líder. Todos os desenvolvedores testam/corrigem seus módulos; qualidade não pertence a um único integrante.

Cada cartão PB/G/C exige todo o aceite do Product Backlog. Um item com partes prontas não é concluído antes da integração exigida; tarefas TF/TG não duplicam pontos do pai. Cancelamentos/estornos são auditados; totais distinguem pessoas/famílias/ocorrências/unidades. Entrega e estorno são atômicos, repetição segura e saldo não negativo. Dados ausentes não viram zero/falso/ausência/Não apta. Autorização vale para tela, API, busca, relatório e exportação; chamada/entrega utilizáveis no celular.

Migração real exige arquivo de origem e conferência; ensaio sintético não conclui AC-12/13 nem autoriza encerrar Bússola. Não guardar prontuário. Critérios numéricos da ERS continuam propostas a validar com volumes/ambiente. F-R01 é essencial em conciliação; se mantido, estimar e selecionar formalmente. Desejáveis F-R02–06, G-R01–04 e C-R01–02 continuam no backlog, sem compromisso automático no prazo.

Planejar cada sprint/ciclo com capacidade real; descontar ausências/feriados. Acompanhamento breve e registro de bloqueios por responsável; revisão/demonstração em cada encerramento. Nos ciclos curtos 5a/5b, tarefas devem estar decompostas antes de 16/11. O planejamento não presume que tarefas anteriores à data de hoje já foram realizadas. O escopo mínimo e o prazo precisam de negociação explícita se algum essencial não couber.


## Requisitos transversais e restrições — cobertura integral

As propostas numéricas da ERS continuam propostas a validar, não decisões institucionais já aprovadas. Esta seção é critério de conclusão dos cartões relacionados, não trabalho adicional oculto. RN/regras e AC são aplicados conforme as referências e os cenários abaixo.

| ID | Conteúdo da ERS | Responsabilidade de aplicação |
|---|---|---|
| IU-01 | A interface deve estar em português do Brasil e usar os termos da instituição: família, assistido, encontro, entrega. — P — Essencial | C-10 + cada equipe em seus módulos |
| IU-02 | Datas devem aparecer como dd/mm/aaaa e valores em reais (R$). — P — Essencial | C-10 + cada equipe em seus módulos |
| IU-03 | Toda tela de registro deve permitir buscar pessoa ou família por nome, número da família, data de nascimento ou CPF. — P \[CAP-01\] — Essencial | C-10 + cada equipe em seus módulos |
| IU-04 | A chamada de um encontro deve ser feita em uma única tela, com a lista de participantes e marcação rápida de presença. — P — Essencial | C-10 + cada equipe em seus módulos |
| IU-05 | As telas de chamada e de entrega devem funcionar em celular. — P; LAC-10 — Essencial | C-10 + cada equipe em seus módulos |
| IU-06 | Toda mensagem de bloqueio deve explicar o motivo e o que fazer. Ex.: "Saldo disponível: 3 pares". — P \[AC-06\] — Essencial | C-10 + cada equipe em seus módulos |
| IU-07 | Dados ausentes e situações pendentes devem aparecer destacados, nunca como zero, "não" ou "inapta". — P \[RN-14; AC-03\] — Essencial | C-10 + cada equipe em seus módulos |
| INT-01 | O sistema deve receber transferências do Bazar com referência, itens, quantidades e unidades. A forma, integração automática ou lançamento manual com a referência, depende de LAC-07. — C \[F1, §14\] — Essencial | G-09 |
| INT-02 | O sistema deve importar os arquivos exportados do Bússola Social, no formato que ele disponibilizar. — C \[F6\]; LAC-11 — Essencial | C-07/C-08 |
| INT-03 | Não há integração com o CRM nesta versão. — C \[F1, §§7–12\] — — | C-01: limite de escopo |
| INT-04 | Todo acesso ao sistema pela rede deve usar canal cifrado. — P \[F8, 4.2\] — Essencial | C-09/C-10 |
| RNF-DES-01 | Busca de pessoa ou família — Resposta em até 2 s em 95% das buscas — P; LAC-10 | C-10 + cada equipe em seus módulos |
| RNF-DES-02 | Gravação de presença, atendimento ou entrega — Confirmação em até 2 s em 95% das operações — P; LAC-10 | C-10 + cada equipe em seus módulos |
| RNF-DES-03 | Relatório cobrindo 12 meses de registros — Geração em até 10 s — P; LAC-10 | C-10 + cada equipe em seus módulos |
| RNF-DES-04 | Uso simultâneo — Todos os operadores cadastrados ao mesmo tempo, sem perda nem duplicação de dados — P; LAC-10 | C-10 + cada equipe em seus módulos |
| RNF-DES-05 | Crescimento — Manter os tempos acima com o dobro do volume levantado — P; LAC-10 | C-10 + cada equipe em seus módulos |
| RES-01 | Dados de saúde e de convicção religiosa são dados pessoais sensíveis. Finalidade, acesso e guarda devem estar definidos antes do uso com dados reais. — LGPD arts. 5º, II, e 11 \[F8, 4.2\]; LAC-08 | C-02/C-09 + responsáveis de cada módulo |
| RES-02 | Dados de crianças e adolescentes só podem ser tratados no melhor interesse deles, expondo o mínimo necessário. — LGPD art. 14; ECA arts. 17 e 18 \[F8, 4.2 e 4.3\] | C-02/C-09 + responsáveis de cada módulo |
| RES-03 | O sistema deve adotar medidas técnicas e administrativas de segurança adequadas. O mecanismo fica para os ADRs. — LGPD art. 46 \[F8, 4.2\] | C-02/C-09 + responsáveis de cada módulo |
| RES-04 | A LOAS e a NOB/SUAS não podem virar formulário obrigatório nem classificação automática de vulnerabilidade. — \[F8, 4.1 e 4.4\] | C-10 + cada equipe em seus módulos |
| RES-05 | O sistema não armazena diagnóstico, prescrição nem prontuário. — PRD 3.4 | C-10 + cada equipe em seus módulos |
| RES-06 | Nenhuma política em aberto pode ser fixada no código: ela vira parâmetro ou fica bloqueada até a decisão. — PRD 9.2 | C-10 + cada equipe em seus módulos |
| RES-07 | A instituição deve conseguir operar e manter o sistema após a entrega acadêmica, com custo compatível. — \[F7, 7.1\]; LAC-10 | C-09/C-10 |
| RNF-CON-01 | Operações compostas (entrega, estorno, unificação de cadastros, transferência do Bazar) gravam tudo ou nada. — P \[RN-10\] | G-09/G-11/G-13; F-R01 se mantido |
| RNF-CON-02 | O sistema faz cópia de segurança automática pelo menos diária, guardada fora do servidor principal. — P; valor proposto | C-09/C-10 |
| RNF-CON-03 | A restauração do backup é testada antes do piloto e a cada 6 meses. A perda máxima aceitável é de 24 horas de registros. — P; valor proposto | C-09/C-10 |
| RNF-CON-04 | O saldo recalculado a partir das movimentações é sempre igual ao saldo exibido. — P \[RN-16\] | G-07/G-08/G-14 |
| RNF-DIS-01 | O sistema fica disponível nos horários de funcionamento da instituição, ainda não levantados. — P; LAC-10 | C-09/C-10 |
| RNF-DIS-02 | Existe procedimento de contingência em papel, com lançamento posterior identificado pela data do fato (RF-ACS-05). — P \[PRD 7.3\] | C-09/C-10 |
| RNF-SEG-01 | Senhas são guardadas apenas como hash com algoritmo próprio para senhas, nunca em texto. — P | C-02/C-09 + responsáveis de cada módulo |
| RNF-SEG-02 | O login é bloqueado temporariamente após 5 tentativas seguidas sem sucesso. — P; valor proposto | C-02/C-09 + responsáveis de cada módulo |
| RNF-SEG-03 | A sessão é encerrada após 30 minutos sem uso. — P; valor proposto | C-02/C-09 + responsáveis de cada módulo |
| RNF-SEG-04 | Perfis sem permissão não recebem dados restritos em nenhuma saída: telas, relatórios, exportações ou buscas. — P \[RN-15\] | C-02/C-09 + responsáveis de cada módulo |
| RNF-SEG-05 | Dados sensíveis têm proteção reforçada, com mecanismo definido em ADR. — P; LAC-08 | C-02/C-09 + responsáveis de cada módulo |
| RNF-SEG-06 | Cópias de segurança e exportações têm o mesmo controle de acesso dos dados originais. — P \[F8, 4.2\] | C-02/C-09 + responsáveis de cada módulo |
| RNF-MAN-01 | Parâmetros de negócio são configuráveis sem alterar código: critério de aptidão, tipos de atendimento, categorias, unidades e motivos de ajuste. — P \[RES-06\] | C-10 + cada equipe em seus módulos |
| RNF-MAN-02 | O código-fonte fica versionado em repositório acessível à instituição. — P \[F7, 7.1\] | C-10 + cada equipe em seus módulos |
| RNF-MAN-03 | O sistema é entregue com documentação de instalação, backup, restauração e administração de usuários. — P \[F8, 3.1\] | C-09/C-10 |
| RNF-MAN-04 | Testes automatizados cobrem as regras RN-10, RN-13 e RN-17. — P | C-10 + cada equipe em seus módulos |
| RNF-USA-01 | O sistema funciona nas versões atuais dos principais navegadores de computador e celular. — P; LAC-10 | C-10 + cada equipe em seus módulos |
| RNF-USA-02 | Um operador capacitado registra uma chamada e uma entrega sem ajuda, verificado no piloto. — P \[PRD 7.3\] | C-10 + cada equipe em seus módulos |
| RNF-USA-03 | As telas de aptidão e de entrega explicam o critério vigente em linguagem simples. — P \[RN-13\] | C-10 + cada equipe em seus módulos |

## Rastreabilidade da versão anterior

| ID anterior | Destino atual |
|---|---|
| PB-01 | C-01 |
| PB-02 | C-02/C-03 e operação em C-09 |
| PB-03 a PB-21 | IDs mantidos na equipe Fabricio; datas replanejadas |
| PB-22 | C-04 |
| PB-23 | Mantido como fornecimento CAD/FIC/FRQ; consolidação em C-05 |
| PB-24 | C-10 |
| R-01 a R-06 | F-R01 a F-R06 |
| R-07 | C-R01 |
| R-08 | C-07/C-08; saldo inicial em G-08 |

## Mapa dos 101 RF

| Requisito | Cartão único responsável | Frente | Tratamento |
|---|---|---|---|
| RF-CAD-01 | PB-03 | Fabricio | Essencial |
| RF-CAD-02 | PB-04 | Fabricio | Essencial |
| RF-CAD-03 | PB-04 | Fabricio | Essencial |
| RF-CAD-04 | PB-06 | Fabricio | Essencial |
| RF-CAD-05 | PB-06 | Fabricio | Essencial |
| RF-CAD-06 | PB-05 | Fabricio | Essencial |
| RF-CAD-07 | F-R01 | Fabricio | Essencial em conciliação |
| RF-CAD-08 | PB-04 | Fabricio | Essencial |
| RF-CAD-09 | PB-06 | Fabricio | Essencial |
| RF-CAD-10 | PB-07 | Fabricio | Essencial |
| RF-CAD-11 | PB-04 | Fabricio | Essencial |
| RF-FIC-01 | PB-08 | Fabricio | Essencial |
| RF-FIC-02 | PB-08 | Fabricio | Essencial |
| RF-FIC-03 | F-R02 | Fabricio | Desejável |
| RF-FIC-04 | PB-09 | Fabricio | Essencial |
| RF-FIC-05 | PB-09 | Fabricio | Essencial |
| RF-FIC-06 | PB-11 | Fabricio | Essencial condicionado |
| RF-FIC-07 | PB-09 | Fabricio | Essencial |
| RF-FIC-08 | PB-10 | Fabricio | Essencial condicionado |
| RF-FIC-09 | PB-10 | Fabricio | Essencial condicionado |
| RF-FIC-10 | F-R03 | Fabricio | Desejável |
| RF-ATV-01 | PB-12 | Fabricio | Essencial |
| RF-ATV-02 | PB-12 | Fabricio | Essencial |
| RF-ATV-03 | PB-13 | Fabricio | Essencial |
| RF-ATV-04 | PB-13 | Fabricio | Essencial |
| RF-ATV-05 | PB-13 | Fabricio | Essencial |
| RF-ATV-06 | PB-13 | Fabricio | Essencial |
| RF-ATV-07 | PB-14 | Fabricio | Essencial |
| RF-ATV-08 | PB-13 | Fabricio | Essencial |
| RF-ATV-09 | F-R04 | Fabricio | Desejável |
| RF-FRQ-01 | PB-15 | Fabricio | Essencial |
| RF-FRQ-02 | PB-15 | Fabricio | Essencial |
| RF-FRQ-03 | PB-16 | Fabricio | Essencial |
| RF-FRQ-04 | PB-17 | Fabricio | Essencial |
| RF-FRQ-05 | F-R05 | Fabricio | Desejável |
| RF-FRQ-06 | PB-18 | Fabricio | Essencial |
| RF-FRQ-07 | PB-17 | Fabricio | Essencial |
| RF-FRQ-08 | F-R06 | Fabricio | Desejável |
| RF-APT-01 | PB-20 | Fabricio | Essencial |
| RF-APT-02 | PB-19 | Fabricio | Essencial condicionado |
| RF-APT-03 | PB-19 | Fabricio | Essencial condicionado |
| RF-APT-04 | PB-20 | Fabricio | Essencial |
| RF-APT-05 | PB-20 | Fabricio | Essencial |
| RF-APT-06 | PB-20 | Fabricio | Essencial |
| RF-APT-07 | PB-21 | Fabricio | Essencial |
| RF-ATD-01 | G-03 | Gabriel | Essencial |
| RF-ATD-02 | G-03 | Gabriel | Essencial |
| RF-ATD-03 | G-03 | Gabriel | Essencial |
| RF-ATD-04 | G-03 | Gabriel | Essencial |
| RF-ATD-05 | G-03 | Gabriel | Essencial |
| RF-ATD-06 | G-04 | Gabriel | Essencial condicionado |
| RF-ATD-07 | G-05 | Gabriel | Essencial |
| RF-ATD-08 | G-03 | Gabriel | Essencial |
| RF-ATD-09 | G-R01 | Gabriel | Desejável |
| RF-EST-01 | G-01 | Gabriel | Essencial |
| RF-EST-02 | G-02 | Gabriel | Essencial |
| RF-EST-03 | G-06 | Gabriel | Essencial |
| RF-EST-04 | G-06 | Gabriel | Essencial |
| RF-EST-05 | G-07 | Gabriel | Essencial |
| RF-EST-06 | G-08 | Gabriel | Essencial |
| RF-EST-07 | G-08 | Gabriel | Essencial |
| RF-EST-08 | G-01 | Gabriel | Essencial |
| RF-EST-09 | G-07 | Gabriel | Essencial |
| RF-EST-10 | G-07 | Gabriel | Essencial |
| RF-EST-11 | G-R02 | Gabriel | Desejável |
| RF-ENT-01 | G-10 | Gabriel | Essencial |
| RF-ENT-02 | G-10 | Gabriel | Essencial |
| RF-ENT-03 | G-11 | Gabriel | Essencial |
| RF-ENT-04 | G-11 | Gabriel | Essencial |
| RF-ENT-05 | G-11 | Gabriel | Essencial |
| RF-ENT-06 | G-12 | Gabriel | Essencial condicionado |
| RF-ENT-07 | G-13 | Gabriel | Essencial |
| RF-ENT-08 | G-R03 | Gabriel | Desejável |
| RF-ENT-09 | G-R04 | Gabriel | Desejável |
| RF-BAZ-01 | G-09 | Gabriel | Essencial condicionado |
| RF-BAZ-02 | G-09 | Gabriel | Essencial condicionado |
| RF-BAZ-03 | G-09 | Gabriel | Essencial condicionado |
| RF-BAZ-04 | G-09 | Gabriel | Essencial condicionado |
| RF-REL-01 | C-05 | Comum | Essencial |
| RF-REL-02 | C-05 | Comum | Essencial |
| RF-REL-03 | C-06 | Comum | Essencial |
| RF-REL-04 | PB-18 | Fabricio | Essencial |
| RF-REL-05 | G-14 | Gabriel | Essencial |
| RF-REL-06 | G-14 | Gabriel | Essencial |
| RF-REL-07 | C-06 | Comum | Essencial |
| RF-REL-08 | PB-21 | Fabricio | Essencial |
| RF-REL-09 | F-R01 | Fabricio | Essencial em conciliação |
| RF-REL-10 | C-R01 | Comum | Desejável |
| RF-ACS-01 | C-02 | Comum | Essencial |
| RF-ACS-02 | C-02 | Comum | Essencial |
| RF-ACS-03 | C-02 | Comum | Essencial |
| RF-ACS-04 | C-03 | Comum | Essencial |
| RF-ACS-05 | C-03 | Comum | Essencial |
| RF-ACS-06 | C-02 | Comum | Essencial |
| RF-ACS-07 | C-R02 | Comum | Desejável |
| RF-MIG-01 | C-08 | Comum | Essencial condicionado |
| RF-MIG-02 | C-08 | Comum | Essencial condicionado |
| RF-MIG-03 | C-08 | Comum | Essencial condicionado |
| RF-MIG-04 | C-08 | Comum | Essencial condicionado |
| RF-MIG-05 | C-08 | Comum | Essencial condicionado |
| RF-MIG-06 | G-08 | Gabriel | Essencial |

## Atualização do planejamento para sete sprints

As duas sprints quinzenais foram desdobradas em quatro semanais, mantendo o prazo de 04/12/2026. A numeração e a seleção atualizadas estão no Sprint Planning correspondente. Os 57 cartões e a cobertura dos 101 RF são preservados; as 35 tarefas TF detalham o trabalho da equipe Fabricio, sem duplicar escopo ou estimativas.
