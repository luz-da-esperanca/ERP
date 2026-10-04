---
type: feature
created: 2026-10-04 15:41
source: ERP Social Luz da Esperança · main · AGENTS.md e specs do MVP
---

# Prompt para o Lovable — ERP Social Luz da Esperança

**Uso:** cole este documento no Lovable. Ele é autossuficiente para orientar a primeira entrega; os links finais permitem aprofundar os contratos caso o repositório também esteja disponível.

**Premissa desta versão:** protótipo navegável com dados sintéticos, para refinarmos telas e fluxos. Essa é uma escolha de trabalho deste prompt, ainda não uma aprovação de implantação ou mudança da stack. Autenticação real, persistência e garantias transacionais dependem da integração com o backend definido abaixo.

## Problema e resultado esperado

Crie a primeira versão navegável do **ERP Social Luz da Esperança**, uma aplicação interna para acompanhar pessoas assistidas e suas famílias. A família é a referência da assistência; a participação nas atividades é individual.

Precisamos cadastrar e localizar pessoas e famílias, preservar vínculos históricos, publicar versões da ficha social, organizar projetos e atividades, registrar encontros e presenças, avaliar aptidão familiar e consultar históricos e relatórios explicáveis. Inclua login, sessão, administração de contas, permissões, configurações pertinentes e auditoria das alterações.

Entregue jornadas conectadas: ações modificam os dados sintéticos e repercutem em listas, detalhes, históricos e relatórios. Inclua formulários, validações, confirmações e estados de erro. O resultado será nossa base para revisar o produto e evoluir a implementação.

## Estado atual e evidências

O repositório está na fase documental, sem aplicações, API, banco configurado, manifestos ou scripts de execução. Não presuma endpoints disponíveis ou testes já executados.

O recorte e a stack estão em `AGENTS.md`. O índice das specs registra decisões de implementação adotadas em 01/10/2026. A matriz de rastreabilidade abrange 53 requisitos funcionais; três de relatórios são parciais no recorte do MVP e os blocos sensíveis da ficha têm uso condicionado.

Preserve as decisões adotadas:

- Aptidão configurável, sem política inicial nem valores institucionais presumidos; sem política, a situação é **Pendente**.
- Quatro perfis combináveis: Coordenação, Assistência Social, Responsável por Atividade e Administrador.
- No máximo uma família vigente por pessoa em cada instante, preservando vínculos anteriores.
- Exatamente um instituto por projeto e uma lista simples de participantes das atividades periódicas.
- Inscrição, presença e declaração de cobertura dos encontros são fatos distintos.
- Saúde, medicamentos e religião têm estruturas previstas, desativadas por padrão até aprovação específica.

Decisões de desenho não encerram as decisões institucionais DEC/LAC sobre campos, frequência mínima, finalidades, dados reais e operação.

## Requisitos

### 1. Base técnica e demonstração

Use **TypeScript, React, Tailwind CSS e React Router em modo declarativo**, Zod para contratos/validação e Vitest para testar as regras implementadas. Código, comentários, descrições de testes e mensagens técnicas em inglês; interface e documentação em português do Brasil.

A arquitetura definitiva é um monorepo pnpm com `apps/web`, `apps/api` e `packages/contracts`. Backend Node.js/Fastify monolítico modular, PostgreSQL/Prisma, Redis para sessões e controles temporários de autenticação, jose para tokens e bcrypt para senhas. Preserve essa direção na organização do frontend.

Crie uma camada de acesso a dados tipada, substituível por HTTP, e um adaptador de demonstração com estado compartilhado entre as telas. Isole regras de domínio dos componentes React; sua execução definitiva pertence ao backend. A interface real consome a API e os resultados autorizados, sem acessar Prisma ou banco diretamente.

O modo inicial é `SYNTHETIC`. Mostre discretamente **“Ambiente de demonstração — use apenas dados fictícios”**. Documente como restaurar o cenário e se recarregar a página reinicia os dados. Essa mensagem não detecta se um texto inserido é real.

Ofereça acesso explícito a contas fictícias dos quatro perfis e a uma combinação de perfis, separado do formulário de login. Simule sessão e respostas de autenticação sem apresentar a demonstração como segurança real. Não crie senha padrão para produção. Rascunhos da ficha ficam em memória, sem localStorage, sessionStorage ou IndexedDB.

Não substitua a stack definida por Supabase, Firebase, autenticação proprietária ou outro backend gerado automaticamente. Integrações indisponíveis permanecem simuladas e identificadas na documentação técnica da entrega.

### 2. Experiência e navegação

Construa uma aplicação de trabalho da equipe. Direção visual inicial, revisável: tema claro, fundo neutro, verde profundo como cor principal, tipografia legível e componentes consistentes. Priorize tabelas, filtros, formulários e detalhes. Essa sugestão não representa identidade visual institucional aprovada.

Menu sugerido, filtrado pelas capacidades da conta: **Início, Famílias, Pessoas, Projetos e atividades, Qualidade cadastral, Relatórios, Auditoria e Configurações**. A ficha e a aptidão ficam no contexto da família; chamada e cobertura, no contexto da atividade.

O Início oferece atalhos permitidos. Se apresentar indicadores, derive-os das consultas de relatórios, com período, unidade e acesso ao detalhe. Administrador isolado vê administração de contas, sem indicadores assistenciais.

- Interface pt-BR; datas `dd/mm/aaaa`, valores em BRL e fuso institucional configurável, usando `America/Fortaleza` como referência de desenvolvimento.
- Dados ausentes: **“Não informado”**. Booleanos opcionais: **Sim / Não / Não informado**. Chamada sem marcação: **“Não registrado”**.
- Diferencie **Apta**, **Não apta** e **Pendente** por rótulo e indicação visual acessível, sem depender apenas de cor.
- Listas com busca, filtros autorizados, paginação e ordenação estável. Busca textual sem distinção de caixa/acentos; documentos e códigos com comparação exata.
- Carregamento, vazio, erro, sucesso, indisponibilidade, acesso negado, sessão expirada e conflito de edição precisam de tratamento.
- Bloqueios explicam o motivo e a ação possível. Formulários indicam obrigatoriedade e erros próximos aos campos.
- Operações compostas oferecem revisão antes da confirmação; correções e cancelamentos exigem motivo. Conflitos não sobrescrevem alterações recentes silenciosamente.
- Navegação por teclado, rótulos acessíveis e foco visível. A chamada deve funcionar bem no celular, em uma única tela de trabalho com rolagem.
- Botões executam o que prometem. Acesso por URL direta também respeita as permissões no fluxo demonstrado.

### 3. Autenticação, sessão e contas — ACS

Implemente:

- `/login`: usuário e senha, mostrar/ocultar senha, envio, erro genérico de credenciais, bloqueio temporário e indisponibilidade.
- `/change-password`: senha atual, nova senha e confirmação; troca voluntária e obrigatória no primeiro acesso ou após reset administrativo.
- Consulta da sessão e saída. Durante troca obrigatória, somente sessão, logout e troca de senha ficam disponíveis. Após trocar, exigir novo login.
- `/settings/users`: busca/listagem, criação com login, nome de exibição, senha inicial e perfis; edição de nome/perfis, ativação/desativação e reset de senha temporária com motivo. Contas criadas/resetadas exigem troca de senha. Desativação preserva autoria anterior.

Contas de operadores e pessoas assistidas são entidades distintas. Famílias não acessam o sistema. Perfis são um catálogo fixo; uma conta recebe a união dos perfis atribuídos, sem superusuário implícito ou necessidade de alternar perfil durante o uso.

| Capacidade | Coordenação | Assistência Social | Responsável por Atividade | Administrador |
| --- | --- | --- | --- | --- |
| Cadastro, vínculos e unificação | Ler/escrever | Ler/escrever | Seleção mínima de pessoa/família | Sem acesso |
| Ficha social e versões | Ler/escrever blocos habilitados | Ler/escrever blocos habilitados | Sem acesso | Sem acesso |
| Institutos, projetos e atividades | Ler/escrever | Ler | Ler | Sem acesso |
| Inscrições, encontros, chamada, correção e cobertura | Ler/escrever | Ler | Ler/escrever | Sem acesso |
| Aptidão familiar e evidências | Ler/avaliar | Ler/avaliar | Sem acesso ao resultado familiar | Sem acesso |
| Publicar política de aptidão | Sim | Não | Não | Não |
| Relatórios | Todos do recorte | Cadastro/social, alcance, frequência e aptidão do recorte | Frequência e alcance, campos mínimos | Sem dados assistenciais |
| Administrar usuários/perfis | Somente com perfil adicional de Administrador | Somente com perfil adicional de Administrador | Somente com perfil adicional de Administrador | Sim |
| Seleção de campos e decisões de habilitação | Sim | Não | Não | Não |
| Auditoria | Entidades/campos autorizados | Entidades/campos autorizados | Projetos/atividades/chamadas, projeção mínima | Contas/perfis |

Seleção mínima: pessoa `id/name`, família `id/code`. Responsável por atividade não recebe CPF, endereço, renda ou ficha, inclusive por filtros, histórico e relatórios. A permissão desse perfil aplica-se ao módulo; designar um responsável não cria restrição exclusiva por atividade nem concede perfil a uma conta.

Login: minúsculas após trim, 3–100 caracteres ASCII entre letras, números, ponto, hífen e underscore. Senha: sem trim/truncamento, mínimo de 12 caracteres Unicode, máximo de 72 bytes UTF-8 e sem NUL. Impedir remoção/desativação do último administrador ativo.

Preserve os contratos para autenticação real:

- `/api/v1/auth/login` via POST, `/auth/session` via GET, `/auth/logout` via POST e `/auth/password` via PUT; todos sob o mesmo prefixo. Contas e perfis seguem `/users` e `/roles` da SPEC-ACS.
- JWT jose `HS256` em cookie HttpOnly e sessão revogável no Redis. Backend valida assinatura, algoritmo, emissor, audiência, expiração, conta ativa e permissões atuais. Token não vai para JSON ou storage do navegador.
- Produção: cookie `__Host-erp_session`, `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, sem `Domain`; SPA e API na mesma origem.
- Login/escritas exigem JSON, `Origin` autorizado e `X-ERP-Request: 1`; esse cabeçalho não é segredo.
- Configurações técnicas iniciais: 30 minutos de inatividade, 8 horas de prazo absoluto e bloqueio de 15 minutos após 5 falhas consecutivas, mais limite configurável por IP. Não são parâmetros de aptidão.
- Reset, troca de senha e desativação revogam sessões por versão persistente de autenticação. Mudanças de perfil valem na próxima requisição. Indisponibilidade do Redis não permite acesso alternativo.
- Bcrypt no backend, segredos em variáveis de ambiente e bootstrap da primeira conta por comando local com entrada oculta, sem senha padrão no seed.

Na expiração, preservar somente rascunhos não sensíveis em memória. Cadastro público, recuperação por e-mail, SSO, MFA e editor de perfis personalizados não integram a entrega. Esquecimento de senha orienta procurar o administrador para o reset previsto.

### 4. Pessoas, famílias e qualidade cadastral — CAD

Ofereça listas, busca antes de cadastrar, detalhes e edição em `/families`, `/families/:id`, `/people`, `/people/:id` e `/data-quality`.

Família: código único gerado, nome de referência opcional, endereço, bairro, CEP, localização urbana/rural ou desconhecida e telefone. Pessoa: nome, nascimento, sexo, CPF, RG, ocupação, escolaridade e telefone. O mínimo é **nome e primeiro vínculo familiar**, criados juntos; documentos, nascimento e sexo desconhecidos não impedem cadastro. Uma família pode ser criada inicialmente sem membros.

No detalhe familiar, mostre cadastro, titular ou pendência, membros na data selecionada, vínculos anteriores e acesso autorizado à ficha, aptidão, histórico e alterações. Quantidade de membros é calculada por pessoas distintas com vínculo vigente, nunca digitada pelo operador.

Inclua encerramento de vínculo, transferência e troca de titular com vigência e motivo. No máximo um titular por família e uma família vigente por pessoa em cada instante. Intervalos usam início inclusivo/fim exclusivo. Mudança real encerra um vínculo e inicia outro; correção de erro cadastral é identificada separadamente. Parentescos não são inferidos após troca de titular.

Presenças anteriores mantêm a família/vínculo da data do encontro. Fichas e avaliações salvas conservam suas versões. Corte retroativo que invalide o contexto de presença exige revisão da data ou reconciliação explícita de vínculo e contexto do fato, com motivos e permissões pertinentes; não mova o histórico silenciosamente.

Numeração de calçado e vestuário é texto opcional por pessoa, com data e histórico. Não inferir tamanho por idade, recomendar itens ou apresentar a coleta para adultos como aprovada; LAC-12 permanece pertinente ao uso real.

Busca e duplicidades:

- Mostrar candidatos por nome, nascimento, CPF e endereço disponíveis, explicando a semelhança. CPF igual não implica fusão automática nem unicidade obrigatória.
- Continuar criando apesar de candidatos exige decisão de que são distintos e motivo. Candidatos novos antes da confirmação exigem nova revisão.
- Qualidade cadastral lista dados ausentes e possíveis duplicidades, abertas/resolvidas, com identificação, resolução, autor e motivo. Relevância dos campos segue a seleção aplicável; documento ausente não é bloqueio.
- Unificação tem origem/destino, prévia comparativa, escolha explícita dos campos divergentes, motivo e confirmação. Tratar conflitos de vínculos, titulares, inscrições, marcações e tamanhos.
- Conflitos pendentes impedem confirmação. Presenças duplicadas da mesma identidade/encontro contam uma após reconciliação, preservando origens. Sobreposições parciais de vínculos conservam trechos válidos exclusivos.
- Fichas e avaliações anteriores continuam recuperáveis; IDs/códigos de origem viram aliases de busca. Transferência entre famílias distintas não é unificação. Não oferecer exclusão de pessoa/família com histórico.

### 5. Ficha social versionada — FIC

Em `/families/:id/social-form`, permita consultar versões, preparar uma nova ficha, revisar e publicar. Cada versão é uma fotografia completa da família e dos membros na data do preenchimento. Mostre data do fato, publicação, versão e autor separadamente.

Blocos da demonstração, opcionais e vinculados a uma seleção sintética identificada:

- **Domicílio:** moradia, localização, cômodos/dormitórios, local de risco, tipo de domicílio, construção, piso, energia, abastecimento/tratamento de água, escoamento, lixo, deslocamento e higiene.
- **Economia familiar:** quantidades declaradas de trabalhadores e aposentados/pensionistas, recebimento/nome de auxílio governamental.
- **Economia por membro:** trabalha atualmente, ocupação/bico/pensão e renda declarada. Use `incomeAmount`; a fonte não define periodicidade. Renda ausente não vira zero. Não calcular renda total/per capita ou vulnerabilidade.
- **Educação por membro selecionado:** estuda, escolarização/série e modo de estudo. Não inventar enum de série ou faixa etária quando critério/nascimento forem desconhecidos.
- **Necessidades:** alimento, vestuário, calçado, emprego, apoio médico e outros, com complemento opcional.
- **Situação encontrada:** texto com data e autor, orientando a não inserir conteúdo clínico/religioso não aprovado.
- **Ciência conhecida:** pessoa de referência, assinatura em papel ou método aprovado e data conhecida. Sem assinatura eletrônica. Ausência/data desconhecida não significa consentimento nem recebe a data do lançamento automaticamente.

Preserve as opções domiciliares da fonte, sujeitas à seleção do campo:

| Campo | Opções candidatas |
| --- | --- |
| Moradia | Própria, financiada, alugada, cedida, outros |
| Domicílio | Casa, apartamento, cômodo, outro |
| Construção | Tijolo com/sem reboco, taipa com/sem reboco |
| Piso | Cimento, cerâmica, chão batido, outro |
| Energia | Paga talão, não possui, usa e não paga, cedida por vizinho, contador improvisado, placa solar |
| Abastecimento de água | Paga talão, não paga, cisterna, carro-pipa, rio, poço/nascente |
| Tratamento de água | Filtrada, fervida, cloração, sem tratamento |
| Escoamento | Esgoto, fossa séptica, fossa rudimentar, céu aberto, direto para o rio |
| Lixo | Coletado, queimado/enterrado, céu aberto, outro |
| Deslocamento | Transporte público, moto táxi, bicicleta, moto/carro |
| Higiene | Boa, regular, ruim |

Use códigos em inglês e preserve rótulos históricos. Coleção desconhecida difere de nenhuma opção declarada; esta última exige confirmação explícita. Contagens são declaradas, não inferidas dos membros.

Prepare os contratos de saúde, medicamentos e religião, **desativados por padrão**, omitindo seus campos/conteúdo quando desabilitados. Quando especificamente aprovados, saúde e medicamentos pertencem ao titular daquela versão; evangelização pertence ao membro selecionado e nunca gera presença. Não acrescentar diagnóstico, dose, prescrição ou tratamento.

Estruturas condicionadas: saúde espiritual (equilibrada/influenciada/outra e complemento), saúde física (boa/regular/ruim), problemas físicos declarados, quadro geral, unidade de saúde e agente comunitário; lista de medicamentos com nome e indicação conhecida de fornecimento pelo governo; participação declarada em evangelização por membro. Sem dados de demonstração nesses blocos por padrão. Qualquer habilitação sintética para teste deve ser explícita e continuar separada da liberação para uso real.

Ao mudar a data da ficha, reconstruir sua composição e confirmar a mudança de membros. Copiar versão anterior exige revisão e não mantém automaticamente quem saiu da família. Dados econômicos e escolares apontam para a pessoa daquela versão, sem duplicar cadastros.

Publicação gera versão imutável. Corrigir conteúdo publicado cria nova versão completa, ligada à corrigida e com motivo. Distinguir **“última publicada”** de **“última por data do preenchimento”**. Famílias unificadas preservam fichas com origem e numeração anterior. Em conflito de revisões, reler o contexto e permitir revisar o rascunho em memória.

Coordenação administra versões de seleção dos campos existentes: inclusão, obrigatoriedade, aplicação por família/membro, cardinalidade, perfis, finalidade e referência da decisão. Não é um construtor genérico de formulários. Opções desativadas permanecem legíveis nas versões antigas, sem nova seleção.

Uso real exige `REAL_PERSONAL_DATA` e flags dos blocos habilitadas com as decisões pertinentes. Saúde/medicamentos/religião exigem aprovação específica e proteção reforçada no backend, inclusive criptografia conforme SPEC-FIC e proteção equivalente na auditoria. Campo desabilitado é rejeitado na entrada e omitido de saídas/revisões/auditoria; ocultar na tela é insuficiente. O protótipo não libera dados reais.

### 6. Institutos, projetos e atividades — ATV

Implemente `/projects`, `/projects/:id` e `/activities/:id`, com listagem, filtros, cadastro, edição, detalhe e encerramento com motivo.

Catálogo inicial de institutos: **Criança, Jovem, Esclarecimento e Família, Caridade, Divulgação e Mediunidade**. Coordenação administra nome/ativo, preservando código e histórico. Isso não inclui gestão da Escola Espírita.

Projeto tem nome, um instituto obrigatório, descrição/datas opcionais e situação Ativo/Encerrado. Atividade pertence a projeto e tem nome, natureza Periódica/Pontual, horário previsto em texto quando pertinente, responsável opcional e situação. Responsável é uma conta de operador.

- **Periódica:** lista simples de participantes, encontros, frequência e cobertura. Inscrições têm início/fim, sem sobreposição por pessoa/atividade; reinscrição posterior é outro intervalo.
- **Pontual:** exige tipo e serve apenas ao cadastro/classificação neste MVP. Tipos candidatos: doação de itens, médico, psicológico, fisioterapia, visita domiciliar e outro cadastrado. Não permite inscrições periódicas, encontros, registro de atendimento realizado ou aptidão por esse cadastro.
- Coordenação administra tipos existentes/novos. Tipo/instituto inativo conserva o histórico e não é selecionado em novo cadastro.
- Natureza e projeto de uma atividade ficam protegidos contra mudanças que transportem histórico após registros, inclusive cancelados.
- Encerrar projeto/atividade preserva fatos e encerra as inscrições pertinentes no corte informado. Mostrar efeitos antes de confirmar. Fatos posteriores ao corte exigem revisar a data ou resolver o conflito; não cancelar fatos automaticamente ou inverter intervalos.
- Permitir lançamento tardio/correção de fatos anteriores ao encerramento e dentro da vigência conhecida. Não permitir fatos na data/instante de corte exclusivo ou posteriores.
- Não oferecer reabertura, turmas, vagas, espera, agenda ou geração automática de encontros.

### 7. Encontros, chamada e cobertura — FRQ

Em `/activities/:id/attendance`, selecionar data/hora do encontro e responsável conhecido, resolver participantes/vínculos daquela data e marcar cada pessoa. Abrir/abandonar a tela não cria encontro.

Cada linha começa **Não registrado**, com ações explícitas **Presente** ou **Ausente**. Se houver ação coletiva de marcação, ela precisa ser consciente e visível. A lista de inscritos não gera presença nem ausência automaticamente.

Permita avulso já cadastrado com vínculo válido na data, sem inscrição automática. Se faltar cadastro, orientar sua conclusão por operador com permissão; não criar dados fictícios para vencer a validação.

Confirmação grava o conjunto; permita chamada incompleta ou encontro realizado sem presenças, mantendo a diferença entre ausência, desconhecido e cancelamento. Encontros distintos no mesmo dia são permitidos. Mostre ID, data do fato, lançamento e autor após confirmar.

Corrigir usa o encontro existente, com revisão e motivo. Cancelar exige motivo, preserva marcações e retira o encontro dos cálculos. Encontro cancelado não aceita novas marcações nem reativação. Contexto familiar de uma presença só muda por correção explícita autorizada, nunca por mudança no cadastro atual.

Consulta de frequência mostra encontros pertinentes, presenças, ausências, não registrados e completude. O denominador operacional considera **inscrição válida no encontro ou marcação avulsa explícita** (`ENROLLMENT_OR_RECORDED`), preservando a família histórica do fato. Não inclui encontros anteriores à inscrição apenas por omissão.

`sessionCount = presenceCount + absenceCount + unrecordedCount`, excluindo cancelados/duplicatas. Percentual é desconhecido quando o denominador é zero ou a consulta está incompleta. Exiba contagens conhecidas e identifique lacunas de marcações, encontros ou contexto familiar; não calcule taxa somente sobre as linhas marcadas.

Inclua **Cobertura dos encontros** na atividade: selecionar período civil encerrado, revisar encontros/cancelamentos/lacunas e declarar explicitamente que todos os encontros realizados foram registrados. Exibir autor, data e invalidações. Não é cobertura de presença individual.

A declaração não ocorre automaticamente ao salvar chamada e não marca faltas. Dia em andamento/futuro não pode ser declarado completo. Período encerrado sem encontros pode ter cobertura declarada, sem gerar Não apta automaticamente. Inclusão tardia, correção, cancelamento ou alteração pertinente de inscrição invalida a cobertura afetada.

A confirmação da declaração registra motivo e usa a versão das fontes revisadas. A UI devolve o fingerprint fornecido pelo serviço; se os registros mudaram, exige nova revisão antes de declarar cobertura.

### 8. Política e avaliação de aptidão — APT

Em `/families/:id/eligibility`, mostrar situação na data de referência, política, período, membro(s), atividade(s), contagens, evidências e motivos de pendência. Distinguir prévia atual de avaliações salvas e imutáveis. Consultar não grava avaliação; **Registrar avaliação** é ação explícita.

Regras obrigatórias:

- Sem política vigente: **Pendente**, motivo **Critério não configurado**. A configuração inicial da demonstração também deve estar sem política.
- Basta um membro comprovar o critério para a família ser **Apta**, mesmo com outros membros incompletos.
- Cadastro, inscrição, ficha, religião e atividade pontual não constituem evidência de presença.
- Zero oportunidades ou contexto necessário não resolvido gera **Pendente**. Não transforme falta de informação em negativa.
- Mínimo absoluto: presenças conhecidas suficientes provam aptidão. Abaixo do mínimo, sem cobertura completa há pendência; com cobertura, só há negativa quando nem todas as marcações desconhecidas como presentes alcançariam o mínimo.
- Percentual: exigir universo/cobertura conhecidos; comparar limites inferior e superior considerando marcações desconhecidas. Inferior suficiente, com presença factual, prova aptidão; superior insuficiente prova negativa; demais casos são pendentes. Decisão usa valores exatos, sem arredondamento para aprovar.
- Família só é Não apta se há candidatos pertinentes, nenhum apto, nenhum contexto necessário pendente e todos comprovadamente falham.
- Transferência posterior não leva presenças da família anterior para a atual. Nova política/correção muda nova avaliação, preservando as anteriores.
- **Aptidão não implica prioridade nem garantia de benefício.** Não criar botão de entrega ou concessão.

Em `/settings/eligibility`, somente Coordenação publica política completa, versionada, com vigência, referência da decisão e motivo. Não pré-preencher escolhas como regra institucional.

| Parâmetro | Modalidades suportadas |
| --- | --- |
| Período | Dias corridos, meses civis ou intervalo fixo |
| Mínimo | Número de presenças ≥ 1 ou percentual de 0,01% a 100% |
| Atividades válidas | Seleção explícita e não vazia de atividades periódicas |
| Combinação | Critério em uma atividade ou conjunto combinado por pessoa |
| Membros considerados | Vigentes na referência ou com vínculo no período, sempre preservando família histórica |
| Oportunidades | Inscrição ou marcação explícita; ou todos os encontros realizados durante o vínculo familiar |
| Justificativas | Não suportadas |
| Recesso | Somente encontros registrados; cobertura distingue recesso conhecido de informação ausente |
| Novos participantes | Seguem a modalidade de oportunidades, sem carência adicional |
| Tolerância | Nenhuma |
| Evidência incompleta | Avaliação em três situações, por prova suficiente e limites possíveis |

Dias corridos incluem o dia de referência; meses civis começam no primeiro dia do mês inicial e vão até a referência. Nessas duas modalidades, o fim exclusivo é o dia seguinte à referência. Intervalo fixo usa início/fim informados, limitando o fim exclusivo ao dia seguinte à referência; referência anterior ao início gera pendência. Use a versão vigente na data avaliada. Publicação retroativa exige indicação explícita, motivo e referência; não reescreve avaliações salvas.

Nenhum valor numérico de demonstração é política institucional. Para explorar Apta/Não apta, ofereça um cenário de teste explicitamente identificado, selecionado pelo avaliador da demonstração; ele não substitui o estado inicial sem política. Não criar cache de aptidão no Redis neste MVP.

### 9. Históricos e relatórios — REL

Histórico familiar em `/families/:id/history` e pessoal em `/people/:id/history`: vínculos, titularidade, fichas autorizadas, inscrições, encontros/marcações e avaliações pertinentes. Distinguir fonte, data do fato, lançamento, correções e cancelamentos. O histórico individual não libera dados sociais dos demais membros.

Em `/reports`, disponibilize:

| Consulta | Resultado |
| --- | --- |
| Alcance | Pessoas únicas com presença válida, famílias únicas desses fatos, encontros realizados e quantidade de presenças em unidades separadas |
| Frequência | Encontros pertinentes, presentes, ausentes, não registrados, cobertura e percentual quando conhecido |
| Aptidão | Famílias Aptas, Não aptas e Pendentes na referência, com critério e motivos |
| Qualidade cadastral | Possíveis duplicidades/dados ausentes, abertas/resolvidas, identificação e resolução |

Todo total informa período/referência, filtros, unidade de contagem e data de geração, com acesso aos registros que o compõem. Aplicar os mesmos filtros e permissões no total e no detalhe. Mudança das fontes entre ambos pede atualização, sem apresentar uma lista nova como prova de total antigo.

Dois membros de uma família presentes representam duas pessoas e uma família. Uma pessoa em dois encontros representa uma pessoa e duas presenças. Inscrição sem presença não aumenta alcance. Cancelados e duplicatas reconciliadas não entram nos totais válidos.

Relatórios reutilizam as regras de frequência/aptidão; não recalculam com critérios diferentes. Aptidão classifica o conjunto antes de filtrar/paginar e mantém Pendente separado de Não apta. Taxa global usa oportunidades e não média simples de percentuais individuais. Não há CSV/PDF nesta entrega.

### 10. Auditoria e configurações de operação — AUD/CORE

Ofereça `/audit` e **Histórico de alterações** nos detalhes, com ação, autor, data do fato quando pertinente, lançamento, diferenças antes/depois e motivo. Permita filtros por entidade, autor, ação e período do lançamento, sempre no universo autorizado.

Auditoria acompanha as mutações do MVP, inclusive cadastros, vínculos, ficha, catálogos, chamada, políticas, avaliações salvas, contas/perfis e decisões de habilitação. Autor desativado permanece identificado. Correções acrescentam revisões; eventos não são editáveis/apagáveis pela interface.

A mesma autorização do dado original vale para auditoria, revisões, buscas, contagens e evidências. Motivos livres também podem revelar conteúdo restrito. Não exponha eventos sem diferença autorizada nem credenciais, hashes, tokens ou segredos.

Configurações se limitam a contas/perfis, institutos/tipos, políticas de aptidão e seleção/habilitação dos campos existentes. Decisões registram referência, autor e data. Não apresente uma opção da demonstração como aprovação institucional para usar dados reais.

No backend definitivo, mutação, revisões, auditoria e registro de operação confirmam na **mesma transação PostgreSQL**. Repetição da confirmação não duplica o fato; erro em qualquer parte desfaz o conjunto. O protótipo demonstra esses resultados, mas não comprova atomicidade/concorrência reais.

### 11. Contratos comuns para preparar a integração

Preserve os nomes/conceitos de `Family`, `Person`, `FamilyMembership`, `SocialForm`, `FormMember`, `Institute`, `Project`, `Activity`, `ParticipantEnrollment`, `ActivitySession`, `Attendance`, `AttendanceCoverage`, `EligibilityPolicy`, `EligibilityAssessment`, `UserAccount` e `AuditEntry`. Compartilhe DTOs e schemas necessários, sem exportar modelos Prisma ou segredos para o frontend.

- API `/api/v1`, JSON em camelCase, IDs UUID, enums/códigos técnicos em inglês e tradução na interface.
- Sucesso: `{ data }`; listas: `{ data, pagination: { page, pageSize, total } }`, página inicial 1, tamanho padrão 20 e máximo 100.
- Erro: `{ error: { code, message, details?, requestId } }`; traduzir código e campos, sem exibir mensagem técnica diretamente ao operador.
- Tratar 400 validação, 401 sessão inválida, 403 permissão, 404 recurso fora do universo disponível, 409 conflito/revisão/relatório alterado, 422 regra ou função não habilitada, 429 tentativas excessivas e 503 dependência indisponível.
- Datas civis são `YYYY-MM-DD`; instantes têm offset e normalização UTC. `occurredAt` pertence ao fato; `recordedAt` e `recordedBy` vêm do servidor/sessão na integração real. Fatos realizados não podem estar no futuro.
- Dados opcionais ausentes são `null`, nunca zero/falso inventado. Renda é decimal em string, sem ponto flutuante para cálculo monetário.
- Alterações enviam revisões esperadas. Prévia e confirmação reaproveitam as referências/fingerprints recebidas da API; a UI não inventa a versão do contexto.
- Escritas de negócio usam `Idempotency-Key` UUID e conservam a chave ao repetir após erro de rede. Login, logout e troca da própria senha seguem as exceções de CORE; criação/reset administrativo de conta usam chave.
- Ficha publicada, avaliação salva e versão de política são imutáveis. Consultas GET não geram publicações, avaliações ou eventos de alteração.
- Backend real valida entrada com Zod, autoriza operações/campos e garante integridade com transações/restrições. Controle de menu ou adaptador no navegador não oferece essa garantia.

## Restrições e decisões abertas

Ficam fora: atendimentos pontuais realizados, estoque social, entregas, integração com Bazar, migração do Bússola Social, captação financeira, CRM, vendas, contabilidade, prontuário clínico, gestão da Escola Espírita e módulos próprios de voluntários/RH.

Também ficam fora as evoluções não incluídas: turmas/vagas/espera, agenda, alertas de ficha ou interrupção de frequência, justificativa de ausência, renda total/per capita, compatibilidade por tamanho, prioridade automática, CSV/PDF, auditoria de consultas, upload de documentos e assinatura eletrônica. Não criar menus ou indicadores desses módulos para completar a aparência de um ERP.

Cadastro da natureza pontual e de seus tipos pertence a ATV; isso não inclui registrar sua realização. Relatórios abrangem somente fatos do recorte. “Essencial” na ERS do produto completo não amplia este MVP.

As decisões pendentes permanecem identificadas: DEC-01/LAC-02 para composição/campos cadastrais; DEC-02/LAC-01 para parâmetros de aptidão; DEC-04/LAC-04 para ratificação da organização de projetos; DEC-05/LAC-05 para seleção da ficha; DEC-08/LAC-08 para finalidades, acesso, guarda e dados reais; DEC-10/LAC-10 para condições operacionais. LAC-12 e LAC-13 também condicionam os campos/classificações pertinentes.

Esta entrega usa dados sintéticos. Piloto real exige as decisões aplicáveis, HTTPS, configuração de segredos, backup diário fora do servidor principal e restauração testada antes do piloto, conforme CORE/ERS. Registrar essas pendências na documentação; não inventar botões de backup nem declarar conformidade, segurança ou desempenho medidos sem verificação.

## Verificação e critérios de aceite

Prepare dados fictícios coerentes entre módulos: famílias com vários membros e dados desconhecidos, transferência histórica, ficha em duas versões, pessoas com nomes semelhantes, inscrições temporais, avulso, chamada incompleta, encontro cancelado, atividade encerrada e contas dos quatro perfis. O cenário inicial não tem política de aptidão; cenários adicionais com política são identificados como testes.

Demonstre estas jornadas completas:

1. Entrar, enfrentar troca obrigatória de senha, sair e reconhecer sessão expirada, bloqueio temporário e indisponibilidade.
2. Administrador gerencia contas sem acessar ficha/cadastro; Responsável por Atividade registra chamada sem receber CPF/renda; combinação de perfis recebe a união autorizada.
3. Buscar antes de cadastrar, criar pessoa sem CPF/nascimento, vinculá-la à família e sinalizar desconhecidos sem bloquear o cadastro mínimo.
4. Transferir membro e trocar titular, preservando família das presenças e fotografia da ficha antiga. Um corte retroativo conflitante exige reconciliação.
5. Revisar possíveis duplicidades e unificar com escolhas explícitas, histórico recuperável e contagem única; conflitos não resolvidos bloqueiam a confirmação.
6. Publicar e corrigir ficha em versões distintas; mudança cadastral atual não altera a antiga. Campos sensíveis desabilitados não aparecem por ficha ou auditoria.
7. Criar projeto/atividade periódica, inscrever pessoa, lançar avulso e confirmar chamada com linhas desconhecidas. Abrir/abandonar a tela não cria encontro.
8. Corrigir/cancelar encontro com motivo e refletir o efeito nos relatórios. Repetir a mesma confirmação não cria encontro adicional.
9. Declarar cobertura de período encerrado e invalidá-la por mudança pertinente, mantendo percentual desconhecido quando necessário.
10. Sem política, todas as famílias ficam Pendentes. Em cenário de teste explicitamente configurado, um membro suficiente torna a família Apta; evidência insuficiente permanece Pendente e negativa exige prova.
11. Consultar as três situações de aptidão, abrir evidências e preservar uma avaliação antiga após correção dos fatos.
12. Abrir os registros de cada total, distinguindo pessoas, famílias, encontros e presenças; alteração das fontes pede atualizar total/detalhe.
13. Encerrar atividade preservando lançamentos antigos; natureza pontual não oferece chamada ou atendimento realizado.
14. Consultar alterações com autor, motivo e datas distintas, respeitando projeções de acesso também após desativar o autor.

Use Vitest para regras e limites efetivamente implementados, priorizando vínculos históricos, versões, desconhecidos, frequência, aptidão e permissões. Verifique navegação, formulários e chamada em computador/celular. Execute os scripts de teste, tipos, lint e build que forem criados e pertinentes; informe resultados reais.

Testes de adaptador não comprovam segurança/atomicidade do backend. A integração definitiva exigirá testes HTTP com Fastify e PostgreSQL/Redis de teste para concorrência, rollback, auditoria e revogação. Não declare esses testes executados nesta etapa de interface.

## Entrega solicitada ao Lovable

Entregue a aplicação navegável descrita e um README curto com comandos realmente disponíveis, acesso à demonstração, cenários de teste, persistência/reinicialização dos dados, verificações executadas e pontos de integração pendentes.

Você pode organizar a construção por dependências: base e acesso; cadastro; projetos/atividades; ficha e chamada; cobertura e aptidão; unificação completa, relatórios e auditoria. A sequência não autoriza encerrar a entrega com apenas o painel inicial ou apresentar operações incompletas como concluídas.

Escolha os detalhes de componentes e composição visual que melhor atendam aos fluxos. Preserve os contratos adotados e registre escolhas ainda abertas; não transforme sugestões de layout em novas regras institucionais.

## Referências e rastreabilidade

Os requisitos acima foram consolidados destas fontes. Se elas estiverem disponíveis no projeto do Lovable, consulte-as para os DTOs completos e cenários detalhados. Escopo/stack atuais prevalecem sobre propostas anteriores; PRD é canônico para negócio, ERS detalha requisitos e specs consolidam os contratos adotados.

| Fonte | Seções pertinentes / uso neste prompt |
| --- | --- |
| [AGENTS.md](../../AGENTS.md) | Recorte, stack, invariantes, idiomas e validação |
| [Índice das specs](../specs/README.md) | §§1–5; decisões MVP-D01–07 e limites da implementação |
| [SPEC-CORE](../specs/00-foundation.md) | §§2–8; arquitetura, contratos, demonstração, integração e operação |
| [SPEC-ACS](../specs/01-access.md) | §§1–7; autenticação, matriz de acesso, contas e sessão |
| [SPEC-CAD](../specs/02-registration.md) | §§1–6; cadastro, vínculos, qualidade e unificação |
| [SPEC-FIC](../specs/03-social-forms.md) | §§1–6; campos, versões, seleção e proteção |
| [SPEC-ATV](../specs/04-projects-activities.md) | §§1–5; institutos, projetos, naturezas e inscrições |
| [SPEC-FRQ](../specs/05-attendance.md) | §§1–5; chamada, frequência e cobertura |
| [SPEC-APT](../specs/06-eligibility.md) | §§1–6; políticas, três situações e evidências |
| [SPEC-REL](../specs/07-reports.md) | §§1–6; históricos, unidades, filtros e detalhe dos totais |
| [SPEC-AUD](../specs/08-audit.md) | §§1–6; autoria, revisões, proteção e atomicidade |
| [Matriz de rastreabilidade](../specs/traceability.md) | 53 requisitos incluídos, parcelas de REL e exclusões |
| [PRD 1.1](../PRD-ERP-Luz-da-Esperanca-v1.1.md) | CAP-01–05/11 e parte de CAP-10; RN-01–04/08/09/13/15/16; AC-01–03/08/09; DEC pertinentes |
| [ERS](<../ERS — ERP Social Luz da Esperança.md>) | §§3.2.1–3.2.5, 3.2.10–3.2.11 e lacunas aplicáveis, sempre recortadas pelo MVP |
| [Modelagem](../MODELAGEM-DO-SISTEMA.md) | §1.2, D-01–D-04, D-09–D-10 e §§4.1–4.2 |
| [Ficha de famílias 2025](../ficha_cadastro_familias_2025.md) | Origem dos campos candidatos; presença no papel não comprova aprovação digital |
