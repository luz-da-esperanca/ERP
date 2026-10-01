# Bibliografia e fundamentação do ERP Social
*Pesquisa documental para o dossiê Luz da Esperança*

**Versão: 1.1 • Revisão: 18 de setembro de 2026**
**Situação: pesquisa documental revisada; enquadramentos e políticas institucionais ainda sujeitos a validação.**

## 1 Finalidade e conclusão
Este documento fundamenta o problema e a solução de negócio do ERP Social Luz da Esperança. Reúne
evidências da instituição, estudos acadêmicos, legislação e referências técnicas, indicando o que cada fonte
sustenta e quais conclusões continuam dependentes de levantamento ou decisão local.
A instituição pretende substituir o Bússola Social, atualmente pago, por um sistema próprio. O produto deve
apoiar o acompanhamento de famílias, a participação em atividades, os atendimentos pontuais e a
movimentação de itens do estoque social. A decisão de construir foi informada pela equipe; economia,
qualidade da migração e capacidade de sustentação ainda precisam ser demonstradas. [I1–I4]
A pesquisa sustenta que dados úteis, pessoas responsáveis, critérios de uso e manutenção devem ser
considerados junto à entrega do software. Não comprova um percentual de melhoria para a instituição, nem
autoriza transformar sugestões de funcionalidades em regras definitivas. O PRD 1.1 é a referência de negócio;
esta bibliografia fornece fundamentação e não cria um catálogo paralelo de requisitos.

## 2 Método e natureza das fontes
O levantamento é documental e exploratório, com seleção dirigida ao problema do projeto. Foram consultados
os documentos da pasta ERP, páginas oficiais de legislação e normalização, documentação do mantenedor do
ERPNext e registros acadêmicos da editora e de repositório universitário. A data de acesso às fontes externas é
## 18 de setembro de 2026. Não se trata de revisão sistemática nem de demonstração prática dos sistemas.
Os dois estudos acadêmicos foram identificados por título, autores, periódico e DOI. As sínteses desta versão se
limitam aos resumos disponíveis na editora e no repositório institucional; não se declara leitura integral dos
artigos. Essa delimitação permite utilizar seus achados gerais sem inventar detalhes metodológicos ou
resultados não consultados. A consulta à ISO se limita à apresentação pública da norma, sem acesso integral às
cláusulas.

**Natureza**         Fontes e uso                                       Limite

`Registram o que foi dito ou`
Evidência primária
`Transcrição, ficha e esclarecimentos da equipe.    disponibilizado; detalhes operacionais`
local
`podem continuar abertos.`

`Organizam evidências e propostas; não`
`Síntese do projeto     PRD e pesquisa de sistemas.`
`comprovam aprovação institucional.`

`Fundamentam gestão e uso de dados;`
`Estudos acadêmicos     Artigos de Hackler e Saxton; Mayer e Fischer.      não medem o desempenho do Luz da`
`Esperança.`

**Natureza**          Fontes e uso                                      Limite

`Exigem análise de pertinência ao`
Legislação e norma do
`LOAS, LGPD, ECA e NOB/SUAS.                       tratamento e à atuação efetiva da`
SUAS
`instituição.`

`Descrevem conceitos e referências; não`
Documentação e
`ERPNext e apresentação da ISO/IEC 27001.          são artigos nem decisões de`
normalização técnica
`arquitetura do projeto.`

## 3 Estudos acadêmicos
### 3.1 Uso estratégico da tecnologia em organizações sem fins lucrativos
Hackler e Saxton (2007) analisam um levantamento sobre planejamento, aquisição e implementação de
tecnologia em organizações sem fins lucrativos. O resumo relata capacidades promissoras e limitações no uso
estratégico da tecnologia, destacando planejamento de longo prazo, orçamento, equipe, capacitação, avaliação
de desempenho e envolvimento da direção. [A1]
**Contribuição ao projeto.** O estudo fundamenta considerar sustentação e adoção como parte da solução. A
instituição precisa definir quem mantém o ERP, quem apoia os usuários e como serão acompanhados seus
resultados. Essa aplicação é uma interpretação para o projeto, relacionada a DEC-10 do PRD.
**Limites.** É um estudo de 2007, útil como referência de gestão. Não compara produtos atuais nem permite
afirmar que software próprio seja mais barato ou melhor para a instituição. A síntese utiliza o resumo
publicado pela editora.

### 3.2 Uso de dados em organizações sem fins lucrativos
Mayer e Fischer (2023) apresentam uma revisão sobre tipos de dados, motivações e barreiras ao seu uso
nessas organizações. O resumo identifica finalidades como aperfeiçoamento de programas e prestação de
contas, além de dificuldades para identificar informação relevante, desenvolver capacidade técnica e priorizar o
trabalho com dados. Também aponta fragmentação na literatura. [A2]
**Contribuição ao projeto.** O cadastro e os relatórios devem partir de perguntas operacionais concretas: quem
foi atendido, qual família recebeu itens, quais atividades ocorreram e quais registros sustentam cada total. Essa
interpretação apoia CAP-10 e os indicadores do PRD, mantendo objetivos e responsáveis explícitos.
**Limites.** O artigo não é uma avaliação do Bússola Social ou do ERP proposto. Não fundamenta novos campos
obrigatórios nem metas numéricas locais. Foram consultados o resumo e os metadados do repositório
universitário; a publicação no volume do periódico é de 2023, embora a disponibilização antecipada seja de
2022.

## 4 Legislação e normas relacionadas ao negócio
### 4.1 LOAS e atuação assistencial
A Lei nº 8.742/1993 denomina-se Lei Orgânica da Assistência Social. Seus arts. 1º a 4º tratam da assistência
social, de seus objetivos, das entidades e de princípios como dignidade e igualdade de acesso. Esses

dispositivos contextualizam a atuação assistencial, mas não prescrevem o formulário específico da instituição
nem um modelo de banco de dados. [N1]
A transcrição usa a expressão “Lei Ordinária”; a evidência original deve ser preservada e a nomenclatura
correta utilizada nos documentos derivados. O vínculo familiar é uma necessidade relatada no levantamento. A
regra de participação de um membro para considerar a família apta é uma regra local relatada, não uma
obrigação extraída da LOAS. Sua aplicação deve ser validada pela instituição à luz de seu enquadramento, dos
serviços prestados e das normas pertinentes. [I1; N1]

### 4.2 LGPD e informações de pessoas assistidas
A Lei nº 13.709/2018 oferece referências para a definição dos dados e de seu tratamento: art. 5º, II, para dados
sensíveis; art. 6º, para princípios; arts. 7º e 11, para hipóteses aplicáveis; art. 14, para crianças e adolescentes;
arts. 15 e 16, para término e conservação; e art. 46, para medidas de segurança. [N2]
A ficha inclui saúde, medicamentos e informações de conteúdo religioso, além de dados de menores. A seleção
dos campos digitais deve explicitar finalidade, necessidade, acesso e guarda. A presença no formulário não
comprova autorização de tratamento. [I2; N2]
O art. 46 exige medidas técnicas e administrativas adequadas. RBAC e criptografia podem integrar a solução,
mas não são escolhas já feitas pelo PRD nem prescrições literais dos arts. 6º, 7º e 11. Preservar o histórico
também não significa retenção indefinida. As definições institucionais e os mecanismos técnicos devem ser
registrados nos documentos próprios. [N2]

### 4.3 ECA e acompanhamento de crianças e adolescentes
A Lei nº 8.069/1990 trata da proteção de crianças e adolescentes. Os arts. 4º e 5º são pertinentes à proteção e
aos direitos; os arts. 17 e 18, ao respeito, à identidade e à dignidade. [N3]
Essas referências orientam a análise do acompanhamento e da exposição de informações. Não estabelecem,
por si, campos obrigatórios de tamanho de roupa, religião ou escolaridade no ERP. A inclusão de cada campo
deve ser justificada por sua finalidade e validada com os responsáveis. A prioridade legal não define
automaticamente um algoritmo de ordenação das entregas.

### 4.4 NOB SUAS e centralidade da família
A Resolução CNAS nº 33, de 12 de dezembro de 2012, aprova a Norma Operacional Básica do Sistema Único de
Assistência Social. Seu art. 5º, IV, inclui a matricialidade sociofamiliar entre as diretrizes de gestão; o art. 6º
apresenta princípios éticos da oferta socioassistencial. [N4]
A norma oferece contexto para compreender o acompanhamento familiar. Sua aplicação deve considerar a
inserção efetiva da instituição no SUAS e os serviços que executa. Ela não deve ser citada genericamente como
um manual de preenchimento da ficha local ou de anamnese. Não foi comprovada nesta pesquisa a
obrigatoriedade de adotar um prontuário padronizado do SUAS.

### 4.5 Pontos que precisam de validação institucional
DEC-05 e DEC-08 devem reunir as decisões sobre os campos da ficha, as finalidades, o tratamento dos dados e
as responsabilidades. DEC-02 e DEC-03 continuam necessárias para critérios de participação, prioridades e
exceções. Antes de automatizar restrições, a instituição deve confirmar sua política e sua adequação ao
enquadramento aplicável. A presente pesquisa não registra parecer jurídico nem conformidade certificada.

## 5 Documentação técnica e sistemas similares
### 5.1 ERPNext e aplicativo Non Profit
A documentação oficial do ERPNext descreve o aplicativo Non Profit como instalação separada, concebida para
rotinas de doadores, membros, programas e outras atividades. Informa que o repositório está arquivado e que
a compatibilidade com versões recentes precisa ser verificada. Essa documentação é fonte técnica; não
constitui artigo científico. [T1]
A documentação Stock Entry distingue entradas, saídas e transferências entre estoques. Esses conceitos
ajudam a estudar o fluxo Bazar → social. Eles não comprovam uma solução pronta de frequência, família,
elegibilidade e distribuição de itens nem uma garantia de rastreabilidade total para este projeto. [T2]

### 5.2 Referência de gestão da segurança da informação
A ISO/IEC 27001:2022 estabelece requisitos para um sistema de gestão da segurança da informação. Foi
consultada a apresentação pública da ISO, que destaca gestão de riscos e proteção da informação. O conteúdo
integral da norma não foi consultado; esta revisão não atribui requisitos específicos de RBAC ou auditoria a
cláusulas não examinadas. [T3]
A referência internacional substitui, nesta bibliografia, a menção anterior a uma edição ABNT não verificada.
Sua adoção e eventual certificação não foram definidas para a instituição. A escolha de controles do software
deve decorrer da necessidade e dos riscos identificados, com detalhamento nas specs e ADRs.

### 5.3 Relação com a pesquisa de sistemas
A pesquisa documental existente examina oito entradas: Blackbaud Financial Edge NXT + Raiser’s Edge NXT;
ERPNext + Non Profit; Salesforce Nonprofit Cloud; CiviCRM; DotCompany; ONGFácil; Ongsys; e Gestão Doar. O
Bússola Social aparece como sistema atual a substituir, não como uma das oito entradas da comparação. [I4]
As páginas comerciais e documentações registram capacidades anunciadas. Elas não comprovam adequação à
instituição nem autorizam incorporar captação, finanças, biometria ou pontuação de vulnerabilidade ao
escopo. A documentação dos oito sistemas permanece no documento específico, com suas referências.

## 6 Conciliação com o PRD
**Tema**           Tratamento consistente nesta revisão                   Referência

`Compatibilidade por    Sugestão de evolução; o campo na ficha não torna a`
`EVO-01; I1–I2`
`tamanho                recomendação automática obrigatória.`

`Documentos ausentes    Não presumir documentos universais para acessar`
`Seção 4.1; DEC-01 e DEC-03`
`e urgências            assistência; política emergencial continua pendente.`

`Exigir correção explicável e contexto recuperável;`
Preservação do
`não presumir imutabilidade absoluta ou guarda          RN-08 e RN-09`
histórico
`indefinida.`

`Consistência de        Exigir saldo e entrega coerentes; técnica de`
`RN-10; specs e ADRs`
`estoque                concorrência será definida posteriormente.`

**Tema**            Tratamento consistente nesta revisão                   Referência

`Definir acesso necessário e proteção adequada;`
`Segurança                                                                CAP-11; DEC-08`
`mecanismo técnico ainda não escolhido.`

`Preservar a regra relatada e manter período,`
`Frequência e aptidão                                                           RN-02; DEC-02`
`evidência e parâmetros pendentes.`

`Substituição do         Incorporar Bússola Social, conferência do histórico,`
`PROB-07; CAP-12; DEC-10 e DEC-11`
`sistema atual           continuidade e sustentação.`

## 7 Lacunas que a pesquisa documental não resolve
A bibliografia não fornece o custo atual do Bússola Social, volumes de registros, dificuldades efetivamente
observadas, condições de exportação ou disponibilidade das pessoas para manter o ERP próprio. Esses dados
exigem levantamento com a instituição e, quando necessário, exame do contrato e das exportações
autorizadas.
O roteiro consta do índice do dossiê. Cada resposta deve indicar responsável, data e evidência. As pendências
podem permanecer documentadas enquanto são investigadas; não devem ser preenchidas com estimativas
apresentadas como fatos.

## 8 Referências
Todas as fontes externas abaixo foram consultadas em 18 de setembro de 2026. Os identificadores permitem
localizar o fundamento de cada síntese. Os títulos dos materiais internos foram preservados ou identificados
pela versão correspondente.

### 8.1 Estudos acadêmicos
[A1] HACKLER, Darrene; SAXTON, Gregory D. The Strategic Use of Information Technology by Nonprofit
Organizations: Increasing Capacity and Untapped Potential. Public Administration Review, v. 67, n. 3, p. 474–487,
## 2007 DOI: 10.1111/j.1540-6210.2007.00730.x. Página da editora e resumo consultado.
[A2] MAYER, Duncan J.; FISCHER, Robert L. Exploring data use in nonprofit organizations. Evaluation and Program
Planning, v. 97, artigo 102197, 2023. Publicação antecipada em 2 dez. 2022. DOI:
10.1016/j.evalprogplan.2022.102197. Registro e resumo no repositório da Case Western Reserve University .

### 8.2 Legislação e norma do SUAS
[N1] BRASIL. Lei nº 8.742, de 7 de dezembro de 1993. Dispõe sobre a organização da Assistência Social e dá outras
providências. Texto compilado. LOAS no Planalto.
[N2] BRASIL. Lei nº 13.709, de 14 de agosto de 2018. Lei Geral de Proteção de Dados Pessoais. Texto atualizado
disponibilizado pelo Planalto. LGPD.
[N3] BRASIL. Lei nº 8.069, de 13 de julho de 1990. Dispõe sobre o Estatuto da Criança e do Adolescente e dá outras
providências. Texto atualizado disponibilizado pelo Planalto. ECA.
[N4] BRASIL. Conselho Nacional de Assistência Social. Resolução nº 33, de 12 de dezembro de 2012. Aprova a Norma
Operacional Básica do Sistema Único de Assistência Social — NOB/SUAS. Publicação institucional do Ministério do
Desenvolvimento Social e Combate à Fome. Texto oficial da NOB SUAS.

### 8.3 Documentação e normalização técnica
[T1] FRAPPE. Non-profit Module in ERPNext. Documentação oficial, sem data de publicação atribuída nesta
pesquisa. Documento consultado.
[T2] FRAPPE. Stock Entry. Documentação oficial, sem data de publicação atribuída nesta pesquisa. Documento
consultado.
[T3] ISO; IEC. ISO/IEC 27001:2022 — Information security, cybersecurity and privacy protection — Information
security management systems — Requirements. 3. ed., out. 2022. Consulta à apresentação pública, sem acesso ao
texto integral. Página oficial da ISO.

### 8.4 Materiais do projeto
[I1] Transcrição do levantamento do ERP Social, CRM e Bazar. Arquivo “trancription.md”, fornecido pela equipe;
data da gravação não confirmada. Arquivo na pasta do projeto.
[I2] Ficha de Cadastro de Famílias 2025 — Completo. Formulário de duas páginas, com identificação do Instituto da
Caridade, fornecido pela equipe. “2025” integra o nome do arquivo; não se presume revisão em 2026. Ficha na
pasta do projeto.
[I3] PRD do ERP Social Luz da Esperança. Versão 1.1, 18 set. 2026. Arquivo canônico “PRD-ERP-Luz-da-Esperanca-
v1.1.md”, acompanhado de edição Word nesta entrega. Revisão baseada no PRD 1.0 e nos esclarecimentos da
equipe sobre o sistema atual e sua substituição. Aprovação institucional das pendências não registrada.
[I4] Pesquisa documental de sistemas para organizações sociais. Subsídio ao dossiê do ERP Social Luz da Esperança.
Versão 1.0, 18 set. 2026. Documento na pasta do projeto.

## 9 Registro desta revisão
A versão 1.1 substitui o conteúdo do arquivo “bibliografia.pdf” examinado na pasta ERP. Foram incluídos dois
estudos acadêmicos identificáveis, corrigida a classificação da documentação do ERPNext e retiradas
conclusões não sustentadas. As referências normativas foram especificadas, a consulta à ISO foi delimitada e as
propostas de produto foram reconciliadas com o PRD. A lista de sistemas, os títulos internos e a identificação
da ficha foram corrigidos. A revisão não registra novas entrevistas, testes de produtos ou aprovação
institucional.
