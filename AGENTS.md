# ERP Social Luz da Esperança

## Comunicação

- Responda e escreva explicações e documentação do projeto em português do Brasil, de forma direta e técnica.
- Escreva todo o código em inglês, incluindo identificadores, comentários, docstrings, descrições de testes e mensagens técnicas de erros e logs. Textos destinados ao usuário na interface usam português do Brasil.
- Comentários explicam decisões e motivos; evite narrar o código.

## Escopo vigente: MVP

Este projeto acompanha pessoas assistidas e suas famílias no Luz da Esperança. A família é a referência da assistência; a participação em atividades é individual. O MVP é um recorte do produto documentado, definido pelo responsável pelo projeto:

| Área | Incluído no MVP | Referências da ERS |
| --- | --- | --- |
| Cadastro | Pessoas, famílias, vínculos históricos, titularidade, busca e tratamento de duplicidades e dados ausentes | CAD |
| Ficha social | Situação familiar, dados por membro, necessidades e versões da ficha, conforme seleção de campos aprovada | FIC |
| Projetos e atividades | Organização de projetos, atividades, participantes e encontros; frequência e avaliação de aptidão familiar | ATV, FRQ, APT |
| Consultas e relatórios | Históricos, frequência, aptidão, alcance e qualidade cadastral, somente sobre os módulos deste MVP | REL, parcialmente |
| Acesso e auditoria | Autenticação, usuários, perfis, autorização e autoria das alterações | ACS |

Atendimentos pontuais realizados, estoque social, entregas, integração com Bazar e migração do Bússola Social ficam fora deste MVP. A natureza periódica ou pontual de uma atividade pode ser representada no cadastro; isso não inclui implementar o módulo de atendimentos. Consultas e relatórios não devem introduzir módulos excluídos para completar requisitos do produto maior.

Captação financeira, CRM, vendas, contabilidade, prontuários clínicos, gestão da Escola Espírita e módulos próprios de voluntários ou RH também estão fora do escopo. Requisitos desejáveis e evoluções documentadas só entram mediante inclusão explícita na tarefa; o rótulo “Essencial” nos documentos não amplia o recorte acima.

## Autoridade e leitura da documentação

As decisões atuais do responsável pelo projeto sobre recorte e stack prevalecem sobre propostas anteriores. Para regras de negócio, o PRD é canônico; a ERS detalha os requisitos e a modelagem fornece contratos lógicos. Diagramas e propostas não comprovam aprovação institucional.

Leia as seções relacionadas à tarefa antes de implementar ou alterar comportamento:

- **Implementação do MVP:** [Índice das specs](docs/specs/README.md), SPEC-CORE e a spec do módulo alterado, incluindo os contratos de suas dependências. O índice registra as decisões de desenho adotadas; DEC/LAC ainda condicionam o uso real quando indicado.
- **Escopo, regras e aceite:** [PRD 1.1](docs/PRD-ERP-Luz-da-Esperanca-v1.1.md), especialmente CAP, RN, AC e DEC pertinentes ao MVP.
- **Funcionalidades:** [ERS](<docs/ERS — ERP Social Luz da Esperança.md>), §§3.2.1–3.2.5, 3.2.10–3.2.11 e lacunas relacionadas. Aplique apenas a parte de REL compatível com o recorte.
- **Modelos e histórico:** [Modelagem](docs/MODELAGEM-DO-SISTEMA.md), convenções comuns, D-01–D-04, D-09–D-10 e contratos de duplicidade e relatórios. As frentes BC, FRQ e AD são divisões documentais de responsabilidade, não serviços independentes.
- **Campos da ficha:** [Ficha de Cadastro de Famílias 2025](docs/ficha_cadastro_familias_2025.md). Sua presença no formulário não torna o campo obrigatório nem autoriza sua coleta digital.
- **Fundamentação ou comparação de sistemas:** [Bibliografia](docs/Bibliografia-ERP-Social-v1.1.md) e [Pesquisa documental](docs/Pesquisa-Documental-Sistemas-ERP-Social.md). São contexto, não novas fontes de requisitos.

Quando uma divergência afetar a implementação, aplique essa hierarquia e registre o tratamento na documentação pertinente. Políticas institucionais ainda abertas permanecem identificadas por DEC/LAC; não as apresente como aprovadas.

## Stack e arquitetura

- Linguagem: TypeScript no frontend, backend e pacotes compartilhados.
- Frontend: React, Tailwind CSS e React Router.
- Backend: Node.js e Fastify; Zod para validação, jose para tokens e bcrypt para hash de senhas.
- Persistência: PostgreSQL com Prisma; Redis como infraestrutura auxiliar, com responsabilidade definida quando necessário. PostgreSQL é a fonte persistente dos registros de negócio; Redis não substitui histórico ou auditoria.
- Testes: Vitest.
- Organização: monorepo com backend monolítico modular. Separe módulos por responsabilidade de negócio dentro da mesma aplicação; não introduza microserviços.

Organize frontend, backend e código compartilhado em limites claros. Compartilhe contratos necessários, preservando modelos de persistência e segredos no backend. A interface acessa a API, nunca Prisma ou o banco diretamente. Rotas Fastify validam entradas e encaminham operações aos módulos de negócio; regras de aptidão e histórico não pertencem a componentes React.

O repositório está na fase documental: ainda não há aplicações, manifestos ou scripts de execução. A base a construir e os comandos previstos estão em SPEC-CORE. Ao implementar, fixe versões compatíveis e documente os comandos realmente disponíveis; descubra os comandos de execução nos manifestos e configurações criados, sem tratar entregáveis previstos como scripts já existentes.

## Invariantes do MVP

### Cadastro e ficha

- Diferencie pessoa assistida de conta de usuário. Ser operador não cria cadastro assistencial nem vínculo familiar.
- Preserve a vigência dos vínculos e a família associada a cada fato histórico. Mudar a composição ou o titular atual não transfere fatos anteriores para outra família.
- Conte membros por pessoas distintas com vínculo vigente na data consultada. A implementação segue a pertença vigente única de SPEC-CAD; a ratificação institucional de composição e titularidade permanece em DEC-01/LAC-02 antes do uso real.
- Busque possíveis duplicidades antes de cadastrar; semelhança não autoriza fusão automática. Unificação exige autorização, motivo, reconciliação de conflitos e histórico recuperável.
- Represente dados desconhecidos como desconhecidos: ausência não equivale a zero, falso ou ausência em encontro. Não invente nascimento, CPF ou outros valores para satisfazer validações; obrigatoriedade segue a decisão de campos pertinente.
- Mantenha versões datadas da ficha e sua composição familiar. Dados individuais pertencem ao membro daquela versão; alterações no cadastro atual não reescrevem fichas antigas.

### Atividades, frequência e aptidão

- Projetos contêm atividades. Inscrição em atividade é distinta de presença em um encontro. A natureza da atividade não muda após registros; encerramento preserva o histórico.
- Registre presença por pessoa e encontro, evitando contagem duplicada. Correções e cancelamentos têm motivo e autoria; encontros cancelados deixam de compor a frequência válida.
- Basta um membro satisfazer o critério vigente para a família ser apta. Aptidão não implica prioridade nem garantia de benefício.
- Avalie aptidão na data de referência e exponha política, membro, atividade, período e evidências utilizados. Preserve as versões e a vigência do critério.
- Frequência mínima, período e atividades válidas dependem de DEC-02/LAC-01, sem valores presumidos. Sem política configurada, a situação é Pendente. Evidência insuficiente não equivale automaticamente a Não apta.
- Cadastro, inscrição, atendimento pontual e recebimento de doação não constituem presença nem renovam aptidão. O efeito de justificativas de ausência depende de decisão institucional.
- Se reutilizar avaliações via Redis, invalide resultados quando tempo, política, vínculos, presenças ou cancelamentos afetarem sua validade.

### Consultas, acesso e auditoria

- Totais informam período, filtros e unidade de contagem e permitem recuperar os registros que os compõem. Diferencie pessoas únicas, famílias únicas, encontros e presenças; aplique correções e cancelamentos aos resultados.
- Faça autorização no backend para operações e dados retornados, incluindo buscas, relatórios, histórico e auditoria. Ocultar elementos na interface não substitui essa verificação.
- Use contas individuais. Desativar usuário preserva a autoria anterior; administrar contas não concede automaticamente acesso à ficha social.
- Grave alterações relevantes e sua auditoria na mesma transação PostgreSQL, identificando autor, data, valores anterior e novo e motivo quando aplicável. Preserve separadamente a data do fato e a do lançamento.
- Proteja a auditoria conforme os dados que contém. Senhas, hashes de senha, tokens e segredos não entram em respostas, logs ou snapshots de auditoria.
- Antes do uso de dados pessoais reais, resolva DEC-08/LAC-08 e as lacunas aplicáveis à função. Desenvolvimento, testes e demonstrações usam dados sintéticos enquanto essas decisões estiverem abertas.
- Saúde, medicamentos e religião dependem de aprovação específica de campos, finalidade e acesso em DEC-05/DEC-08. Campos livres não contornam essa restrição. Guarda e eliminação também abrangem versões, auditoria e cópias.

## Implementação e validação

- Mantenha regras de negócio testáveis separadas de React, Fastify e persistência. Valide entradas externas com Zod e use restrições e transações de banco para integridade sob concorrência.
- Segredos e credenciais vêm de variáveis de ambiente. Use bcrypt para senhas e jose para validar tokens conforme a configuração de autenticação definida no backend.
- Ao mudar comportamento, valide com Vitest as regras e limites afetados. Priorize vínculos históricos, versões da ficha, presença versus inscrição, aptidão pendente, autorização e atomicidade da auditoria conforme a tarefa.
- Execute os scripts de teste, verificação de tipos, lint e build pertinentes que existirem. Informe verificações executadas e limitações reais; alterações apenas documentais exigem revisão de conteúdo e links, sem testes que fixem a redação.

## Commits

Após cada atualização de código, configuração ou documentação do projeto, inclua na resposta final uma sugestão de mensagem de commit em inglês, no padrão abaixo, que descreva as alterações realizadas.

Mensagens seguem Conventional Commits:

```text
<type>[optional scope]: <description>
```

Escreva todas as mensagens de commit em inglês, incluindo escopo, descrição e corpo, quando houver. Use tipos como `feat`, `fix`, `docs`, `refactor`, `test`, `build`, `ci` e `chore`; escopo, quando usado, identifica o módulo alterado. Exemplos:

```text
feat(registration): add family memberships with validity periods
fix(eligibility): keep assessment pending without a configured policy
docs: define MVP scope and project conventions
```
