Pesquisa documental de sistemas para
organizações sociais
*Subsídio ao dossiê do ERP Social Luz da Esperança*

**Versão: 1.0 • Data da pesquisa: 18 de setembro de 2026**
**Recorte: oito soluções indicadas pela equipe, com análise orientada ao negócio.**

## 1 Problema e finalidade da pesquisa
A Luz da Esperança utiliza atualmente o Bússola Social, uma solução paga que será substituída por um sistema
próprio, conforme esclarecimento da equipe responsável pelo projeto. O desafio de negócio é realizar essa
substituição preservando a continuidade do atendimento e organizando as informações necessárias para
acompanhar famílias, atividades, atendimentos e distribuição de doações. O valor do contrato atual, as funções
efetivamente utilizadas e as condições de exportação dos dados ainda precisam ser levantados. [I1–I3]
Esta pesquisa identifica como outras soluções tratam problemas semelhantes e quais práticas podem contribuir
para o produto. Seu resultado alimenta o dossiê do problema e a fundamentação do PRD. A transformação
dessas referências em requisitos depende da necessidade da instituição e da validação dos responsáveis pelo
negócio.
O levantamento encontrou soluções com focos diferentes: contabilidade, captação de recursos,
relacionamento com doadores, gestão administrativa e acompanhamento social. Por isso, o rótulo “ERP para
instituições de caridade” é insuficiente para comparar todos os produtos da lista. Uma plataforma pode
controlar doações financeiras sem controlar a entrega de alimentos; pode administrar projetos sem registrar
presença em oficinas.
**Questão orientadora:** quais capacidades documentadas nesses sistemas ajudam a organizar o trabalho social
da Luz da Esperança e quais pontos exigem uma definição própria de negócio?

## 2 Método e limites
A amostra foi definida pela equipe: Blackbaud Financial Edge NXT + Raiser’s Edge NXT, ERPNext + Non Profit,
Salesforce Nonprofit Cloud, DotCompany, ONGFácil, Ongsys, Gestão Doar e CiviCRM. Os dois produtos
Blackbaud foram analisados conjuntamente, conforme a indicação recebida.
Foram consultadas páginas oficiais de produtos e documentação dos respectivos fornecedores ou
comunidades. As referências externas, com links e data de acesso, estão na seção 9. O contexto local vem da
transcrição, da ficha de cadastro e dos esclarecimentos da equipe. Não foram realizados testes práticos,
entrevistas comerciais ou verificação de contratos.
Critério de evidência: uma funcionalidade é considerada documentada quando a fonte oficial a descreve
expressamente. Isso registra a declaração do fornecedor; não certifica seu funcionamento nem sua adequação
à instituição. “Não evidenciado” significa que o recurso não foi identificado nas fontes consultadas, sem afirmar
que ele inexiste.

As análises de contribuição ao ERP próprio são interpretações desta pesquisa. Não se atribuem ao Bússola
Social falhas não relatadas, nem se estima economia sem conhecer os custos atuais e futuros. A pesquisa não
constitui ranking, recomendação de contratação ou análise jurídica. O CiviCRM foi mantido na amostra, mas
classificado entre as referências internacionais: trata-se de um CRM de código aberto, e não de um ERP
brasileiro. [S14–S16]

## 3 Necessidades de negócio usadas na comparação
Os critérios abaixo traduzem o contexto da instituição. Eles ajudam a distinguir a semelhança de nomes de
módulos da correspondência com o trabalho real. [I1–I3]

`Critério             Necessidade da Luz da Esperança`

`Relacionar cada pessoa à família e reunir informações da ficha sobre composição familiar,`
Família e pessoas assistidas
`renda, moradia e necessidades.`

`Projetos, atividades e         Acompanhar participação em atividades periódicas, preservando o histórico individual e`
`frequência                     sua relação com a família.`

`Registrar ocorrências de atendimento e ações realizadas, distinguindo-as da presença em`
Atendimentos pontuais
`atividades recorrentes.`

`Doações materiais e            Saber quais itens entraram, o que está disponível, o que foi entregue, a quem, quando e`
`estoque                        em qual quantidade.`

`Elegibilidade e decisão de     Representar a relação relatada entre participação de membro da família e possibilidade`
`atendimento                    de receber doações. Separar elegibilidade, prioridade e entrega efetiva.`

`Identificar itens transferidos do Bazar para o social e distinguir atendimento, captação`
Fronteiras entre operações
`financeira e venda comercial.`

Histórico e
`Recuperar registros que permitam explicar o atendimento, acompanhar resultados e`
acompanhamento da
`sustentar relatórios.`
gestão

`Planejar a transição do Bússola Social, a preservação dos dados e a responsabilidade pela`
Continuidade e autonomia
`manutenção do sistema próprio.`

A ficha de cadastro é evidência do processo atual, não uma determinação automática de que todos os seus
campos devem ser obrigatórios no sistema. Da mesma forma, ainda não existe, nas informações disponíveis,
um percentual ou período fechado para a regra de frequência associada às doações. Esses critérios precisam
ser definidos pela instituição. [I1–I3]

## 4 Soluções internacionais
### 4.1 Blackbaud — Financial Edge NXT + Raiser’s Edge NXT
**Classificação e foco.** Combinação de gestão financeira e contábil com CRM de captação para organizações sem
fins lucrativos. O Financial Edge NXT documenta acompanhamento de fundos com destinação específica,
projetos e controles financeiros. O Raiser’s Edge NXT concentra dados de doadores, campanhas, contribuições
e relacionamento. O fornecedor apresenta integração entre os dois produtos. [S1–S2]

**Contribuição ao projeto.** A separação entre relacionamento com doadores e aplicação dos recursos ajuda a
pensar as fronteiras entre CRM, Bazar e ERP Social. A prática relevante é permitir acompanhar a origem e o uso
dos recursos sem misturar responsabilidades de negócio.
**Limites da evidência.** As páginas consultadas não demonstram o fluxo específico de cadastro socioeconômico
familiar, presença em atividades e entrega de itens condicionado às regras da Luz da Esperança. Gestão de
doadores não comprova gestão de famílias assistidas.
**Condições a verificar.** Escopo dos produtos, implantação e preços exigem consulta comercial. A existência de
integração anunciada não comprova a compatibilidade com outros sistemas do projeto. Para esta pesquisa, a
dupla é sobretudo uma referência de captação, finanças e rastreabilidade. [S1–S2]

### 4.2 ERPNext + Non Profit
**Classificação e foco.** ERP de código aberto com contabilidade, compras, vendas, projetos e estoque. Sua
documentação de estoque distingue recebimento, saída e transferência de materiais. O aplicativo Non Profit foi
concebido para informações de doadores, membros, doações, programas e outras rotinas de organizações sem
fins lucrativos. [S3–S5]
**Situação do complemento.** A documentação atual informa que o Non Profit é instalado separadamente, tem
repositório arquivado e pode não ser compatível com versões recentes. O marketplace ainda o apresenta com
versões suportadas. Essa divergência exige verificação antes de qualquer adoção: a combinação não deve ser
descrita como um pacote atual pronto para implantação. [S4, S6]
**Contribuição ao projeto.** Os movimentos de estoque oferecem uma referência para distinguir entrada de
doação, transferência Bazar → social e saída por entrega. Essa associação é uma interpretação para o contexto
local; a documentação de estoque não comprova uma regra de elegibilidade familiar.
**Condições a verificar.** Código aberto amplia possibilidades de adaptação, mas não elimina trabalho de
implantação, hospedagem, suporte e atualização. A pesquisa sustenta estudar seus conceitos de operação; a
escolha de utilizá-lo como base seria uma decisão posterior, com avaliação específica de manutenção. [S3–S6]

### 4.3 Salesforce — Nonprofit Cloud
**Classificação e foco.** Plataforma de CRM e gestão para organizações sem fins lucrativos. Além de captação, a
oferta documenta programas e serviços, inscrição de participantes, sessões, presença, acompanhamento de
casos e indicadores de resultados. Esses recursos ampliam seu interesse para além do relacionamento com
doadores. [S7–S8]
**Contribuição ao projeto.** É uma referência para conectar pessoa atendida, programa, serviço prestado e
resultado acompanhado. Essa organização pode ajudar a evitar que o futuro sistema tenha registros isolados
de presença e de atendimento, sem uma visão do histórico da pessoa.
**Limites da evidência.** A documentação consultada não demonstra a regra familiar específica da instituição nem
o controle completo de materiais entre Bazar, estoque social e destinatário. O acompanhamento de serviços
não comprova, por si só, a movimentação física de bens.
**Condições a verificar.** O programa Power of Us anuncia concessão inicial de licenças a organizações elegíveis.
Elegibilidade, edição, limites e serviços adicionais precisam ser confirmados. Uma concessão de licenças não
representa implantação gratuita nem adequação automática ao processo local. [S7]

### 4.4 CiviCRM
**Classificação e foco.** CRM internacional de código aberto destinado a organizações sem fins lucrativos. A
documentação distingue contatos individuais, organizações e núcleos familiares, permite relacionamentos e
registra contribuições financeiras e participação em eventos. O componente CiviCase organiza casos e
sequências de interações. [S14–S16]
**Contribuição ao projeto.** O relacionamento entre pessoas e núcleo familiar é uma referência para a unidade de
atendimento adotada pela Luz da Esperança. O histórico de interações também ajuda a pensar a continuidade
do acompanhamento, inclusive quando diferentes profissionais participam do mesmo caso.
**Limites da evidência.** O tipo de contato familiar não equivale a uma ficha socioeconômica pronta para a
instituição. Participação em eventos também não comprova o fluxo de frequência das oficinas. O controle de
estoque e a entrega de itens vinculada à elegibilidade não foram evidenciados nas fontes examinadas.
**Condições a verificar.** Deve ser estudado como CRM e referência de organização de dados. Uma eventual
adoção exigiria avaliar configuração, adaptações, manutenção e integrações para atender às rotinas materiais e
sociais. A disponibilidade do código não elimina os custos de operação. [S14–S16]

## 5 Soluções brasileiras
### 5.1 DotCompany — solução para ONGs e associações
**Classificação e foco.** Solução apresentada pelo fornecedor como ERP para o terceiro setor. A página específica
anuncia composição familiar, fichas sociais, atendimentos, visitas, matrículas e frequência. Também descreve
estoque, banco de alimentos, distribuição de cestas e kits, benefícios concedidos e Bazar. [S9]
**Contribuição ao projeto.** É uma referência para estudar a conexão entre cadastro familiar, participação e
entrega de materiais. A existência desses grupos de funções na mesma oferta sugere cenários úteis para uma
demonstração, sem comprovar sua aderência ao processo local.
**Limites da evidência.** Recursos anunciados como pontuação de vulnerabilidade e biometria são escolhas do
fornecedor. Sua presença no mercado não os transforma em requisitos do Luz da Esperança. Regras de
prioridade e coleta de dados devem ser definidas com a instituição.
**Condições a verificar.** A fonte é uma página comercial; não houve teste. Seria necessário demonstrar o
percurso completo de uma família, a relação entre presença e elegibilidade, a baixa de itens e as condições de
acesso aos dados. [S9]

### 5.2 ONGFácil — Bliks
**Classificação e foco.** Plataforma de gestão para organizações sociais. A página oficial documenta projetos,
orçamentos, beneficiários, doadores, participação dos beneficiários, acompanhamento de evasão e relatórios
de prestação de contas. Também oferece rotinas financeiras e planos com diferenças de recursos e perfis de
acesso. [S10]
**Contribuição ao projeto.** A relação entre projeto, beneficiário e participação é pertinente ao acompanhamento
das atividades periódicas. A consolidação de registros em relatórios reforça a necessidade de aproveitar os
dados do trabalho cotidiano para apoiar a gestão.

**Limites da evidência.** Não foi demonstrado, nas fontes consultadas, como a plataforma representa toda a
composição familiar da ficha nem como controla estoque e entrega de bens materiais. O anúncio de “controle
de doações” não permite concluir que esses movimentos físicos estejam cobertos.
**Condições a verificar.** Deve-se confirmar o conteúdo de cada plano e o esforço de implantação. Para
comparação operacional, a evidência prioritária seria uma demonstração do cadastro, da presença e da
consulta ao histórico de atendimento. [S10]

### 5.3 Ongsys
**Classificação e foco.** Sistema de gestão para organizações do terceiro setor, com destaque para finanças e
projetos. O fornecedor documenta orçamento por projeto, receitas e despesas, documentos, contratos,
relatórios, voluntários, doadores e recibos de doação. [S11]
**Contribuição ao projeto.** A referência mais útil é a organização das informações por projeto e a relação entre
registros e documentos de suporte. Para o ERP Social, essa prática pode orientar a possibilidade de explicar os
números apresentados em relatórios, preservando os registros que lhes deram origem.
**Limites da evidência.** A descrição examinada não demonstra ficha familiar, presença em atividades recorrentes
ou distribuição de itens associada à elegibilidade. Orçamento de projeto não equivale à gestão da participação
de pessoas em atividades.
**Condições a verificar.** A página de planos deve ser consultada considerando serviços e condições aplicáveis à
organização. A inclusão de rotinas financeiras no produto pesquisado não implica que contabilidade e gestão
financeira completas pertençam ao escopo do ERP Social. [S11–S12]

### 5.4 Gestão Doar — Doar Digital
**Classificação e foco.** Plataforma administrativa para instituições, com finanças, equipe, projetos, tarefas,
contatos, contratos e relatórios. A página específica descreve integração com a captação da Doar Digital,
levando as doações recebidas para a gestão financeira. [S13]
**Contribuição ao projeto.** É uma referência para evitar repetição de registros entre captação e gestão,
mantendo clara a origem de uma operação. Esse aprendizado ajuda a discutir a comunicação entre os produtos
do projeto sem reunir todas as responsabilidades em um único módulo.
**Limites da evidência.** A oferta de Gestão Doar deve ser distinguida da plataforma de arrecadação Doar Digital.
Na página consultada, não foram evidenciados cadastro socioeconômico familiar, frequência das atividades
nem estoque e entrega de materiais a assistidos.
**Condições a verificar.** O site oferece período de teste; isso não comprova gratuidade permanente. Preços,
condições posteriores e funções necessárias ao atendimento social exigem confirmação. Sua principal
contribuição documental está na gestão administrativa e na integração com captação. [S13]

## 6 Comparação orientada ao atendimento social
A matriz resume somente as fontes citadas. Os termos nas células indicam o que foi descrito, sem afirmar
equivalência com o processo da instituição. “NE” significa não evidenciado no recorte pesquisado. Não foram
atribuídas notas de qualidade ou de aderência.

`Solução e fontes        Família ou pessoa assistida       Participação e atendimento          Estoque e entrega material`

`Contatos de doadores;`
`Blackbaud [S1–S2]                                         Atendimento social NE               Fluxo físico social NE`
`assistência familiar NE`

`ERPNext + Non Profit                                                                          Movimentos de estoque;`
`Família assistida NE              Fluxo social específico NE`
`[S3–S6]                                                                                       vínculo com assistidos NE`

`Perfis de participantes; regra`
`Salesforce [S7–S8]                                        Sessões, presença e casos           Estoque social NE`
`familiar local NE`

`Pessoas, núcleos familiares e     Eventos e casos; oficinas a`
`CiviCRM [S14–S15]                                                                             Estoque social NE`
`relações                          validar`

`Composição familiar e ficha                                           Estoque e distribuição`
`DotCompany [S9]                                           Frequência e atendimentos`
`social                                                                anunciados`

`Beneficiários; composição`
`ONGFácil [S10]                                            Participação e atendimentos         Fluxo físico social NE`
`familiar a validar`

`Frequência e atendimento`
`Ongsys [S11]            Família assistida NE                                                  Distribuição a assistidos NE`
`social NE`

`Projetos e tarefas;`
`Gestão Doar [S13]       Contatos; família assistida NE                                        Distribuição a assistidos NE`
`atendimento social NE`

Uma quantidade maior de funções anunciadas não demonstra maior adequação. A correspondência depende
do significado dos registros, das regras praticadas, do trabalho exigido da equipe e da capacidade de preservar
o histórico durante a transição.

## 7 Contribuições para a solução própria
As propostas abaixo são sínteses analíticas da pesquisa e do contexto local. Elas podem fundamentar o PRD,
mas precisam seguir o processo de validação de negócio; não representam decisões de arquitetura nem
ampliação automática do escopo.

`Necessidade            Diretriz de negócio a validar                                   Base documental`

`Acompanhar a           Relacionar membros, situação familiar e histórico,              Ficha e transcrição; modelos de`
`família ao longo do    permitindo consultar as pessoas sem perder a unidade            relações e acompanhamento em [S9,`
`tempo                  familiar.                                                       S14–S15].`

Entender
`Diferenciar presença, atendimento pontual e entrega de          Transcrição; participação e serviços`
participação e
`doação; permitir consultas conjuntas ao histórico.              em [S8, S10].`
atendimento

`Registrar entrada, transferência e saída com origem,`
`Saber o destino dos                                                                    Transcrição; movimentos e`
`destino, data e quantidade; vincular a entrega ao`
`materiais                                                                              distribuição em [S5, S9].`
`destinatário.`

`Tornar visíveis os dados usados para decidir e registrar a      Transcrição e ficha; critérios locais`
Aplicar critérios de
`decisão; definir com a instituição os critérios ainda           não substituídos por regras de`
atendimento
`abertos.                                                        fornecedores.`

`Necessidade           Diretriz de negócio a validar                                    Base documental`

`Contexto local; referências de`
`Produzir informação   Gerar sínteses a partir dos registros operacionais e`
`acompanhamento e relatórios em`
`gerencial confiável   permitir compreender o que compõe cada total.`
`[S1, S8, S11].`

`Definir responsabilidades e compartilhamento necessário`
`Coordenar sistemas                                                                     Transcrição; integração de funções`
`entre ERP Social, CRM e Bazar, evitando registros`
`e equipes                                                                              em [S1–S2, S13].`
`contraditórios.`

**Limite de escopo.** Captação financeira, contabilidade, vendas, recursos humanos, biometria e pontuação
automática de vulnerabilidade aparecem em ofertas de mercado. A necessidade de cada um desses recursos
no sistema próprio depende do problema a resolver e da responsabilidade de cada produto. A pesquisa não os
incorpora ao PRD por simples comparação.

### 7.1 Sustentação econômica e continuidade
A decisão de desenvolver um sistema próprio já foi informada pela equipe. A pesquisa não demonstra que
desenvolver seja necessariamente mais barato que contratar ou adaptar uma solução existente. ERPNext e
CiviCRM mostram alternativas de código aberto, e a Salesforce apresenta condições específicas para
organizações elegíveis. Assim, a justificativa do projeto precisa considerar adequação e sustentabilidade, além
do pagamento de licenças. [S3, S7, S16]
O levantamento econômico deve comparar, para um mesmo período e escopo, licença ou assinatura,
implantação, migração, hospedagem, suporte, manutenção, capacitação e tempo da equipe. No sistema
próprio, também é necessário definir quem continuará responsável após a entrega acadêmica. Sem esses
valores e responsabilidades, não é possível declarar economia comprovada.

### 7.2 Transição do Bússola Social
Antes de substituir o sistema atual, a equipe precisa identificar quais cadastros e históricos são usados, quais
dados podem ser exportados, em que formato e com quais condições. A migração deve preservar relações
entre famílias e pessoas, bem como os registros necessários à continuidade do atendimento. A exportação
completa ainda não foi confirmada. [I3]
Como critério proposto para a transição, recomenda-se conferir amostras de famílias e históricos, reconciliar os
totais relevantes e validar com os usuários os fluxos essenciais antes de encerrar o uso operacional anterior.
Também deve ser combinado como consultar informações históricas que eventualmente não sejam migradas.

## 8 Conclusão e inserção no dossiê
O levantamento demonstra que a lista reúne soluções de naturezas distintas e oferece referências úteis para a
construção do ERP Social. As capacidades documentadas abrangem relacionamento, acompanhamento de
pessoas, participação, recursos financeiros e materiais, mas a cobertura anunciada não substitui a validação
dos processos específicos da Luz da Esperança.
A contribuição principal para o projeto é orientar a solução em torno da família assistida e do histórico de
participação, atendimento e recebimento de doações. As regras de elegibilidade, prioridade e integração com o
Bazar continuam dependentes de definição institucional. A manutenção do sistema próprio e a transição do
Bússola Social fazem parte da viabilidade da solução.

Este documento compõe o eixo “pesquisa documental — sistemas similares” do dossiê solicitado pelo
professor. Deve ficar junto à transcrição, à ficha de cadastro e aos demais materiais de evidência. O PRD
consolida as decisões de negócio validadas a partir dessas fontes; as especificações e ADRs detalham
posteriormente a solução. Pesquisas sobre artigos e legislação constituem outros componentes do dossiê e não
são substituídas por este levantamento.

## 9 Referências e rastreabilidade
Fontes externas: páginas oficiais consultadas em 18 de setembro de 2026, com links clicáveis. As páginas
comerciais registram a oferta declarada; a documentação descreve conceitos e condições de uso.

### 9.1 Produtos e documentação oficial
[S1] BLACKBAUD. Financial Edge NXT. Gestão financeira e contábil. Página oficial.
[S2] BLACKBAUD. Raiser’s Edge NXT. CRM de captação e relacionamento. Página oficial.
[S3] FRAPPE. ERPNext. Apresentação do ERP e de seus módulos. Página oficial.
[S4] FRAPPE. Non-profit Module in ERPNext. Finalidade, instalação e condição do aplicativo Non Profit.
Documentação.
[S5] FRAPPE. Stock Entry. Tipos de movimentação de materiais. Documentação.
[S6] FRAPPE CLOUD. Frappe Non Profit. Registro do aplicativo no marketplace. Página do aplicativo.
[S7] SALESFORCE. Nonprofit. Oferta para organizações sem fins lucrativos e Power of Us. Página oficial.
[S8] SALESFORCE. Program and Outcome Management. Programas, serviços, participação, casos e resultados.
Página oficial.
[S9] DOTCOMPANY. Sistema para ONG e Associação. Recursos anunciados de gestão social e administrativa. Página
oficial.
[S10] BLIKS. Bliks ONGFácil. Beneficiários, participação, projetos, finanças e planos. Página oficial.
[S11] ONGSYS. Sistemas de Gestão. Recursos de gestão financeira, projetos e documentos. Página oficial.
[S12] ONGSYS. Planos de Serviços Financeiros. Condições comerciais publicadas. Página de planos.
[S13] DOAR DIGITAL. Gestão Doar. Gestão administrativa e integração com captação. Página oficial.
[S14] CIVICRM. Contacts — CiviCRM User Guide. Contatos, núcleos familiares, contribuições e eventos.
Documentação.
[S15] CIVICRM. What is CiviCase? — CiviCRM User Guide. Casos e sequências de interações. Documentação.
[S16] CIVICRM. License. Licenciamento de código aberto do projeto. Página oficial.

### 9.2 Evidências internas do projeto
[I1] Transcrição do levantamento com o professor. Arquivo fornecido pela equipe: “trancription.md”. Fonte dos
processos, da unidade familiar, das atividades e das fronteiras entre ERP Social, CRM e Bazar. Data da gravação não
informada nesta pesquisa.
[I2] Ficha de Cadastro de Famílias 2025 — Completo. Formulário fornecido pela equipe, com duas páginas. Fonte da
composição familiar, caracterização socioeconômica, necessidades e registro de doações, ações e visitas.
[I3] Esclarecimentos da equipe e orientação do professor. Mensagens e imagem fornecidas na conversa em 18 de
setembro de 2026: Bússola Social é o sistema pago atual a substituir; o dossiê reúne diferentes documentos,
incluindo transcrição e pesquisa documental.
