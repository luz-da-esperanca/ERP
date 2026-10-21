# Product Backlog — Equipe Gabriel

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

CPF obrigatório, válido e único, desde a criação de pessoas em S1. Busca preventiva/experiência de erro são completadas em PB-05/S2. Sem central de duplicidades conforme o PRD atualizado; F-R01 mantém a conciliação de RF-CAD-07/RF-REL-09 com a SPEC-CAD não anexada. Saúde/religião e uso de dados reais dependem das decisões institucionais; enquanto pendentes, dados sintéticos e campos bloqueados. Aptidão sem política/evidência suficiente é Pendente. Migração continua essencial, condicionada à fonte e conferência; não é silenciosamente removida por falta de exportação.

## Lista priorizada e responsáveis

Os itens são priorizados por dependências habilitadoras, ciclo essencial e depois desejáveis. Estimativas a refinar; as fases são previsão, não evidência de conclusão. Itens comuns são contados uma vez no geral e executados nas parcelas TF/TG de cada equipe.

| ID | Entrega | Natureza/prioridade | Execução principal | Apoio/revisão | Fase/meta | Referências |
|---|---|---|---|---|---|---|
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
| G-R01 | Agendamento de atendimentos | Desejável | G2 | Gabriel (líder, somente revisão) | Reserva | RF-ATD-09 |
| G-R02 | Consolidação por doador/campanha com valor estimado | Desejável | G3 | Gabriel (líder, somente revisão) | Reserva | RF-EST-11 |
| G-R03 | Compatibilidade por tamanho | Desejável | G5 | Gabriel (líder, somente revisão) | Reserva | RF-ENT-08 |
| G-R04 | Prioridade, limites e intervalos de entrega | Desejável | G4 | Gabriel (líder, somente revisão) | Reserva | RF-ENT-09 |

## Detalhamento e critérios de aceite

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

## Critérios de conclusão e acompanhamento

Cada tarefa de execução exige a entrega indicada, teste apropriado e revisão por outra pessoa. Cada tarefa do líder exige parecer com PRs/evidências analisados, resultado e pendências; o líder não escreve a correção nem produz o artefato que deveria revisar. Se dois executores colaborarem no código, revisão é de um terceiro ou do líder. Todos os desenvolvedores testam/corrigem seus módulos; qualidade não pertence a um único integrante.

Cada cartão PB/G/C exige todo o aceite do Product Backlog. Um item com partes prontas não é concluído antes da integração exigida; tarefas TF/TG não duplicam pontos do pai. Cancelamentos/estornos são auditados; totais distinguem pessoas/famílias/ocorrências/unidades. Entrega e estorno são atômicos, repetição segura e saldo não negativo. Dados ausentes não viram zero/falso/ausência/Não apta. Autorização vale para tela, API, busca, relatório e exportação; chamada/entrega utilizáveis no celular.

Migração real exige arquivo de origem e conferência; ensaio sintético não conclui AC-12/13 nem autoriza encerrar Bússola. Não guardar prontuário. Critérios numéricos da ERS continuam propostas a validar com volumes/ambiente. F-R01 é essencial em conciliação; se mantido, estimar e selecionar formalmente. Desejáveis F-R02–06, G-R01–04 e C-R01–02 continuam no backlog, sem compromisso automático no prazo.

Planejar cada sprint/ciclo com capacidade real; descontar ausências/feriados. Acompanhamento breve e registro de bloqueios por responsável; revisão/demonstração em cada encerramento. Nos ciclos curtos 5a/5b, tarefas devem estar decompostas antes de 16/11. O planejamento não presume que tarefas anteriores à data de hoje já foram realizadas. O escopo mínimo e o prazo precisam de negociação explícita se algum essencial não couber.

