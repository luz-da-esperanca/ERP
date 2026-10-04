# ERP Social Luz da Esperança

## Forma de trabalho

- Mantenha alterações limitadas à tarefa, verificáveis e reversíveis; preserve comportamento não afetado e evite refatorações paralelas.
- Em tarefas técnicas com comportamento definido, implemente e valide diretamente. Para ambiguidades locais, registre a premissa adotada. Se uma lacuna sem decisão vigente afetar comportamento, contratos, autorização, estados ou arquitetura, esclareça-a antes de implementar a parte dependente; prossiga com o trabalho independente já autorizado.

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

Em caso de conflito, aplique esta ordem:

1. Instrução explícita atual do usuário, incluindo decisões de recorte e stack.
2. Documentação vigente pertinente à tarefa, respeitando a autoridade das fontes abaixo.
3. Testes que representam comportamento intencionalmente preservado.
4. Implementação existente.

Para regras de negócio, o PRD é canônico; a ERS detalha os requisitos e a modelagem fornece contratos lógicos. As specs consolidam as decisões de implementação adotadas. Código ou teste desatualizado não substitui uma decisão explícita; registre o tratamento da divergência na documentação pertinente. Diagramas e propostas não comprovam aprovação institucional. Políticas abertas permanecem identificadas por DEC/LAC.

Leia os arquivos diretamente afetados e as instruções aplicáveis ao seu caminho. Carregue apenas as seções e dependências necessárias para a tarefa, sem reler documentos inteiros já conhecidos. Quando existirem, consulte `package.json` para scripts/dependências, README para convenções de execução e configurações TypeScript ao alterar build, resolução de módulos, imports, aliases ou checagem de tipos.

- **Implementação do MVP:** consulte o [Índice das specs](docs/specs/README.md), as seções pertinentes de [SPEC-CORE](docs/specs/00-foundation.md) e a spec do módulo alterado, incluindo os contratos das dependências afetadas. O índice registra as decisões adotadas; DEC/LAC ainda condicionam o uso real quando indicado.
- **Escopo, regras e aceite:** [PRD 1.1](docs/PRD-ERP-Luz-da-Esperanca-v1.1.md), especialmente CAP, RN, AC e DEC pertinentes ao MVP.
- **Funcionalidades:** [ERS](<docs/ERS — ERP Social Luz da Esperança.md>), §§3.2.1–3.2.5, 3.2.10–3.2.11 e lacunas relacionadas. Aplique apenas a parte de REL compatível com o recorte.
- **Modelos e histórico:** [Modelagem](docs/MODELAGEM-DO-SISTEMA.md), convenções comuns, D-01–D-04, D-09–D-10 e contratos de duplicidade e relatórios. As frentes BC, FRQ e AD são divisões documentais de responsabilidade, não serviços independentes.
- **Campos da ficha:** [Ficha de Cadastro de Famílias 2025](docs/ficha_cadastro_familias_2025.md). Sua presença no formulário não torna o campo obrigatório nem autoriza sua coleta digital.
- **Fundamentação ou comparação de sistemas:** [Bibliografia](docs/Bibliografia-ERP-Social-v1.1.md) e [Pesquisa documental](docs/Pesquisa-Documental-Sistemas-ERP-Social.md). São contexto, não novas fontes de requisitos.

## Stack e arquitetura

- Linguagem: TypeScript no frontend, backend e pacotes compartilhados.
- Frontend: React, Tailwind CSS e React Router.
- Backend: Node.js e Fastify; Zod para validação, jose para tokens e bcrypt para hash de senhas.
- Persistência: PostgreSQL com Prisma; Redis como infraestrutura auxiliar, com responsabilidade definida quando necessário. PostgreSQL é a fonte persistente dos registros de negócio; Redis não substitui histórico ou auditoria.
- Testes: Vitest.
- Organização: monorepo com backend monolítico modular. Separe módulos por responsabilidade de negócio dentro da mesma aplicação; não introduza microserviços.

Organize frontend, backend e código compartilhado em limites claros. Compartilhe contratos necessários, preservando modelos de persistência e segredos no backend. A interface acessa a API, nunca Prisma ou o banco diretamente. Rotas Fastify validam entradas e encaminham operações aos módulos de negócio; regras de aptidão e histórico não pertencem a componentes React.

O monorepo usa `apps/web`, `apps/api` e `packages/contracts`, com **pnpm workspaces**. Documentação fica em `docs/`; comandos de execução e o estado dos módulos estão no [README](README.md). Mantenha versões compatíveis fixadas e documente comandos reais. Descubra pontos de entrada e localização dos testes nas configurações dos pacotes. A demonstração em memória do frontend não comprova implementação nem autorização no backend.

### Organização do código

Organize cada aplicação por feature/responsabilidade de negócio. No backend, quando a feature precisar dessa separação, use:

| Diretório na feature | Responsabilidade |
| --- | --- |
| `domain` | Regras e conceitos de negócio, sem dependência de framework, I/O ou infraestrutura |
| `application` | Casos de uso e orquestração; contratos necessários nas fronteiras com efeitos externos |
| `infra` | Implementações de adaptadores, gateways, repositórios e controllers/rotas |

Crie apenas as pastas necessárias; camadas globais `domain`, `application` e `infra` não substituem a divisão por feature. Mantenha erros e contratos próximos da responsabilidade a que pertencem. Compartilhe somente contratos usados entre módulos/aplicações.

Os testes ficam em `test/` na raiz da respectiva aplicação ou pacote, espelhando a hierarquia de `src/`. Por exemplo, `src/features/access/domain/permissions.ts` é verificado em `test/features/access/domain/permissions.test.ts`; integrações seguem o mesmo caminho com sufixo `.integration.test.ts`. Separe os arquivos por módulo e responsabilidade; fixtures e preparação compartilhadas ficam em `test/support/`.

Dependências apontam para as regras e contratos internos; efeitos externos ficam explícitos nas fronteiras. Prefira composição e abstrações justificadas pelo contrato ou pela necessidade de teste; não crie interface/repositório por entidade ou camadas vazias por padrão. Regras de negócio não ficam em controllers, gateways ou implementações de persistência.

### Nomenclatura e TypeScript

- Use `camelCase` para variáveis, funções, métodos, propriedades, parâmetros e constantes locais; `PascalCase` para classes, interfaces, tipos, enums e componentes React.
- Use `kebab-case` em novos arquivos e diretórios de código, preservando nomes exigidos por ferramentas e arquivos documentais existentes. Identificadores e contratos não mudam de convenção por causa do caminho: `socialForms` pode corresponder à pasta `social-forms`; códigos/enums de API continuam conforme CORE.
- Conceitos de domínio representados por uniões de literais recebem tipos nomeados, próximos de sua feature ou no pacote de contratos quando compartilhados.
- Configure TypeScript estrito na base e preserve essa configuração. Siga o sistema de módulos e os aliases efetivamente configurados; use `#src/*` somente se adotado pelo pacote. Imports de módulos nativos Node.js usam o prefixo `node:`.
- Justifique novas dependências pelo problema concreto. ESLint, Prettier e bibliotecas auxiliares de teste só são tratados como disponíveis após sua configuração nos manifestos.

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
- SPEC-APT não usa cache de aptidão no MVP. Se essa evolução for incluída, a reutilização exige invalidação por tempo, política, vínculos, inscrições, presenças, cancelamentos, cobertura e unificação que afetem o resultado.

### Consultas, acesso e auditoria

- Totais informam período, filtros e unidade de contagem e permitem recuperar os registros que os compõem. Diferencie pessoas únicas, famílias únicas, encontros e presenças; aplique correções e cancelamentos aos resultados.
- Faça autorização no backend para operações e dados retornados, incluindo buscas, relatórios, histórico e auditoria. Ocultar elementos na interface não substitui essa verificação.
- Use contas individuais. Desativar usuário preserva a autoria anterior; administrar contas não concede automaticamente acesso à ficha social.
- Grave alterações relevantes e sua auditoria na mesma transação PostgreSQL, identificando autor, data, valores anterior e novo e motivo quando aplicável. Preserve separadamente a data do fato e a do lançamento.
- Proteja a auditoria conforme os dados que contém. Senhas, hashes de senha, tokens e segredos não entram em respostas, logs ou snapshots de auditoria.
- Antes do uso de dados pessoais reais, resolva DEC-08/LAC-08 e as lacunas aplicáveis à função. Desenvolvimento, testes e demonstrações usam dados sintéticos enquanto essas decisões estiverem abertas.
- Saúde, medicamentos e religião dependem de aprovação específica de campos, finalidade e acesso em DEC-05/DEC-08. Campos livres não contornam essa restrição. Guarda e eliminação também abrangem versões, auditoria e cópias.

## Implementação e validação

- Valide entradas externas com Zod e use restrições e transações de banco para integridade sob concorrência. Segredos e credenciais vêm de variáveis de ambiente; autenticação segue SPEC-ACS.
- Para comportamento novo ou alterado, adicione/ajuste testes Vitest de resultados, contratos e limites. Correções incluem regressão quando viável. Priorize vínculos históricos, versões da ficha, presença versus inscrição, aptidão pendente, autorização e auditoria conforme a tarefa; preserve testes intencionais, sem enfraquecê-los apenas para obter sucesso.
- Teste regras de `domain` e orquestração de `application` por unidade; contratos HTTP com Fastify `inject`; fronteiras de `infra` por integração quando pertinente. Use PostgreSQL de teste para atomicidade, concorrência, unicidade e vigências, e Redis de teste para sessões/revogação. Mocks não comprovam essas garantias.
- Mantenha testes determinísticos e isolados, verificando comportamento observável. Use doubles nas fronteiras externas, sem substituir regras internas do domínio. Prefira stub, fake ou `vi.fn()` quando suficientes; `vitest-mock-extended` cabe quando mocks tipados de fronteiras trouxerem ganho concreto, com dependência justificada. Dificuldade de testar uma regra é motivo para revisar seu acoplamento.
- Execute scripts oficiais do pacote com pnpm: testes direcionados, verificação de tipos, lint, suíte pertinente e build quando afetado, conforme os comandos existentes. Amplie para todo o repositório quando contratos compartilhados, mudanças transversais, falhas ou verificações obrigatórias exigirem.
- Informe verificações executadas, limitações e a razão quando não houver teste automatizado novo/ajustado. Alterações apenas documentais exigem revisão de conteúdo e links, sem testes que fixem a redação. A tarefa termina com o escopo autorizado concluído e a validação pertinente realizada, ou com um impedimento concreto identificado.

## Commits

Após alterar código, testes, configuração ou documentação, sugira na resposta final um commit conciso em inglês, alinhado ao escopo, seguindo Conventional Commits:

```text
<type>[optional scope]: <description>
```

Escopo, descrição e eventual corpo ficam em inglês. Use o tipo correspondente à mudança (`feat`, `fix`, `docs`, `refactor`, `test`, `build`, `ci` ou `chore`); o escopo identifica o módulo quando aplicável.
