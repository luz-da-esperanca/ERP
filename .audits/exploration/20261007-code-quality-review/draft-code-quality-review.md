# Revisão de qualidade de código: code smells, arquitetura e design (2026-10-07)

## 1. Contexto e método

Documento de auditoria somente-leitura sobre o estado do código do monorepo em relação a `AGENTS.md` e às specs vigentes. Foram consolidados **85 achados** produzidos em 8 fatias independentes de exploração, executadas em 2026-10-07 sobre o commit `8e8c49d` (2026-10-07):

| Fatia | Superfície | Artefato |
| --- | --- | --- |
| 01 | Arquitetura do backend (camadas, imports, composição) | `01_analysis_backend-architecture.md` |
| 02 | Features do backend (regras, transação, erros, autorização) | `02_analysis_backend-features.md` |
| 03 | Persistência e infraestrutura (schema, UoW, Redis, startup) | `03_analysis_persistence-infra.md` |
| 04 | Frontend web (`apps/web`) | `04_analysis_frontend.md` |
| 05 | Contratos compartilhados (`packages/contracts`) | `05_analysis_contracts.md` |
| 06 | Testes | `06_analysis_tests.md` |
| 07 | Tooling/build/CI | `07_analysis_tooling-config.md` |
| 08 | Contexto divergente (código × documentação) | `08_analysis_context-mismatch.md` |

**Executado vs. análise estática.** A análise é majoritariamente estática. Foram executados por algumas fatias: `pnpm lint` (exit 0 — fatias 01, 04, 07), `pnpm format:check` (exit 1, 409 arquivos — fatia 07), `pnpm --filter @erp/web typecheck` (exit 0), a suíte de `apps/web/test` (44 arquivos / 202 testes) e `vite build` (exit 0) — fatia 04. **Não** foram executados `pnpm test`, `pnpm typecheck` e `pnpm build` da raiz nem a suíte de integração: gerariam `src/generated`/`dist` ou dependem de ambiente com banco. Inferências (ex.: deadlock não reproduzido; comportamento do 413 lido no fonte do Fastify) estão marcadas como tal nos achados em que aparecem.

**Autoridade.** As severidades e a taxonomia seguem os artefatos das fatias; o julgamento de aderência usa a hierarquia de `AGENTS.md` (instrução explícita do usuário > documentação vigente > testes intencionais > implementação), com o PRD para regras de negócio, a ERS para requisitos e as specs (`docs/specs/`, `docs/api/`) para contratos. Rótulos DEC/LAC e decisões registradas como intencionais **não** são tratados como code smell — aparecem apenas em Decisões em aberto quando permanecem sem resposta.

**Escopo.** A lista de features faltantes do MVP está fora deste documento (coberta por `.audits/exploration/20261005-mvp-gap-analysis/`); aqui o foco é a qualidade do código existente. Tarefa documental: nenhum teste automatizado novo, por decisão registrada.

## 2. Visão geral

A base é sólida onde a documentação exige rigores: `domain`/`application` puros (zero framework/Prisma), ESLint com `--max-warnings 0` e teste próprio em `test/eslint-config.test.ts`, Zod na borda (220 `.strict()`), autorização em 89 de 91 handlers, transações `serializable` com `FOR UPDATE` e revalidação do autor, zero `TODO/FIXME/HACK/any`, suíte espelhando `src/` com Postgres/Redis reais para as garantias que mocks não comprovam. Os problemas se concentram em três eixos: (1) **pontos de acoplamento e contrato sem decisão registrada** — `core` importa erros de 7 features, imports cross-feature sem regra que os autorize ou proíba, três fachadas HTTP paralelas no web e vocabulário de auditoria declarado em ≥7 lugares com divergência comprovada; (2) **falhas operacionais verificáveis** — `format:check` quebrado por EOL, suíte de integração inexecutável no Windows, ausência total de CI/hooks, health estático e Redis sem reconexão; (3) **camada de apresentação do web divergente do contrato** — tradução de erro que descarta `details`, prévia de duplicidade de pessoa preparada mas nunca executada na UI e superfície morta da era demo sustentada por testes próprios.

## 3. Achados

Severidades: **crítico | alto | médio | baixo**, preservadas dos artefatos. Os links de evidência são relativos à localização final do documento (`docs/plans/`).

### 3.1 Arquitetura e camadas (ARQ) — 7

#### ARQ-01. O núcleo `src/core` depende das features — severidade: médio

- **Evidência:** [error-mapper.ts](../../src/core/presentation/error-mapper.ts):1-46 (importa classes de erro de 7 features: attendance, access, eligibility, reports, registration, projects, social-forms), [authenticate-request.ts](../../src/core/presentation/authenticate-request.ts):3 (`Principal` de `features/access/application/ports.js`), `src/core/infra/operation-fingerprint.ts:3` (`OperationFingerprints` de `features/access/application/account-transactions.js`); `README.md:53-56,107` descreve `core/` sem essa dependência. Sobreposição 01/02 (o comportamento do mapeador é BE-01/BE-06).
- **Problema:** o núcleo não é uma base estável — ele aponta para dentro das features; `error-mapper.ts` é uma cadeia de `instanceof` de 236 linhas que precisa ser editada a cada nova classe de erro de feature, e a documentação não registra essa dependência.
- **Impacto no contexto do MVP:** ponto único de conflito e de revisão para todas as features (inclusive FIC/ATV/FRQ/APT/REL, cujos erros já passam por aqui); qualquer refatoração de `access` toca o núcleo, num arquivo sem dono de feature.
- **Recomendação:** aceitar o mapeador central (coerente com o único `setErrorHandler`) e documentar a decisão na SPEC-CORE/README, ou compor `mapError` a partir de mappers por feature registrados em `app.ts` e mover os tipos transversais de `access` consumidos por `core` a um módulo compartilhado.

#### ARQ-02. Reuso direto de regras de domínio entre features, sem decisão registrada — severidade: médio

- **Evidência:** [frequency-rules.ts](../../src/features/attendance/domain/frequency-rules.ts):1,3 (`civilDateAt` de projects, `isMembershipCurrent` de registration), [policy-rules.ts](../../src/features/eligibility/domain/policy-rules.ts):1-2, `src/features/eligibility/domain/evaluate-eligibility.ts:10`, `src/features/registration/application/membership-reconciliation-service.ts:24-25`; `docs/specs/00-foundation.md:19` (consultas entre módulos usam contratos/projeções); `eslint.config.mjs:53-83` (não bloqueia `domain`→`domain` cross-feature).
- **Problema:** não existe decisão que autorize — nem que proíba — import direto de **regras** de domínio entre features; o ESLint também não cobre essa direção.
- **Impacto no contexto do MVP:** as invariantes de frequência/aptidão dependem desse grafo (attendance→registration/projects; eligibility→attendance/registration); hoje não há ciclo de runtime (retornos são `import type`), mas um novo import com valor criaria um ciclo silencioso e dificulta evoluir features isoladamente.
- **Recomendação:** registrar a decisão na SPEC-CORE (aceitar como característica do monólito ou restringir); se aceito, extrair helpers puros transversais (`civilDateAt`, `nextCivilDay`, `isMembershipCurrent`) para módulo de domínio compartilhado e cobrir a regra em `test/eslint-config.test.ts`.

#### ARQ-03. `features/demo-seed/infra` depende do composition root e mistura papéis de camada — severidade: médio

- **Evidência:** [showcase-seed.ts](../../src/features/demo-seed/infra/showcase-seed.ts):4 (`import type { createRuntime }` de `../../../runtime.js`) e `:80-99`; `seed-client.ts:4,7,29,52` (tipo `SeedRuntime` derivado do runtime completo, `runtime.app.inject(...)`, leitura direta de Prisma); `showcase-data.ts:18`; `seed-environment.ts:2` (filesystem via `node:fs/promises`); `eslint.config.mjs:172-188` (a regra de `infra` só bloqueia `**/presentation/**`).
- **Problema:** o diretório `infra` dessa feature não implementa portas de domínio — abriga um cliente HTTP da própria API, um guard de ambiente com I/O e leitura de Prisma, além de importar o módulo de composição, papel que `AGENTS.md:72` não prevê para `infra`.
- **Impacto no contexto do MVP:** o seed é a fonte dos dados sintéticos exigidos enquanto DEC-08/LAC-08 estiverem abertas e o caminho documentado para a demo; o acoplamento ao objeto runtime inteiro e às formas de rota torna o seed frágil diante de qualquer mudança de composição ou contrato.
- **Recomendação:** tipar um `SeedRuntime` mínimo (só `app`, `database`, `accounts`, `access`), mover a ferramenta para uma entrada fora de `src/features/` (ex.: `src/seed/`) ou adicionar regra ESLint que impeça `**/runtime.js` em `domain`/`application`/`infra`, com espelho no teste de configuração.

#### ARQ-04. Contrato transversal `OperationFingerprints` vive dentro da feature `access` — severidade: baixo

- **Evidência:** definição em [account-transactions.ts](../../src/features/access/application/account-transactions.ts):98; consumidores: `src/core/infra/operation-fingerprint.ts:3`, `src/runtime.ts:18` e services de registration, attendance, projects, reports, eligibility e social-forms (10 imports no total).
- **Problema:** um contrato usado por todas as features e pelo núcleo está encerrado numa única feature (`AGENTS.md:74` manda compartilhar somente contratos usados entre módulos — o contrato é compartilhado, o local não).
- **Impacto no contexto do MVP:** toda feature que grava dados com autor, data de lançamento e fingerprints de auditoria depende de `features/access/application`; mudança nessa pasta recompila/afeta o backend inteiro.
- **Recomendação:** mover a interface `OperationFingerprints` para `core/application` (mantendo `createOperationFingerprints` em `core/infra`) e atualizar os imports; `Principal` de `access` permanece onde está.

#### ARQ-05. Lacunas de cobertura das regras de import do ESLint — severidade: baixo

- **Evidência:** [eslint.config.mjs](../../eslint.config.mjs):22-213; contratos `@erp/contracts/*-api` importados em `infra` de 17 arquivos (ex.: `src/features/audit/infra/audit-store.ts:6-18`, `src/features/registration/infra/prisma-registration.ts:34,43`, `src/features/reports/infra/prisma-reports.ts:1`); composition root em `infra` (`src/features/demo-seed/infra/showcase-seed.ts:4`); `src/main.ts`, `src/bootstrap.ts`, `src/seed.ts` e `src/runtime.ts` fora de qualquer bloco de restrição.
- **Problema:** `infra` pode importar `../runtime.js`/`src/app.ts` sem ser detectado pelo lint (hoje só `demo-seed` o faz) e os adaptadores Prisma consomem schemas de DTO HTTP sistematicamente. O risco de `audit-store.ts` montar snapshots de auditoria com DTOs de outras camadas é **inferência** a partir do código — nenhuma falha observada.
- **Impacto no contexto do MVP:** regressão silenciosa (um import futuro de `runtime` a partir de `domain`/`application` passaria no lint e no typecheck) e mudança num schema `*-api` público reorganizando serialização de persistência/auditoria sem passar pela fronteira de validação da rota.
- **Recomendação:** decidir e registrar se `infra` pode consumir `@erp/contracts/*-api`; adicionar `**/runtime.js` e `**/app.ts` às restrições de `domain`/`application`; espelhar em `test/eslint-config.test.ts` que as entradas de composição ficam livres por decisão (ver TOOL-05, TOOL-11, BE-05).

#### ARQ-06. Guard de dados reais consultado a cada requisição, sem cache — severidade: baixo

- **Evidência:** [app.ts](../../src/app.ts):111-113 (`services.dataMode.assertEnabled()` em `onRequest` para toda rota exceto `/api/v1/health`), `src/core/application/data-mode.ts:16-21` (retorno antecipado só em `SYNTHETIC`), `src/core/infra/prisma-feature-decisions.ts:6-13` (`featureDecision.findUnique` por chamada).
- **Problema:** em `DATA_MODE=REAL` cada requisição acrescenta uma consulta PostgreSQL além da autenticação/sessão, sem cache nem decisão documentada sobre o guard (diferente do cache de aptidão, explicitamente fora do MVP).
- **Impacto no contexto do MVP:** o comportamento desejável é fail-closed (nada de dado pessoal real sem decisão registrada) e está correto; o custo de latência/carga é **inferência** — não medi.
- **Recomendação:** manter o guard; se latência aparecer, aplicar cache curto com invalidação explícita e registrar a decisão.

#### ARQ-07. Services de `application` com alto tamanho e coesão duvidosa — severidade: baixo

- **Evidência:** [registration-service.ts](../../src/features/registration/application/registration-service.ts) (1133 linhas), `attendance-service.ts` (978), `projects-service.ts` (941), `social-forms-service.ts` (908); desdobramentos já existentes no mesmo diretório (`attendance/application/coverage-invalidation.ts`, `access/application/account-commands.ts`, `registration/application/{identity-merge,membership-reconciliation,missing-data}-service.ts`).
- **Problema:** um arquivo concentra autorização, idempotência, revisão, orquestração transacional e projeção de uma feature inteira; `AGENTS.md:78` pede preferir composição justificada por contrato ou necessidade de teste.
- **Impacto no contexto do MVP:** revisar que autor revalidado sob bloqueio, auditoria e conclusão na mesma transação estão aplicados em todos os caminhos fica mais difícil quando os caminhos estão num único arquivo longo — observação de manutenção, não violação.
- **Recomendação:** desdobrar por caso de uso/grupo de operações quando uma tarefa já tocar a feature, sem refatoração paralela a outras frentes (`AGENTS.md:5`).

### 3.2 Backend/features (BE) — 13

#### BE-01. Falha na validação de saída responde 400 VALIDATION_ERROR ao cliente — severidade: médio

- **Evidência:** [error-mapper.ts](../../src/core/presentation/error-mapper.ts):210-220 (qualquer `z.ZodError` → `400`/`VALIDATION_ERROR`/`Invalid request`), `:217-218` (`.filter(Boolean)` descarta `path` vazio); mesmos objetos usados para parse de saída em `access-routes.ts:64,68,73,86,92,105,120`, `attendance-routes.ts:34,46,58,72,88,100,110,125,131,137,148`, `projects-routes.ts:52,64,86,98`, `social-forms-routes.ts:58,81,106,117`; `app.ts:131-135` só registra no log quando `failure.status === 500`.
- **Problema:** o `ZodError` não carrega a origem da validação — derivação de contrato (nosso bug) vira requisição inválida para o cliente e não gera registro no servidor; `fields` aponta campos do payload de resposta e um corpo que deveria ser objeto e é array devolve `fields: []`.
- **Impacto no contexto do MVP:** quando um DTO novo divergir do serviço, o sintoma em integração e na interface é requisição inválida, o que desvia a investigação para o cliente e esconde a regressão no log; não afeta dados nem autorização.
- **Recomendação:** separar as duas origens com um invólucro `parseOutput(schema, value)` que, ao falhar, relança erro de aplicação (500 com log), mantendo o `ZodError` de entrada como 400.

#### BE-02. Preâmbulo de idempotência e revalidação do autor duplicado nove vezes em `registration-service.ts` — severidade: médio

- **Evidência:** [registration-service.ts](../../src/features/registration/application/registration-service.ts):119-184, 186-300, 313-399, 426-577, 586-722, 762-849, 851-916, 945-1065, 1079-1135 (mesmo bloco `authorizedActor` → `fingerprints.calculate` → `findOperation` → checagem → `createOperation` → trabalho → `completeOperation`); helpers equivalentes únicos em `attendance-service.ts:79`, `projects-service.ts:111`, `eligibility-service.ts:59`, `social-forms-service.ts:71-133` e `access/application/account-commands.ts`.
- **Problema:** qualquer ajuste de contrato de idempotência (ex.: passar `fingerprintKeyId`, mudar a ordem revalidação/fingerprint) precisa de 9 edições coerentes, sem o teste de contrato que o helper compartilhado permitiria; `registration` é a única feature grande sem helper de comando.
- **Impacto no contexto do MVP:** CAD concentra as escritas de pessoas, famílias e vínculos; divergência entre caminhos produziria replay/conflito distinto para a mesma `Idempotency-Key`. Não é defeito ativo: os 9 blocos estão coerentes entre si (verificados por leitura).
- **Recomendação:** extrair um `executeIdempotent(context, type, input, work)` no formato já usado pelas outras features, cobrir com teste de replay para todos os comandos de CAD e fazer a troca quando a tarefa tocar a feature.

#### BE-03. Parâmetro `personIds` da unidade de trabalho de CAD nunca é usado; política de lock implícita — severidade: médio

- **Evidência:** [registration-ports.ts](../../src/features/registration/application/registration-ports.ts):180-187 declara `personIds?: readonly string[]`; `src/features/registration/infra/prisma-registration.ts:1086-1099` só executa o `SELECT ... FOR UPDATE` de `Person` quando informado; os 11 chamadores (`registration-service.ts:119,186,313,426,586,762,851,945,1079`, `identity-merge-service.ts:230`, `membership-reconciliation-service.ts:295`) passam no máximo 3 argumentos; `src/core/infra/database.ts` (retry de `40001|40P01`, 3 tentativas sem espera).
- **Problema:** o ramo `if (personIds.length)` é código morto — a intenção de bloquear e ordenar as linhas de `Person` junto com `Family` nunca acontece; `Family` é lockada e `Person` só indiretamente pelo `UPDATE` posterior; `updatePerson` e `saveSizes` escrevem pessoa sem o lock prévio previsto.
- **Impacto no contexto do MVP:** a proteção contra deadlock entre transações sobre conjuntos sobrepostos depende hoje inteira do retry, podendo terminar em `DEPENDENCY_UNAVAILABLE`/503 após as três tentativas. **Inferência:** não reproduzi um deadlock; a evidência direta é a chamada ausente e o ramo morto (rollback é atômico, nenhum dado corrompido).
- **Recomendação:** decidir o contrato — remover `personIds` e documentar que o bloqueio ordenado é por `Family`, ou passar explicitamente os IDs nos comandos que alteram `Person` —, registrar a ordem de lock na SPEC-CORE (ver PER-03) e cobrir com teste de integração que force a ordem oposta.

#### BE-04. Regra de classificação da qualidade cadastral e parse de DTO HTTP dentro de `infra` de REL — severidade: médio

- **Evidência:** [prisma-reports.ts](../../src/features/reports/infra/prisma-reports.ts):1 (importa `dataQualityIssueSchema` de `@erp/contracts/data-quality-api`), `:212-218` (aplica o `.parse`), `:118-123` e `:339-340` (regra de `valid`/`invalidReason` escrita duas vezes); tipo de domínio correspondente em `src/features/reports/domain/reports.ts:131`.
- **Problema:** a fronteira é atravessada nos dois sentidos dentro do mesmo arquivo de persistência (regra de negócio e schema HTTP em `infra`, contra `AGENTS.md:72,80`) e a regra aparece duplicada sem função compartilhada nem teste de domínio; o ESLint não cobre (ARQ-05).
- **Impacto no contexto do MVP:** a qualidade cadastral é um dos quatro relatórios do MVP (REL) e alimenta o detalhe por fingerprint; mudar o critério de registro válido exige editar `infra` e lembrar das duas cópias. Não há erro ativo: as duas expressões coincidem para os dados existentes.
- **Recomendação:** mover a classificação para `reports/domain/reports.ts` como função pura usada pelos dois pontos, substituir o `.parse` de `infra` por contrato interno tipado validado em `presentation` e registrar na SPEC-CORE se `infra` pode consumir `*-api`.

#### BE-05. Dez imports de `infra` entre features, sem regra ESLint nem decisão registrada — severidade: médio

- **Evidência:** `src/features/attendance/infra/prisma-attendance.ts:24`, `src/features/audit/infra/audit-store.ts:40`, `src/features/eligibility/infra/prisma-eligibility.ts:21`, `src/features/projects/infra/prisma-projects.ts:15`, `src/features/registration/infra/prisma-identity-merge.ts:18,22`, `src/features/registration/infra/prisma-membership-reconciliation.ts:12`, `src/features/registration/infra/prisma-registration.ts:6`, `src/features/reports/infra/prisma-reports.ts:9,10`, `src/features/social-forms/infra/prisma-social-forms.ts:16`; [eslint.config.mjs](../../eslint.config.mjs) sem regra `infra`→`infra` cross-feature.
- **Problema:** sete dos dez apontam para portas transacionais ou helpers de adaptador de outra feature, não para projeções de leitura; o grafo não forma ciclo hoje (verificado), mas nada impede que um próximo passo o crie silenciosamente.
- **Impacto no contexto do MVP:** alterar a transação ou as portas de attendance (ATV/FRQ) recompila e pode afetar CAD, APT e REL; a leitura de uma feature passa a depender da implementação interna de outra. Nenhuma invariante violada e nenhum ciclo ativo.
- **Recomendação:** registrar a premissa na SPEC-CORE (aceitar reuso de adaptador no monólito ou restringir) e, no mínimo, extrair para módulos internos compartilhados os elementos reutilizados (`attendanceTransactionPorts`, `registrationTransactionPorts`, `canonicalId`, `project-projections`), com padrão em `test/eslint-config.test.ts` se a decisão for restringir.

#### BE-06. Erros do Fastify fora de 400 caem no ramo de 500 — severidade: baixo

- **Evidência:** [error-mapper.ts](../../src/core/presentation/error-mapper.ts):221-230 (só traduz objeto com `statusCode === 400`) e `:231-235` (retorno final `500 INTERNAL_ERROR`); `src/app.ts:70` fixa `bodyLimit: 1048576`; `node_modules/fastify/lib/errors.js:105-109` define `FST_ERR_CTP_BODY_TOO_LARGE` com status 413; handler global `app.ts:129-145` encaminha tudo por `mapError`.
- **Problema:** o filtro usa igualdade com 400 em vez de intervalo 4xx — um corpo acima de 1 MiB, ou qualquer outro erro 4xx do Fastify, responde `500 INTERNAL_ERROR` e é registrado como `Request failed`. Os erros 415/403 do próprio app não entram nesse caminho porque são `HttpError`.
- **Impacto no contexto do MVP:** resposta enganosa para problema do cliente (500 sugere defeito do servidor e induz retry) e ruído no log; não afeta dados, autorização nem idempotência. **Inferência:** o comportamento do Fastify foi lido no código da dependência; não executei uma requisição acima do limite.
- **Recomendação:** tratar `statusCode` entre 400 e 499 preservando-o (com código estável derivado) ou mapear explicitamente 413 e 415, cobrindo com teste de contrato via `inject`.

#### BE-07. Qualquer violação de unicidade na transação de FIC vira `PUBLICATION_BASE_CHANGED` — severidade: baixo

- **Evidência:** [prisma-social-forms.ts](../../src/features/social-forms/infra/prisma-social-forms.ts):477-483 converte todo `PrismaClientKnownRequestError` com `code === 'P2002'` sem inspecionar `meta.modelName`/`meta.target`; `repository.run` é a UoW de todos os comandos de FIC (`social-forms-service.ts:88`); restrições alcançáveis além da ficha: `SocialFormOption` `@@unique([fieldKey, code])` (`prisma/schema.prisma:263`) e `OperationRecord(type, key)`; irmãos estreitam a condição em `prisma-registration.ts:1100-1108`, `prisma-projects.ts:711-717`, `prisma-eligibility.ts:347-353`.
- **Problema:** o código de erro de domínio não corresponde à causa real; o cliente recebe 409 com regra que não descreve o conflito, e um replay de idempotência em corrida vira `PUBLICATION_BASE_CHANGED` em vez de `IDEMPOTENCY_CONFLICT`.
- **Impacto no contexto do MVP:** baixo — só em caminhos raros (duplicidade de código de opção ou corrida na mesma chave) — mas a leitura errada atrasa diagnóstico no ciclo da ficha social.
- **Recomendação:** condicionar por `meta.modelName`/`meta.target` como nas outras features, devolver `IdempotencyConflictError` quando o alvo for `OperationRecord` e cobrir com teste de fronteira `infra` que force `P2002`.

#### BE-08. Bloco de leitura de autor e de `OperationRecord` reimplementado por feature — severidade: baixo

- **Evidência:** mesmo `SELECT` de `UserAccount` com `roles` e mapeamento para `Principal` (incluindo `sessionId: ''`) em [prisma-attendance.ts](../../src/features/attendance/infra/prisma-attendance.ts):132-165, `src/features/projects/infra/prisma-projects.ts:151-184` e `src/features/registration/infra/prisma-registration.ts:723-745`; leitura de `OperationRecord` por `(type, key)` reimplementada em sete arquivos com variações de `select` e de validação de `resultReference`: `prisma-attendance.ts:166`, `prisma-eligibility.ts:245`, `prisma-projects.ts:185`, `prisma-identity-merge.ts:190`, `prisma-membership-reconciliation.ts:52`, `prisma-registration.ts:552-590` (usa `z.union`), `prisma-social-forms.ts:267-285` (exige `fingerprintKeyId`).
- **Problema:** a revalidação do autor — ponto que sustenta autor bloqueado e revalidado na mesma transação — está copiada em vez de compartilhada, e o mesmo dado persistido é interpretado de formas diferentes por feature.
- **Impacto no contexto do MVP:** cópia divergente é risco de regressão ao mexer no `Principal` (ex.: novo campo de sessão) e dificulta a prova uniforme do invariante; não é comportamento incorreto hoje (corpos idênticos nas três ocorrências verificadas).
- **Recomendação:** extrair um helper de leitura de autor e um de leitura de operação para um módulo interno de porta transversal (junto da decisão do BE-05), mantendo por feature só o `select` específico do referencial.

#### BE-09. Dois erros `new Error` alcançáveis por HTTP viram `INTERNAL_ERROR` sem código — severidade: baixo

- **Evidência:** [audit-scopes.ts](../../src/features/audit/domain/audit-scopes.ts):64 (`throw new Error('Unknown audit entity')`) e [sensitive-payloads.ts](../../src/features/social-forms/infra/sensitive-payloads.ts):24 (helper `unavailable()`, usado em `:29,49,52,67`); o segundo é atingido na projeção de leitura de blocos protegidos (`social-forms-service.ts:198-213`), alcançável por `GET /social-forms/:id`; ambos caem em `error-mapper.ts:231-235` e o log de `app.ts:131-135` grava só `requestId` e `code`.
- **Problema:** exceções sem tipo de domínio nem código estável devolvem `500 INTERNAL_ERROR` genérico e o motivo só existe na memória da exceção (não vai para o log da API).
- **Impacto no contexto do MVP:** corrupção ou rotação de chave de blocos protegidos (FIC) e auditoria com entidade desconhecida se apresentam como falha interna sem pista; nenhum dado vaza, mas o diagnóstico fica só no cliente Node.
- **Recomendação:** criar erro de domínio com código próprio (ex.: `SENSITIVE_PAYLOAD_UNAVAILABLE`, `UNKNOWN_AUDIT_ENTITY`) e mapeá-lo em `error-mapper.ts`; preservar o `catch` de `sensitive-payloads` para não vazar detalhe de decriptação.

#### BE-10. Asserções `!` dependem de invariantes estabelecidos fora da função — severidade: baixo

- **Evidência:** 13 asserções não-null em `src/features` — `social-forms-service.ts:428,443,506`; `identity-merge-service.ts:563,583,584,610,630`; `identity-merge-rules.ts:219` (`find(...)!` sobre `pair(first.id, second.id)`, que tem dois elementos só por construção); `eligibility-service.ts:188`; `sensitive-payloads.ts:65` (`!` sobre `.parse(...)`, redundante); `showcase-seed.ts:155,167`.
- **Problema:** o compilador aceita a asserção, mas a garantia mora em outro arquivo ou em premissa de dados, sem documentação no ponto do uso; `identity-merge-rules.ts` é função pura exportada, aceitável a partir de qualquer chamador.
- **Impacto no contexto do MVP:** regra futura que deixar `memberRevisions` incompleto ou `attendanceIds` com um item vira `TypeError` e responde 500 em vez de 422 com regra de domínio; não há caminho inválido hoje (garantias conferidas).
- **Recomendação:** substituir por verificação explícita com erro de domínio nas funções puras, manter `!` só onde a garantia é local e evidente, e comentar a premissa onde vier de outro arquivo.

#### BE-11. Duplicação na apresentação: chave de idempotência e imports repetidos do mesmo módulo — severidade: baixo

- **Evidência:** 30 parses idênticos de `Idempotency-Key` inline — `attendance-routes.ts:36,48,76,90,102,121`, `projects-routes.ts:54,66,88,100,112,141,152,184,196,224,239`, `registration-routes.ts:65,82,122,138,154,170,186,210,233,241`, `identity-merge-routes.ts:29`, `membership-reconciliation-routes.ts:37`, `missing-data-routes.ts:25` — contra helper já existente em `access-routes.ts:38-39` e `social-forms-routes.ts:31-32`; imports repetidos em `registration-routes.ts:3-18` e `:21-33`, e quatro blocos de `@erp/contracts/projects-api` em `projects-routes.ts:3-41`.
- **Problema:** o mesmo contrato de entrada é reescrito 30 vezes em seis arquivos enquanto dois já resolvem por composição; o ESLint não tem `no-duplicate-imports`, então quatro declarações para um módulo passam despercebidas.
- **Impacto no contexto do MVP:** mudança no nome do header ou no formato da chave (decisão de CORE) são 30 pontos de edição; efeito prático nulo no comportamento — o requisito está correto em todas as escritas de CAD/ATV/FRQ/FIC/APT.
- **Recomendação:** promover o helper `key()` para um utilitário de apresentação compartilhado (ex.: `core/presentation/idempotency-key.ts`) e habilitar `no-duplicate-imports`; ajustar por arquivo quando a tarefa tocar a rota.

#### BE-12. Rejeição de consulta desconhecida inconsistente entre os `GET` — severidade: baixo

- **Evidência:** endpoints que rejeitam query não declarada com `z.object({}).strict()` — `attendance-routes.ts:129`, `social-forms-routes.ts:70,94,101`; endpoints sem validação de consulta — `access-routes.ts:49` (`GET /auth/session`), `access-routes.ts:125` (`GET /roles`), `audit-routes.ts:23`, `missing-data-routes.ts:15`; todos os demais usam schema de consulta com `.strict()` (220 aplicações em `packages/contracts/src`).
- **Problema:** a SPEC-CORE determina que filtros aceitem apenas campos expressamente definidos; para rotas sem filtro a postura estrita é aplicada em algumas e ausente em outras — o mesmo parâmetro acidental é 400 numa rota e silenciosamente ignorado noutra.
- **Impacto no contexto do MVP:** efeito apenas em contrato e diagnóstico (cliente que envie parâmetro errado não é avisado em quatro rotas); nenhum dado exposto ou alterado.
- **Recomendação:** adotar a convenção `z.object({}).strict()` nos quatro casos ou registrar que rotas sem consulta deliberadamente dispensam validação, documentando a escolha na spec de API.

#### BE-13. `AttendanceService.queryFrequency` é público e não faz autorização — severidade: baixo

- **Evidência:** [attendance-service.ts](../../src/features/attendance/application/attendance-service.ts):766-773 (`frequency` executa `assertPermission(..., 'attendance.read')`) delegando para `:774` (`queryFrequency(query)`, que não recebe `actor` nem checa permissão); grep mostra definição em `:774` e chamada única em `:772`; contraponto documentado em `eligibility-service.ts:242-244` (métodos internos públicos com ressalva de que callers autorizam na fronteira).
- **Problema:** um método público da classe executa consulta sensível de frequência sem autorização e sem a ressalva documentada que existe em APT; o único chamador autoriza, então a exposição é acidental (ausência de `private`).
- **Impacto no contexto do MVP:** dependência de o chamador sempre lembrar de autorizar, num ponto em que a regra do MVP é autorizar no backend todo retorno de dado; um consumo futuro (ex.: relatório) que chamasse `queryFrequency` direto leria frequência sem capability. Nenhum caminho atual explorável.
- **Recomendação:** tornar `queryFrequency` `private` (mantendo a autorização em `frequency`) ou documentar explicitamente o contrato de quem autoriza, como em APT.

### 3.3 Persistência e infraestrutura (PER) — 12

#### PER-01. As restrições reais do banco existem só nas migrations; `schema.prisma` não as declara e nada verifica o drift — severidade: médio

- **Evidência:** [schema.prisma](../../prisma/schema.prisma):160-161,181 (só `@@index` com comentário sobre partial unique index) vs `prisma/migrations/202610070001_unique_canonical_cpf/migration.sql:13-15`; `:449` vs `202610050008_attendance/migration.sql:98`; `:208` vs `202610060001_missing_registration_data/migration.sql:14-16`; restrições `CHECK`/`EXCLUDE`/triggers/FK deferida/`CREATE EXTENSION btree_gist` ausentes do schema (`202610050006_registration_integrity/migration.sql:1-24`, `202610040001_access_foundation/migration.sql:119-141`, `202610050009_social_forms/migration.sql:136-165`, `202610050011_identity_merges/migration.sql:34-38`); `package.json:10-29` sem script de verificação; `.github/` ausente.
- **Problema:** há duas fontes de verdade — quem lê `schema.prisma` (revisor, `prisma generate`, `db pull`) não vê as invariantes que sustentam o MVP, e o código depende do nome do índice físico (`prisma-registration.ts:1104-1106` casa `error.meta.target === 'Person_cpf_canonical_key'`).
- **Impacto no contexto do MVP:** risco de regressão silenciosa de integridade (`prisma db pull`/regeneração aproximaria o schema do modelo limpo e descartaria garantias de vigência, unicidade parcial e imutabilidade) e nenhuma detecção automática de drift no fluxo `db:migrate`.
- **Recomendação:** registrar na SPEC-CORE que as migrations SQL são a fonte de verdade das restrições e adicionar um script `db:verify` com `prisma migrate diff --from-migrations --to-schema-datamodel --exit-code`, documentando no schema, por comentário, cada restrição física existente.

#### PER-02. Índices não cobrem as consultas de busca nem as leituras por `sessionId` — severidade: médio

- **Evidência:** colunas de busca sem índice em nenhuma migration: `schema.prisma:148,151` (`Family.nameSearch`/`addressSearch`), `:173` (`Person.nameSearch`), `:345` (`Project.nameSearch`), `:368` (`Activity.nameSearch`), criadas em `202610050003_registration_duplicates/migration.sql:2-6` e `202610050007_projects_activities/migration.sql:27,48`; grep em `prisma/**` sem `CREATE INDEX ...nameSearch`, `pg_trgm` ou `gin`; consultas com `contains` em `prisma-registration.ts:173,191,862-863,984`, `prisma-projects.ts:547-549,574-576`; `Attendance` só com índices de `(personId, sessionId)`, `membershipId` e coverage (`schema.prisma:449-450`) mas consultado por `sessionId IN (...)` (`prisma-reports.ts:159-164`) e `session: { activityId }` (`prisma-attendance.ts:247-251`); busca de contas com `contains` sem índice dedicado (`prisma-accounts.ts:217-218,253`); `AuditEntry.operationId` FK sem índice (`schema.prisma:100-101`).
- **Problema:** a coluna indexada não é a coluna filtrada; `contains` sobre texto normalizado (consistente entre escrita e leitura) não usa btree, e `sessionId` não é coluna principal de nenhum índice.
- **Impacto no contexto do MVP:** a busca CAD e a verificação de duplicidades rodam a cada cadastro, e as consultas REL varrem `Attendance`, a maior tabela de fatos do MVP; a latência cresce linearmente com o acervo. **Inferência:** não executei `EXPLAIN` — o custo é estimado a partir da forma das consultas; não há evidência de problema com volume de demonstração.
- **Recomendação:** `CREATE EXTENSION pg_trgm` + índices GIN (`gin_trgm_ops`) em `Person.nameSearch`, `Family.nameSearch`/`addressSearch`, `Project.nameSearch`, `Activity.nameSearch`, índice em `Attendance("sessionId")` e, se houver leitura por operação, em `AuditEntry("operationId")`, medindo com `EXPLAIN (ANALYZE, BUFFERS)` antes de decidir.

#### PER-03. Ordem de lock divergente entre as features depende do retry de deadlock — severidade: médio

- **Evidência:** [prisma-social-forms.ts](../../src/features/social-forms/infra/prisma-social-forms.ts):104 bloqueia `Family` antes de `Person`/`FamilyMembership`/`SizeProfile` (`:167-169`), enquanto as demais bloqueiam `Person` antes de `Family`: `prisma-registration.ts:1096-1098`, `prisma-identity-merge.ts:351-353`, `prisma-membership-reconciliation.ts:149-158`, `prisma-attendance.ts:260,291`; único amortecedor: loop de até 3 tentativas de `serializar` sem backoff ([database.ts](../../src/core/infra/database.ts):44-61), aceitando `40P01` como conflito normal (`:37,55-57`).
- **Problema:** duas transações sobre conjuntos sobrepostos (família + membros) podem travar as mesmas linhas em ordem oposta; cada deadlock desperdiça uma das 3 tentativas imediatas e exige reexecutar todo o caso de uso.
- **Impacto no contexto do MVP:** operações de FIC (publicação toca família + membros) e de CAD/ATV sobre a mesma família podem falhar com 503 em rajada; a invariante histórica não é violada (rollback atômico), mas a experiência de gravação fica intermitente. **Inferência:** não reproduzi um deadlock real; a inversão de ordem é evidência direta, a ocorrência é estimada.
- **Recomendação:** fixar uma ordem global de lock (ex.: `UserAccount → Person → Family → FamilyMembership/SizeProfile → Project/Activity`) documentada em SPEC-CORE, alinhar `prisma-social-forms.ts:104` a ela, manter o retry com backoff crescente e adicionar teste de integração que force a ordem oposta.

#### PER-04. Redis sem reconexão e rota de health que não enxerga dependências — severidade: médio

- **Evidência:** [redis-sessions.ts](../../src/features/access/infra/redis-sessions.ts):12 (`reconnectStrategy: false`), `:13` (`disableOfflineQueue: true`); [runtime.ts](../../src/runtime.ts):60-61 (`redis.on('error', ...)` com corpo vazio), `:73` (`connect()` único); `assertAvailable()`/`ping` só no logout (`access-service.ts:82-83`), demais operações de sessão só percebem a falha via `available()` (`redis-sessions.ts:57-67`); [app.ts](../../src/app.ts):155 responde `GET /api/v1/health` com `{ status: 'ok' }` estático, isento do guard em `:111`; `README.md:140` já limita a promessa da rota.
- **Problema:** queda do Redis não gera reconexão nem log — a API continua respondendo e degrada para 503 só nos endpoints de sessão; o health reporta `ok` mesmo com Postgres/Redis indisponíveis, embora o corpo sugira verificação real.
- **Impacto no contexto do MVP:** operador e supervisor de implantação não distinguem API de pé de sistema utilizável; após reinício do container Redis todas as sessões caem silenciosamente até a configuração ser corrigida manualmente. Não afeta integridade dos dados.
- **Recomendação:** usar `reconnectStrategy` com limite de tentativas (mantendo `disableOfflineQueue: true`), registrar `on('error')` com log sem credenciais e fazer o health retornar o estado de Postgres e Redis (ping curto com timeout), preservando resposta rápida.

#### PER-05. A unidade de trabalho serializável não tem teste próprio e carrega código morto — severidade: médio

- **Evidência:** [database.ts](../../src/core/infra/database.ts):40-66 (isolamento `Serializable`, timeout 10000 ms, `maxWait` 5000 ms, detecção de conflito via `P2034`/`P2010` com `meta.driverAdapterError.cause.originalCode` em `40001|40P01` e retry de 3 sem espera); `:65` (`throw new DependencyUnavailableError()` após o loop) inalcançável; `'ECONNREFUSED'` em `:22` nunca ocorre como `PrismaClientKnownRequestError.code`; `glob test/core/infra/*.ts` devolve só `config`, `operation-fingerprint` e `startup-failure`; grep em `test/` por `serializable|P2034|P2010|40001|40P01|deadlock` = 0.
- **Problema:** a mecânica central de atomicidade (retry sob conflito e queda para `DependencyUnavailableError`/503) é inferida do código, não verificada; o formato de `error.meta` do adapter `pg` é casado por schema Zod interna — se o driver mudar a forma, a detecção silencia e conflito vira 500.
- **Impacto no contexto do MVP:** há testes de rollback (`*-integrity.integration.test.ts`), mas nenhum que provoque conflito/serialização e asserts o retry; regressão no retry passaria despercebida e transformaria contenção em erro 500 para o usuário.
- **Recomendação:** teste de integração que dispare `40001` real (duas transações `serializable` concorrentes gravando a mesma linha) asserts a repetição e o 503 final; remover a linha `:65` e `'ECONNREFUSED'` de `:22` ou justificá-los; adicionar backoff (ver PER-03).

#### PER-06. Consulta de auditoria com projeção carrega todas as linhas e pagina em memória — severidade: médio

- **Evidência:** [audit-store.ts](../../src/features/audit/infra/audit-store.ts):243-272 — com `AuditProjector` o `findMany` não recebe `skip`/`take` (`:246-250`), o laço `:252-255` projeta cada entrada, a paginação é `visible.slice(...)` (`:257-260`) com `total: visible.length` (`:264`), tudo dentro de transação `RepeatableRead` de 10 s (`:268-271`); o caminho sem projeção pagina no banco com `skip`/`take` + `count` (`:273-285`).
- **Problema:** o custo do filtro (potencialmente anos de histórico) é pago inteiramente na memória do processo antes de devolver uma página, e o `total` só fecha depois de projetar tudo enquanto a transação segura snapshots.
- **Impacto no contexto do MVP:** ACS/AUD exibem auditoria da ficha social e de cadastros; com volume real o endpoint cresce linearmente e pode estourar o timeout de 10 s ou a memória do worker, transformando leitura em indisponibilidade. Os invariantes de auditoria não são afetados.
- **Recomendação:** paginar primeiro no banco (mesmo com projeção) e projetar só a página, aceitando `total` via `count`; pré-carregar dependências da página ou materializar campo de projeção, com teste de contrato com muitas entradas.

#### PER-07. `OperationRecord` não tem data de início nem autor no registro da operação — severidade: baixo

- **Evidência:** [schema.prisma](../../prisma/schema.prisma):81-96 — apenas `completedAt DateTime?` (`:91`); grep por `createdAt` mostra ocorrências em outros modelos, nenhuma em `OperationRecord`; migration `202610040001_access_foundation/migration.sql:1-30` confirma; ator em `actorType`/`actorId` (`:85-86`).
- **Problema:** a operação de idempotência só pode ser ordenada/filtrada pelo `completedAt` anulável (operações abortadas podem ficar sem data); não há como medir duração nem achar operações pendentes há tempo.
- **Impacto no contexto do MVP:** afeta apenas diagnóstico operacional e recuperação de histórico de operações interrompidas; não viola auditoria (`AuditEntry` tem `recordedAt`/`occurredAt`, `schema.prisma:109-110`) nem altera comportamento de idempotência.
- **Recomendação:** adicionar `createdAt TIMESTAMPTZ(3) NOT NULL DEFAULT now()` em nova migration (compatível, só aditivo) e, se o diagnóstico importar, expor operação sem `completedAt`.

#### PER-08. Fingerprint: canonização cega a `Date` e falha por `Error` genérica — severidade: baixo

- **Evidência:** [operation-fingerprint.ts](../../src/core/infra/operation-fingerprint.ts):5-15 trata qualquer objeto não-nulo via `Object.entries`; um `Date` não tem propriedades enumeráveis e vira `{}`, então `fingerprint(config, new Date('2026-01-01'), null) === fingerprint(config, new Date('2026-12-31'), null)`; em `:24` chave histórica ausente lança `Error` simples, que `mapError` (`error-mapper.ts:231-235`) converte em `500 INTERNAL_ERROR`.
- **Problema:** dois riscos latentes na peça que garante idempotência e não-replay divergente: colisão silenciosa de conteúdo (data ignorada) e perda do motivo da falha no contrato HTTP. Hoje as fronteiras convertem data para string ISO antes (`prisma-attendance.ts:78`, `domain/attendance.ts:21`) — a correção depende de convenção, não do tipo. A falha por chave ausente é intencional e coberta pelo teste existente.
- **Impacto no contexto do MVP:** idempotência é invariante central de todas as escritas; se alguém passar um `Date` num `content`, replays de conteúdos diferentes aceitariam como iguais. Nenhum dos 8 serviços que chamam `calculate` cai nisso (**verificação por grep**) — risco de manutenção, não defeito ativo.
- **Recomendação:** tratar `Date` explicitamente em `canonicalize` (serializar com `toISOString()`), falhar alto se `content` contiver tipo não suportado e tipar o erro de chave ausente como `ConfigurationError`/código estável dedicado.

#### PER-09. `bootstrap` e `seed` descartam a causa das falhas — severidade: baixo

- **Evidência:** [bootstrap.ts](../../src/bootstrap.ts):11,20-25 (`catch` sem binding e mensagem única genérica `Bootstrap failed; check input, configuration and existing accounts`, descartando `error`); [seed.ts](../../src/seed.ts):31-37 (imprime `error.message` só para `ShowcaseSeedError`, genérica para o resto); `bootstrap.ts:9` chama `readConfig` fora do `try` (falha de config escapa com stack completo enquanto erros do `try` são ocultados); contraponto: `startup-failure.ts:40-52` com allow-list no caminho da API.
- **Problema:** duas falhas diferentes (banco fora do ar vs. senha rejeitada vs. constraint) produzem a mesma saída no terminal e a causa original nunca chega ao log; os comandos de linha não têm tratamento equivalente ao da API.
- **Impacto no contexto do MVP:** operação/implantação perde diagnóstico em comandos que rodam justamente quando o ambiente está quebrado; nenhuma invariante de dados afetada (exit code 1 preservado).
- **Recomendação:** imprimir a causa (mensagem + stack) nos comandos CLI, onde não há usuário remoto, ou reaproveitar `startupFailureMessage` já testado; alinhar `bootstrap.ts:9` ao mesmo `try`.

#### PER-10. `prisma.config.ts` aponta para um banco silenciosamente quando `DATABASE_URL` falta — severidade: baixo

- **Evidência:** [prisma.config.ts](../../prisma.config.ts):7 (`url: process.env.DATABASE_URL ?? 'postgresql://localhost/erp'`, fallback literal sem credenciais), `:3` (carrega `.env` só se o arquivo existir); CLI roda via `package.json:22` (`db:migrate` = `prisma migrate deploy`) e `:21` (`db:generate`), enquanto comandos de aplicação usam `--env-file-if-exists`; `.env.example:8` documenta a URL correta com usuário/senha.
- **Problema:** ausência de variável não vira erro — vira um alvo alternativo; em máquina com Postgres local a migration roda sem aviso no banco errado; sem banco, o erro de conexão não menciona a variável ausente.
- **Impacto no contexto do MVP:** risco de operação (migrar/sincronizar banco de desenvolvimento ou demo por engano), não de dados em si. **Inferência:** não executei `pnpm db:migrate`.
- **Recomendação:** remover o fallback e exigir `DATABASE_URL` (falhar com mensagem indicando `.env.example`) ou apontar explicitamente para a URL do `compose.yaml` com comentário; manter o carregamento condicional de `.env`.

#### PER-11. Uma única migration controla transação explicitamente — severidade: baixo

- **Evidência:** grep em `prisma/migrations/**` por `^BEGIN|^COMMIT` encontra apenas `202610060001_missing_registration_data/migration.sql:1` e `:27`; as demais ocorrências de `BEGIN` são corpos `plpgsql` dentro de `DO $$`/`CREATE FUNCTION`.
- **Problema:** estilo divergente entre 16 migrations — se o Prisma Migrate já executa o arquivo em transação, o `COMMIT;` interno encerra cedo a transação do driver; se não executa, só essa migration teria atomicidade garantida. Em qualquer caso o comportamento depende do motor do Prisma, não do repositório.
- **Impacto no contexto do MVP:** baixo e hipotético: a migration cria tabela + índice + constraint + trigger, então um meio aplicado deixaria o schema parcial e a próxima execução falharia por objeto já existente. **Inferência:** cenário não reproduzido.
- **Recomendação:** padronizar — remover `BEGIN;`/`COMMIT;` e confiar no mecanismo do Migrate (ou documentar em SPEC-CORE se controle explícito é proibido/permitido) — e verificar com `prisma migrate status` após `db:migrate` no ambiente de teste.

#### PER-12. Contadores de bloqueio de login vivem em Redis volátil — severidade: baixo

- **Evidência:** [redis-sessions.ts](../../src/features/access/infra/redis-sessions.ts):102-136 mantém `login` e `login-ip` por `INCR`/`EXPIRE` (`incrementScript`, `:40-43`); [compose.yaml](../../compose.yaml):17-26 sobe Redis com `--appendonly no` (`:21`), sem volume e sem `--save`; `compose.test.yaml:17-26` ainda mais volátil; `.env.example:26` (`LOGIN_MAX_FAILURES`); sem registro de tentativas em Postgres.
- **Problema:** reiniciar o container Redis zera as contagens de falhas por conta e por IP, liberando imediatamente tentativas bloqueadas; o limite passa a valer por ciclo de vida do processo, não por janela institucional.
- **Impacto no contexto do MVP:** enfraquece a proteção de força bruta de login (ACS); o núcleo do invariante está preservado — `authVersion` é persistido em Postgres e sessões antigas caem mesmo com Redis limpo. **Inferência:** a evidência direta do reset é inferência de configuração (não reiniciei o Redis).
- **Recomendação:** registrar em ACS/DEC que o throttling é melhor-esforço em Redis volátil, ou contar falhas também no Postgres (coluna transacional) mantendo Redis como cache de leitura.

### 3.4 Frontend web (WEB) — 11

#### WEB-01. Os ports de `application` não são o contrato da produção: a UI tipa contra classes `Http*` — severidade: alto

- **Evidência:** 41 imports de `../infra/...` em 29 arquivos de `apps/web/src/features/**/presentation/**` (ex.: `attendance/presentation/attendance-page.tsx:4-5`, `registration/presentation/reconciliation-page.tsx:9-11`, `access/presentation/users-page.tsx:4`, `audit/presentation/audit-page.tsx:5`), quase todos `import type { HttpX }`; `presentation` importa de `application/` apenas o tipo `DuplicateCandidate`; dos 7 ports (`features/*/application/*-gateway.ts`) só `AuthenticationGateway` tem implementação HTTP (`access/infra/http-authentication.ts:21`), os outros 6 só têm factories demo; port defasado: [attendance-gateway.ts](../../apps/web/src/features/attendance/application/attendance-gateway.ts):9-22 (`context/list/get/confirm/correct`) vs `http-attendance.ts:16-201` (`context(..., guestPersonIds?, sessionId?)`, `sessions`, `detail`, `create`, `correct(sessionId, ...)`, além de `frequency`, `coverage`, `history`, `correctSession`, `correctContext`, `declareCoverage`); três fachadas paralelas: `erp-client.ts:12-42` (`ErpViewClient`/`ErpClient`) e `http-erp-client.ts:12-32` (`HttpErpClient`); sem ports para eligibility, users, audit, composition.
- **Problema:** a camada `application` existe no desenho mas não é usada na rota de produção — o contrato efetivo da UI é a classe `Http*` de cada feature, e os ports obsoletos dão falsa segurança de que o contrato está definido.
- **Impacto no contexto do MVP:** qualquer evolução de contrato (ficha social, frequência, aptidão) é negociada com a classe HTTP em vez de um port estável; não há como trocar transporte nem rodar as rotas contra o demo sem refatorar props de ~29 componentes, e o demo deixa de servir como suíte de aceitação das telas roteadas.
- **Recomendação:** decidir explicitamente entre (a) fazer os `Http*` implementarem os ports e tipar `presentation` contra o port (com `allowTypeImports`), corrigindo as assinaturas, ou (b) remover/arquivar ports e `ErpClient` demo registrando que a classe HTTP é o contrato da UI; em qualquer caso unificar as três fachadas e adicionar bloco ESLint para `presentation` no web (ver TOOL-11).

#### WEB-02. A busca de duplicidade de pessoa existe no código e não é executada em nenhuma tela — severidade: alto

- **Evidência:** [person-form-page.tsx](../../apps/web/src/features/registration/presentation/person-form-page.tsx):59 e `:75` chamam `intent.prepare(input, form)` **sem** o terceiro argumento `check`; `use-registration-intent.ts:26,33-37` só consulta duplicidades quando `check` é fornecido; `person-form-page.tsx` nunca chama `intent.captureRejectedReview` (único uso: `family-form.tsx:52`), enquanto o fluxo de família faz tudo certo (`family-form.tsx:36-39` passa `client.registration.reviewFamilyDuplicates`); `HttpRegistration.reviewPersonDuplicates` (`http-registration.ts:109-137`) é chamado **apenas** por `apps/web/test/features/registration/infra/http-registration.test.ts:31,89`; `DuplicateCreationReview` só por `family-form.tsx:18`; no backend `registration-service.ts:142-151` impõe `assertDuplicateReview` para **família**, enquanto `createPerson` (`:185-240`) só valida unicidade de CPF (`:231-240`) e data futura (`:229-230`).
- **Problema:** a tela de cadastro/edição de pessoa não executa nenhuma prévia de duplicidade por nome/nascimento — exatamente a verificação que o próprio cliente (`NAME_BIRTH_MATCH`) e o domínio do backend (`duplicate-rules.ts:55-61`) sabem fazer; o usuário só recebe mensagem quando o CPF já existe.
- **Impacto no contexto do MVP:** a regra de CAD (buscar possíveis duplicidades antes de cadastrar) fica ativa só para famílias; pessoas duplicadas entram no cadastro e só aparecem depois no tratamento de duplicidades, elevando o custo da unificação que exige autorização, motivo e histórico. A moldura de fluxo (intenção, idempotência por fingerprint, revisão) já está pronta e é reaproveitável.
- **Recomendação:** em `PersonForm`, passar `client.registration.reviewPersonDuplicates` como `check` na criação (não na edição), renderizar `DuplicateCreationReview` a partir de `intent.review` e ligar `captureRejectedReview` no `createRegisteredPerson`; a decisão de o backend impor também `assertDuplicateReview` em pessoa é de PRD/spec, não de UI.

#### WEB-03. Superfície morta da era demo convive com as variantes roteadas, mantida viva por testes próprios e copy falsa — severidade: alto

- **Evidência:** componentes não montados pelas rotas de `connected-app.tsx` — [app-layout.tsx](../../apps/web/src/app/app-layout.tsx):46-70 (lança `'Demo access is required by the demo layout'` em `:51`, usa Sair da demonstração/Dados sintéticos em `:59-60`), `access/presentation/login-page.tsx:7-33` (texto em `:77-79`: o acesso real ainda não está conectado nesta interface — falso desde que o backend entrou), `home/presentation/dashboard-page.tsx:41-117` (badge Dados sintéticos em `:71`, `listFamilies()` sem limite em `:53`), `registration/presentation/families-page.tsx:75-140` (pagina/filtra no cliente em `:115-131`), `projects/presentation/projects-page.tsx:62-107` (botões disabled com em breve em `:74-95`) e `activity-page.tsx:180-193`; variantes roteadas são `ConnectedDashboardPage`, `ConnectedFamiliesPage`, `ManagedProjectsPage` (`projects-page.tsx:109`) e `ManagedActivityPage` (`activity-page.tsx:197`); cada variante morta tem teste dedicado (`dashboard-page.test.tsx`, `families-page.test.tsx`, `projects-page.test.tsx`, `activity-page.test.tsx`, `app-layout.test.tsx`) importando `createDemoClient`; contrato [access-gateway.ts](../../apps/web/src/features/access/application/access-gateway.ts):9-10 declara `demoAccounts()` e `enterDemo()`, implementados só por `demo/runtime.ts:92,101` e `demo-access.ts:10-11`; `HttpErpClient` não define `access`, então `erp-provider.tsx:30` cai em caminho coberto apenas pela injeção explícita de `connected-app.tsx:121-127`; `README.md:42` afirma que ajuda e sino permanecem no protótipo, caminho inexistente. **Consolidação das fatias 04 e 08.**
- **Problema:** convivem duas gerações de tela com nomes parecidos; um contrato compartilhado declara operações que só a demonstração sustenta; componentes com copy falsa permanecem no bundle por causa de testes que roteiam o caminho morto.
- **Impacto no contexto do MVP:** teste verde em `ProjectsPage` não prova que Novo projeto funciona (quem roteia é `ManagedProjectsPage`); manutenção dupla de layout; ao remover ou renomear a injeção de `connected-app.tsx:121-127`, ou rotear `login-page` por engano, a UI passaria a afirmar que o acesso real não está conectado; `GlobalActions` gera 153 linhas de painéis inalcançáveis.
- **Recomendação:** decidir o destino da geração demo (entrada explícita como demonstração, ou remoção), estreitar `AccessGateway` às operações de sessão do caminho conectado movendo `demoAccounts`/`enterDemo` para contrato de demonstração separado, separar as variantes em arquivos distintos e marcá-las com comentário de intenção.

#### WEB-04. Invalidação global por `revision` é assimétrica e convive com um segundo modelo manual de refresh — severidade: médio

- **Evidência:** [http-erp-client.ts](../../apps/web/src/app/http-erp-client.ts):24-31 injeta `this.invalidate` **apenas** em `HttpRegistration`, `HttpProjects` e `HttpComposition`; `HttpAttendance`, `HttpUsers`, `HttpEligibility`, `HttpSocialForms`, `HttpReports` e `HttpAudit` recebem só `api` (`:26-30`); dois modelos coexistem: `useQuery` (13 call sites, revision-driven, `shared/use-query.ts:8-11`) e `useApiQuery(load, refresh)` com estado manual (43 call sites, ex.: `users-page.tsx:213`, `attendance-page.tsx:140`, `audit-page.tsx:129`).
- **Problema:** o hook global promete invalidação, mas só três dos oito adaptadores a disparam; metade das telas ignora o hook e faz refresh manual, então não há regra única.
- **Impacto no contexto do MVP:** **não há defeito vivo hoje** — as páginas `useQuery` leem registration/composition, cujas escritas são invalidadas; porém a próxima tela que ler via `useQuery` dados gravados por FRQ/APT/FIC ficará desatualizada sem erro, e a inconsistência multiplica o custo de revisão de cada nova tela.
- **Recomendação:** escolher um único mecanismo — passar `this.invalidate` para todos os adaptadores (com custo documentado de recarregar tudo a cada escrita) ou descontinuar `useQuery` em favor de `useApiQuery` com refresh explícito — e registrar a decisão na spec de UI/CORE.

#### WEB-05. A busca global varre a base inteira a cada tecla pressionada — severidade: médio

- **Evidência:** [search-page.tsx](../../apps/web/src/features/registration/presentation/search-page.tsx):120-135 dispara `listFamilies(searchQuery)` **e** `listPeople(searchQuery)` a cada mudança de `input` (`:179-187`, sem debounce nem botão), ambos via `allApiPages` (`http-registration.ts:40-55`), que pagina com `pageSize: 100` até o fim sem limite (`shared/api-query.ts:13-44`); mesmo padrão em `family-lookup.tsx:18-22` e no componente morto `families-page.tsx:77`; contraponto positivo: `connected-families-page.tsx:28-36` usa `searchFamilies({ page, pageSize: 20 })`.
- **Problema:** com dois caracteres digitados o cliente emite duas requisições que podem percorrer toda a tabela de famílias e pessoas; sem `AbortController`, requisições antigas só são descartadas na renderização, não na rede.
- **Impacto no contexto do MVP:** busca é requisito de CAD; o custo cresce linearmente com a base e com a digitação, afetando todos os operadores com `registration.read`, inclusive em conexão limitada.
- **Recomendação:** debounce (~250 ms) ou ação explícita, limite de resultados com paginação (como em `ConnectedFamiliesPage`) e cancelamento via `AbortSignal` no `ApiClient` (ver WEB-11).

#### WEB-06. Regras de duplicidade e normalização implementadas dentro do adaptador HTTP — severidade: médio

- **Evidência:** [http-registration.ts](../../apps/web/src/features/registration/infra/http-registration.ts):57-96 (`reviewFamilyDuplicates` decide limites `length >= 2`, fatia o endereço `slice(0, 200)` e refina motivos no cliente com `getFamily` por candidato), `:109-137` (`reviewPersonDuplicates` injeta `NAME_BIRTH_MATCH` comparando `normalizeSearch(person.name)`), `:173-195` (N+1 de `getFamily` para `familyCode`) e `:78-93` (N+1 por candidato); a normalização vem do `domain` (`:27`); no backend a mesma lógica vive em `domain/duplicate-rules.ts:38-91`.
- **Problema:** a fronteira contém regras (limiares, filtragem por motivo, composição de razões) que podem divergir do backend silenciosamente, contra `AGENTS.md` (regras no `domain`, efeitos explícitos na fronteira).
- **Impacto no contexto do MVP:** divergência entre o que a UI mostra como possível duplicidade e o que o backend considera conflito; latência adicional em telas de CAD pelo N+1 em toda abertura de cadastro de pessoa.
- **Recomendação:** mover a política (limiares, motivos exibidos, enriquecimento) para o `domain` da feature ou consumir do backend o enriquecimento pronto, mantendo no adaptador só requisição + validação Zod; avaliar payload único para `familyCode`.

#### WEB-07. Fuso horário `-03:00` escrito literalmente em sete pontos — severidade: médio

- **Evidência:** [time.ts](../../apps/web/src/shared/time.ts):1 declara `appTimezone = 'America/Fortaleza'` e o usa em `Intl.DateTimeFormat` (`:2-6`, `:19-26`, `:35-40`), mas `startOfDay` (`:14`) e `toInstant` (`:29`) escrevem `-03:00` literal; o mesmo literal aparece em `person-page.tsx:126` (`T23:59:59.999-03:00`), `family-page.tsx:38`, `person-form-page.tsx:68` (`T00:00:00-03:00`), `projects/presentation/project-forms.tsx:249` e `demo/seed.ts:7`.
- **Problema:** a data civil do MVP (data do fato × data do lançamento) é montada por concatenação de string com offset fixo em quatro arquivos de apresentação que nem importam `startOfDay`/`toInstant`; se o offset mudar, os lugares divergem sem falha de tipo nem teste acusar.
- **Impacto no contexto do MVP:** vigência de vínculos, fim do dia de frequência e datas de formulário dependem desse valor; hoje ele coincide com `America/Fortaleza` (UTC-3), portanto **não há defeito atual** — é risco de manutenção.
- **Recomendação:** centralizar em `shared/time.ts` (`startOfDay`, `toInstant`, `endOfDay`), substituir os usos pelas funções e fixar em teste as bordas de vigência (início/fim de dia).

#### WEB-08. Barris órfãos e assets públicos sem uso — severidade: baixo

- **Evidência:** 9 barris em `apps/web/src/*.ts` (`access`, `attendance`, `audit`, `eligibility`, `home`, `projects`, `registration`, `reports`, `social-forms`); o único import de produção é `main.tsx:5` → `./access`, os outros oito são importados apenas por `apps/web/test/**` (64 matches); em `apps/web/public/` 10 arquivos, só `logo-le.jpeg` referenciado (`app-layout.tsx:200`, `sign-in-page.tsx:48`, `login-page.tsx:28`, `change-password-page.tsx:64`); `apple-icon.png`, ícones, `placeholder-*` não aparecem em lugar nenhum e `index.html` não tem `<link rel="icon">`.
- **Problema:** `vite build` copia `public/` inteiro para `dist/` (confirmado no `dist/` pré-existente, com os 9 assets órfãos) e os barris criam uma segunda forma de importar features, usada só pelos testes.
- **Impacto no contexto do MVP:** sem efeito funcional; ruído de leitura e ~14 kB de assets servidos sem motivo. Relacionado a CTX-08 (barris como costura da era demo).
- **Recomendação:** apagar placeholders e ícones não usados (ou referenciar `icon.svg` como favicon) e substituir os barris de teste por imports diretos dos caminhos de feature.

#### WEB-09. Tailwind v4 sem `@theme` e fonte externa carregada por rede — severidade: baixo

- **Evidência:** [index.css](../../apps/web/src/index.css):1-3 importa Google Fonts por URL e carrega `tailwindcss` + `./app.css` em `layer(components)`; [app.css](../../apps/web/src/app.css):1-14 declara os 11 tokens em `:root` sem bloco `@theme` (grep = 0); `DESIGN.md:25` permite tokens de tema; os 4 usos em classe seguem sintaxe arbitrária (`text-(--color-text-muted)` em `person-page.tsx:108,151,182,188`).
- **Problema:** sem `@theme` os tokens não viram utilitários do Tailwind (`bg-primary`, `text-surface` seriam classes inexistentes que o build não acusa — falha silenciosa); o `@import` de fonte externa depende de rede em tempo de execução e expõe o acesso da instituição a um terceiro.
- **Impacto no contexto do MVP:** risco de estilo sumido na próxima tela escrita com utilitário de token; em rede restrita a interface renderiza com fontes de fallback (`app.css:12-13`) sem aviso.
- **Recomendação:** declarar os tokens em `@theme` (mantendo `:root` para retrocompatibilidade) e hospedar as fontes localmente ou registrar a dependência externa como aceita.

#### WEB-10. Fallbacks de rótulo expõem chave crua e JSON cru na interface — severidade: baixo

- **Evidência:** [record-list.tsx](../../apps/web/src/shared/record-list.tsx):2-84 define 82 rótulos, `:112` usa `labels[key] ?? key` e `:89` `labels[String(value)] ?? String(value)`; `eligibility/presentation/eligibility-page.tsx:95-100` renderiza `JSON.stringify(evidence.sourceVersions, null, 2)` em `<pre>`; `shared/audit.ts:18` (`auditActionLabels[entry.action]`).
- **Problema:** a UI promete textos em pt-BR e o fallback quebra essa promessa quando o backend devolve campo novo; o JSON cru de evidências de APT é útil (a spec exige expor evidências), mas está em formato de debug.
- **Impacto no contexto do MVP:** cosmético/UX, sem risco de dados corretos ou de autorização; `auditActionLabels` está coberto pelo tipo hoje (typecheck passa), então `undefined` só ocorreria com ação fora do contrato validado.
- **Recomendação:** fallback traduzido ou rótulo genérico para chaves desconhecidas e converter `sourceVersions` em lista de pares rotulados.

#### WEB-11. `useApiQuery` não cancela requisições nem deduplica — severidade: baixo

- **Evidência:** [use-query.ts](../../apps/web/src/shared/use-query.ts):13-41 guarda um `active` para descartar resposta obsoleta (`:26-31`) e compara identidade de `load`/`revision` (`:38-39`), mas não há `AbortController`, cache, dedup nem retenção entre desmontagens; `shared/api-query.ts:13-44` e `shared/api-client.ts` não expõem sinal de aborto.
- **Problema:** cada re-render com `load` novo dispara nova requisição (por isso WEB-05 é relevante); navegações rápidas mantêm conexões abertas e respostas que serão ignoradas.
- **Impacto no contexto do MVP:** desperdício de rede e possível piscar de loading; nenhum bug de estado incorreto (a proteção por identidade está correta).
- **Recomendação:** adicionar `AbortSignal` ao `ApiClient` e passar o sinal do `useEffect`, mantendo a checagem de identidade; se houver necessidade de retenção, introduzir cache com regra de invalidação explícita.

### 3.5 Contratos compartilhados (CTR) — 10

#### CTR-01. Vocabulário de `action` da auditoria em pelo menos sete declarações independentes, sem fonte única nem teste de paridade — severidade: médio

- **Evidência:** enum de banco [schema.prisma](../../prisma/schema.prisma):16-28 (`AuditAction`, 11 valores, **sem** `PUBLISH`) e cópia gerada `src/generated/prisma/enums.ts:20-34`; contratos HTTP por classificação em `packages/contracts/src/account-audit-api.ts:4-11`, `audit-api.ts:37-43` (reutilizado em `:111,210`) e `:131-137` (inclui `INVALIDATE`); tipo legado `packages/contracts/src/audit.ts:3-12` (9 valores, **inclui `PUBLISH`**, omite `INVALIDATE`, `PASSWORD_CHANGE`, `PASSWORD_RESET`); tipos de domínio `src/features/audit/domain/account-audit.ts:3-9` e `audit-entry.ts:44-45,73-74`; uniões literais nas portas (`attendance-ports.ts:83`, `projects-ports.ts:111`, `social-forms-ports.ts:80`); rótulos do web em `apps/web/src/shared/audit.ts:3-13` e `session-history.tsx:73-79`; nenhum teste referencia `schema.prisma` ou `src/generated` para paridade (grep = 0).
- **Problema:** cada camada redeclara o vocabulário com recortes diferentes e só o compilador local enxerga a própria cópia; `AuditEntry.action` aceita `PUBLISH`, valor que o banco jamais grava, e omite ações reais — o tipo publicado descreve eventos impossíveis e deixa de fora os verdadeiros.
- **Impacto no contexto do MVP:** ainda não há quebra visível (as telas recebem subconjuntos estreitos), mas auditoria é requisito do MVP e vocabulário divergente entre escrita e leitura é risco direto de histórico incomprensível; ação fora do mapa renderiza `undefined` (`apps/web/src/shared/audit.ts:18`).
- **Recomendação:** fixar uma fonte única por classificação em `packages/contracts` (array `as const` + `z.enum`, padrão de `social-form-fields.ts:55-66`), derivar dela schemas HTTP, tipos de domínio e rótulos, adicionar teste de paridade `schema.prisma` ↔ contratos e registrar o destino de `PUBLISH` (ver Decisões em aberto).

#### CTR-02. A camada modelo legada diverge dos contratos `*-api` e ainda é o vocabulário de domínio do web — severidade: médio

- **Evidência:** `docs/api/README.md` marca os contratos legados (`registration`, `projects`, `attendance`, `social-forms`, `reports`) como não-HTTP; divergências: `personSchema` (`packages/contracts/src/registration.ts:47-51`) tem `updatedAt` sem `createdAt` vs `personDtoSchema` (`registration-api.ts:125-130`) com os dois; `QualityKind` (`reports.ts:27-28`, `MISSING_REFERENCE | MISSING_BIRTH_DATE | POSSIBLE_DUPLICATE`) vs `reports-api.ts:37` (`MISSING_DATA | POSSIBLE_DUPLICATE`); `ReachReport` plano (`reports.ts:12-26`) vs envelhecido (`reports-api.ts:131-143`); `attendanceStatusSchema` declarado duas vezes (`attendance.ts:4` e `attendance-api.ts:15`); consumo híbrido em `registration-gateway.ts:1-12,23-36` (mescla legado com `duplicateCandidateSchema`), `attendance-gateway.ts:7`, `frequency.ts:4-6`, `reports-gateway.ts:1,8-10`; `http-registration.ts:54` devolve `personDtoSchema.parse(person)` compatível com `Person` só por sobrar campo.
- **Problema:** duas gramáticas para a mesmo entidade, sem marca de legado no próprio código (a marca só existe no `docs/api`) e sem teste que impeça um contrato novo de divergir; o gateway mistura as duas fontes na mesma interface.
- **Impacto no contexto do MVP:** origem provável de bugs de paridade quando o demo for ligado ao backend (`QualityIssue` do demo tem `kind` que a API não emite; `ReportsGateway` só tem implementação demo enquanto a tela exige `HttpReports`); `createdAt` chega no parse mas nenhum tipo de domínio o declara — o dado existe e é inacessível com segurança de tipos.
- **Recomendação:** mapear explicitamente DTO → modelo em funções nomeadas (`toPerson`, `toFamily`) ou extrair um módulo `*-model` sem schema HTTP para os tipos que o web usa como vocabulário de domínio, marcando o restante `@deprecated` apontando para o `*-api` correspondente.

#### CTR-03. Enumerações de relatório são privadas no contrato e o web redeclara os literais — severidade: médio

- **Evidência:** [reports-api.ts](../../packages/contracts/src/reports-api.ts):34-38 define `reachUnitSchema`, `frequencyUnitSchema`, `dateBasisSchema`, `qualityKindSchema` e `qualityStatusSchema` como `const` **sem `export`**; em consequência `apps/web/src/features/reports/presentation/reports-page.tsx:21,27-34` redeclara `Kind`, `qualityKind`, `qualityStatus` e `dateBasis` como uniões locais; o padrão correto já existe: `social-form-fields.ts:55-66` exporta o array, `social-forms-api.ts:9,272` deriva `z.enum`, `configuration-page.tsx:4,236` consome o mesmo array.
- **Problema:** sem export o web não pode referenciar os cinco enums; a redeclaração não gera erro de compilação quando os lados divergem — retirar valor quebra só em runtime (`INVALID_RESPONSE` via `safeParse`), acrescentar valor fica simplesmente inacessível na tela.
- **Impacto no contexto do MVP:** os filtros de `qualityKind`, `dateBasis` e unidade de contagem compõem os relatórios de alcance/qualidade do MVP (REL); divergência vira tela que não oferece o filtro ou envia valor que a API rejeita, sem nenhum gate apontar a causa.
- **Recomendação:** exportar os cinco schemas (ou os arrays `as const`) e consumir `z.infer`/`z.input` em `reports-page.tsx`, fazendo acrescentar ou retirar literal virar erro de tipo na UI.

#### CTR-04. O envelope e os códigos de erro da SPEC-CORE não têm fonte única verificável no contrato — severidade: médio

- **Evidência:** SPEC define envelope em `docs/specs/00-foundation.md:50` e tabela de 13 códigos em `:52-66` (sem `500`/`INTERNAL_ERROR`); backend emite em `src/app.ts:129-153` e mapeia `code: 'INTERNAL_ERROR'` em `error-mapper.ts:233`; em `packages/contracts` só existem `ErrorCode` ([common.ts](../../packages/contracts/src/common.ts):29-43, **14** códigos, com `INTERNAL_ERROR` em `:43`) e `ApplicationError` (`:44-52`) — **não há schema do envelope**; o web o redeclara em `apps/web/src/shared/api-client.ts:9-15` (`failureSchema` com `code: z.string()`) e tipa `ApiRequestError.code` como `string` (`:16-26`), disparando `INVALID_RESPONSE` (`:50,54,60,95,99`) e `NETWORK_ERROR` (`:86`); comparações por literal em `authentication-error.ts:15,19,22-23`, `management-form.tsx:53`, `change-password-page.tsx:39`, `reports-page.tsx:175`; nenhum teste cita `ErrorCode` ou `failureSchema`.
- **Problema:** o único artefato compartilhado de erro é uma união de tipos sem schema nem teste; `code: z.string()` valida só a presença do campo; SPEC e contrato já divergem (14 vs 13 códigos) e um digito errado numa comparação compila e falha em silêncio.
- **Impacto no contexto do MVP:** o tratamento de conflito de revisão, rate limit e indisponibilidade na UI depende de comparações de string; com envelope malformado o usuário recebe mensagem genérica em vez do fluxo correto. `INTERNAL_ERROR` é emitido pela API sem estar na tabela canônica da SPEC.
- **Recomendação:** exportar `failureSchema` e um `errorCodeSchema` de `packages/contracts`, tipar `ApiRequestError.code` como `ErrorCode | ClientErrorCode` (nomeado para `INVALID_RESPONSE`/`NETWORK_ERROR`), alinhar SPEC e contrato quanto a `INTERNAL_ERROR` e adicionar teste que valide o envelope vindo das rotas.

#### CTR-05. A paridade enum do banco ↔ contratos não é verificada e o código gerado não é regenerado por todos os scripts — severidade: médio

- **Evidência:** o banco tem dois enums — [schema.prisma](../../prisma/schema.prisma):11-14 (`ActorType`) e `:16-28` (`AuditAction`) — e ambos são reescritos à mão nos contratos (`ActorType` vira `z.enum` inline em `account-audit-api.ts:37` sem nome/export; `AuditActorType` em `src/features/audit/domain/account-audit.ts:10`); código gerado em `.gitignore:65` (`src/generated/`), regenerado por `package.json:16` (`typecheck`), `:15` (`build:api`) e `:20` (`test:integration`), mas **não** por `:18` (`test`); `test/features/registration/infra/cpf-conflict.test.ts:2` importa `src/generated/prisma/client.js`.
- **Problema:** a SPEC veta contratos importarem o gerado, o que força a duplicação — mas não há teste que confira que as listas continuem iguais; e um artefato de build não versionado só existe após um dos três scripts que o regeneram.
- **Impacto no contexto do MVP:** (a) clonagem limpa + `pnpm test` isolado falha com módulo não encontrado (a receita do README só funciona porque `pnpm typecheck` roda antes); (b) um valor novo no enum de auditoria passa a ser gravável pelo banco e rejeitável pelo contrato HTTP, quebrando a leitura sem que nenhum teste falhe.
- **Recomendação:** adicionar `db:generate` ao script `test` (ou `pretest`) para suíte autocontida e criar teste de paridade que leia os enums de `prisma/schema.prisma` (ou de `src/generated/prisma/enums.ts`) e os compare com os schemas de contrato.

#### CTR-06. Colisões de símbolo exportado entre módulos do mesmo pacote — severidade: baixo

- **Evidência:** `sessionDtoSchema`/`SessionDto` exportados por `packages/contracts/src/access-api.ts:36,43` (sessão de autenticação) e `attendance-api.ts:24,322` (sessão de atividade), além de um terceiro `SessionDto` em `src/features/access/application/ports.ts:90`; `CreatePersonInput` em `registration.ts:92` e `registration-api.ts:300` (nomes idênticos, assinaturas diferentes); `audit-api.ts:1-5` e `membership-reconciliation-api.ts:9-13` importam `sessionDtoSchema` de `attendance-api`.
- **Problema:** os imports hoje são explícitos e nomeados (sem barrel), então nada quebra; mas qualquer barrel futuro, re-export genérico ou `import *` provaria o conflito, e o leitor não sabe qual `SessionDto` está vendo sem seguir o import.
- **Impacto no contexto do MVP:** baixo e latente — custo de leitura/manutenção e risco de troca errada do tipo ao editar rota de sessão de atividade pensando em sessão de login.
- **Recomendação:** renomear por domínio (`AuthSessionDto` vs `ActivitySessionDto`, `CreatePersonInput` vs `CreateRegisteredPersonInput`) mantendo alias temporário, e registrar a regra de nome único por símbolo nos docs do pacote.

#### CTR-07. `instantSchema` não é a única forma de instante: sete campos de DTO usam `z.iso.datetime()` cru — severidade: baixo

- **Evidência:** [common.ts](../../packages/contracts/src/common.ts):8 define `instantSchema = z.iso.datetime({ offset: true })`, usado 79 vezes; sete campos de saída usam `z.iso.datetime()` sem a opção: `access-api.ts:32-33`, `account-audit-api.ts:42-43`, `data-quality-api.ts:11-12,81`; verificação de comportamento neste ambiente (com o Zod do próprio pacote, sem escrita): `z.iso.datetime()` **rejeita** `2026-10-07T10:00:00+00:00` e aceita `...Z`, enquanto `offset: true` aceita ambos; contraponto: `civilDateSchema` é a única fonte de data civil (44 usos).
- **Problema:** duas validações de instante com semântica diferente no mesmo pacote — um DTO rejeita um instante que a entrada do mesmo domínio aceita.
- **Impacto no contexto do MVP:** latente — se qualquer serialização passar a emitir `+00:00` em vez de `Z`, a validação de saída no backend e o `safeParse` do web falham com `INVALID_RESPONSE` sem mudança de regra de negócio. Hoje os DTOs vêm de `new Date().toISOString()` (`Z`), por isso não há quebra.
- **Recomendação:** substituir os sete por `instantSchema` **ou** registrar na SPEC a convenção de saída sempre em `Z` com teste de contrato — trocar por `instantSchema` afrouxa a validação de saída, então a direção exige decisão explícita.

#### CTR-08. Path params e `Idempotency-Key` são revalidados por rota, fora do contrato — severidade: baixo

- **Evidência:** 52 ocorrências de `z.uuid()` em `src/**/*-routes.ts` montando o schema de params na mão (ex.: `attendance-routes.ts:30`, `access-routes.ts:22`); `access-routes.ts:24` declara `idempotencyKeySchema` local e as demais rotas fazem `z.uuid().parse(request.headers['idempotency-key'])` (ex.: `attendance-routes.ts:36,48,76,90,102,121`); o contrato exporta `idSchema` (`common.ts:3`) mas não usa nesses pontos; no web a chave só é validada no cliente (`apps/web/src/shared/api-client.ts:72-73`) e chega tipada como `string`.
- **Problema:** corpo e query vêm dos contratos, mas params e header de idempotência são reescritos em cada rota; hoje todos os formatos são `z.uuid()` (comportamento idêntico a `idSchema`) — divergência estrutural, não operante.
- **Impacto no contexto do MVP:** mudança de formato de identificador ou regra da chave de idempotência seriam 52 pontos a localizar sem apoio de tipo; a regra de idempotência das escritas do MVP ficaria espalhada por `presentation`.
- **Recomendação:** exportar de `packages/contracts` um `idParams`/`idempotencyKeySchema` e adotá-los nas rotas, preservando `.strict()` e mantendo em `presentation` apenas a leitura do header.

#### CTR-09. `exports` publica só o subpath genérico para fonte `.ts` crua, sem superfície declarada — severidade: baixo

- **Evidência:** [package.json](../../packages/contracts/package.json):3,6-8 (`private: true`, `exports: { "./*": "./src/*.ts" }`, sem export raiz, sem condição `types`, sem `./package.json`); consumo real: 0 imports de `@erp/contracts` sem subpath em `src/`, `apps/web/src/` e `test/`; `apps/web/node_modules/@erp/contracts` é symlink de workspace; `build.mjs:10-17` põe fastify, `@fastify/*`, `@prisma/*`, `bcrypt`, `redis`, `jose` como `external`, então `@erp/contracts` e `zod` entram no bundle de `dist/`.
- **Problema:** o wildcard transforma qualquer arquivo novo de `src/` em API pública sem declaração, e a resolução depende do comportamento de `exports` de TS/bundler, sem caminho de tipos explícito; contraponto: `private: true` impede publicação acidental e todos os consumidores transpilam.
- **Impacto no contexto do MVP:** nenhum efeito atual verificável; risco evolutivo — renomear um módulo quebra consumidor sem aviso, e um script Node puro não consegue importar o contrato sem loader de TS.
- **Recomendação:** declarar a superfície (lista explícita de subpaths com `types` + `default`) ou manter o wildcard com a condição `types` e um teste que fixe os módulos públicos, documentando no README do pacote que ele é workspace-only e transpilado pelo consumidor.

#### CTR-10. Cobertura de testes de contrato assimétrica: 11 testes para 23 módulos — severidade: baixo

- **Evidência:** `packages/contracts/test/` com 11 arquivos para 23 módulos de `src/`; sem arquivo dedicado: `membership-reconciliation-api.ts`, `audit-api.ts` (só indiretamente), `common.ts`, `access.ts`, **todos os módulos legados** (`attendance.ts`, `registration.ts`, `projects.ts`, `reports.ts`, `audit.ts`, `social-forms.ts`) e `social-form-fields.ts` (fonte única das chaves da ficha).
- **Problema:** módulos sem teste podem mudar sem sinal algum; os legados são justamente os que divergem dos `*-api` (CTR-02), e `social-form-fields` sustenta FIC inteiro sem verificação automatizada.
- **Impacto no contexto do MVP:** regressão em chave de campo da ficha ou em vocabulário legado só apareceria na tela ou em runtime.
- **Recomendação:** um teste de sanidade por módulo exportado (parse de amostra válida + rejeição de chave desconhecida) e um teste de paridade entre `socialFieldKeys` e os campos aprovados em `docs/ficha_cadastro_familias_2025.md`/SPEC-FIC.

### 3.6 Testes (TST) — 11

#### TST-01. `global-setup.ts` invoca `execFileSync('pnpm')`, que falha com ENOENT no Windows — severidade: alto

- **Evidência:** [global-setup.ts](../../test/support/global-setup.ts):1,7-11 (`execFileSync('pnpm', ['db:migrate'], { cwd, env, stdio: 'pipe' })`), executado pelo `globalSetup` de `vitest.integration.config.ts:5`; no ambiente win32 `Get-Command pnpm` resolve para `pnpm.CMD`/`pnpm.ps1` (não há `pnpm.exe`); reprodução read-only em diretório temporário: `execFileSync('pnpm', ['--version'])` → `ENOENT`, `execFileSync('pnpm.cmd', ...)` → `EINVAL`, controle `execFileSync('git', ['--version'])` → OK.
- **Problema:** sem `shell: true` o `child_process` do Node não resolve `pnpm.cmd` no Windows (e desde o fix de CVE do Node, `.cmd` sem shell lança `EINVAL`); a migration exigida pelo setup da suíte nunca roda.
- **Impacto no contexto do MVP:** a suíte de integração — os 36 arquivos que comprovam atomicidade, concorrência, unicidade e vigência exigidos por `AGENTS.md:127` — fica inexecutável no ambiente nativo do repositório; a receita do `README.md:221-225` também não roda em PowerShell. As garantias de transação deixam de ser verificadas na prática diária, mesmo estando escritas.
- **Recomendação:** invocação resiliente — `execSync('pnpm db:migrate', { cwd, env, stdio: 'pipe', shell: true })` ou processo via `process.execPath` —, pois `'pnpm.cmd'` dá `EINVAL`; documentar no README a linha de comando para PowerShell.

#### TST-02. Nenhuma medição de cobertura de testes — severidade: médio

- **Evidência:** `vitest.config.ts:2-13` e `vitest.integration.config.ts:2-12` sem bloco `coverage`; `package.json:30-43` sem `@vitest/coverage-v8` nem outro provider; nenhum script `test:coverage` (`package.json:10-29`); assimetria: 116 arquivos em `src/` (sem `generated`) contra 71 arquivos de teste, dos quais 72 arquivos de `src/` não têm teste no mesmo caminho.
- **Problema:** não existe forma de saber o que está verificado nem de fixar piso mínimo; nada mede se o exigido em `AGENTS.md` (testes de resultados, contratos e limites) está acontecendo.
- **Impacto no contexto do MVP:** invariantes sem teste podem regredir de forma invisível (ex.: regras de aptidão ou de vigência adicionadas em arquivos já existentes).
- **Recomendação:** adicionar `@vitest/coverage-v8` e um script `test:coverage` com provider `v8`/`text`, começando sem threshold obrigatório e elevando por módulo conforme a tarefa.

#### TST-03. `MembershipReconciliationService` é o único service de `application` sem teste unitário — severidade: médio

- **Evidência:** [membership-reconciliation-service.ts](../../src/features/registration/application/membership-reconciliation-service.ts) (523 linhas) sem importador em `test/` (grep = 0); único teste do módulo é HTTP (`test/features/registration/presentation/membership-reconciliation.integration.test.ts:9-158`); todos os demais services têm espelho unitário (`identity-merge-service.test.ts`, `registration-service.test.ts`, `missing-data.test.ts`, `attendance-service.test.ts`, `eligibility-service.test.ts`, `social-forms-service.test.ts`, `reports-service.test.ts`, `access-service.test.ts`, `accounts-service.test.ts`); `registration/domain/membership-reconciliation.ts` é só tipos.
- **Problema:** viola o mandado de testar orquestração de `application` por unidade (`AGENTS.md:127`); o gap está na camada `application`.
- **Impacto no contexto do MVP:** a reconciliação de vínculos concentra os invariantes de vigência histórica e de contexto de família por presença; ramificações não alcançáveis por HTTP (rejeições de plano sem conflito, ordem dos passos da transação, autorização interna por papel, caminhos de erro) só são verificadas de forma indireta e cara.
- **Recomendação:** criar `test/features/registration/application/membership-reconciliation-service.test.ts` com portas falsas cobrindo plano com conflito de presença → erro de regra, plano válido sem alteração de presença, autorização negada e replay/idempotência, mantendo a integração HTTP como prova de contrato.

#### TST-04. Matriz de autorização de leitura da auditoria coberta só pelos casos exercitados — severidade: baixo

- **Evidência:** [audit-scopes.ts](../../src/features/audit/domain/audit-scopes.ts):3-63 (tabela `classification` × `capability` × `entities`) sem teste unitário (grep = 0); autorização verificada indiretamente em `audit.integration.test.ts:40-64`, `audit-store.integration.test.ts:6-52`, `reports-routes.integration.test.ts:448-493`, `social-forms-routes.integration.test.ts:101-131`.
- **Problema:** cada entidade nova só passa a ter autorização verificada se algum teste existir para ela; não há asserção que percorra a tabela inteira.
- **Impacto no contexto do MVP:** autorização no backend para buscas, relatórios, histórico e auditoria é invariante de segurança; um slot esquecido na tabela não gera falha em nenhum teste atual.
- **Recomendação:** teste unitário tabular sobre `auditScopes` (toda entidade mapeada a exatamente uma classificação/capability, sem entidade órfã) complementando os testes HTTP pontuais.

#### TST-05. Asserções genéricas `rejects.toThrow()` sem regra ou código de erro — severidade: baixo

- **Evidência:** [registration-integrity.integration.test.ts](../../test/features/registration/infra/registration-integrity.integration.test.ts):58-78 (três casos: sobreposição de vínculo, titular duplicado, reescrita de código de família) e `audit-store.integration.test.ts:111-116` (imutabilidade da auditoria).
- **Problema:** qualquer erro satisfaz a asserção — inclusive erro acidental (timeout, conexão, bug de tipagem) sem relação com a regra pretendida.
- **Impacto no contexto do MVP:** esses testes protegem vigência, titularidade única e imutabilidade; se quebrarem por outro motivo, o diagnóstico é ambíguo e o teste pode ser consertado trocando a expectativa, enfraquecendo o invariante.
- **Recomendação:** usar `rejects.toMatchObject({ code: 'P2002' })` ou `rejects.toThrow(expect.objectContaining({ rule: 'MEMBERSHIP_OVERLAP' }))`, padrão já adotado em `attendance-integrity.integration.test.ts:140` e `duplicate-rules.test.ts:18-36`.

#### TST-06. Asserção condicional em teste de corrida aceita os dois desfechos — severidade: baixo

- **Evidência:** [attendance-integrity.integration.test.ts](../../test/features/attendance/infra/attendance-integrity.integration.test.ts):57-77 — espera exatamente um `409` e um `2xx`, mas fecha com `expect(sessions).toHaveLength(current.status === 'CLOSED' ? 0 : 1)`.
- **Problema:** a última linha se adapta ao resultado observado — qualquer um dos dois desfechos passa, desde que coerentes entre si; a asserção anterior já restringe bem, mas a consistência final vira tautologia parcial.
- **Impacto no contexto do MVP:** a corrida entre encerramento retroativo e confirmação de sessão é invariante de histórico; a leitura do teste não deixa explícito qual invariante está protegido.
- **Recomendação:** expressar a regra explicitamente nos dois ramos ou, melhor, fixar a pré-condição antes da corrida para tornar o desfecho determinístico.

#### TST-07. `beforeEach` do arquivo de showcase apaga o admin criado pelo fixture compartilhado — severidade: baixo

- **Evidência:** [showcase-seed.integration.test.ts](../../test/features/demo-seed/infra/showcase-seed.integration.test.ts):6-13 — `setupIntegrationFixture()` (linha 6) registra primeiro o `beforeEach` que trunca e faz bootstrap do admin (`test/support/integration-fixture.ts:118-150`); o `beforeEach` do arquivo (`:9-13`) roda depois e executa `TRUNCATE "UserAccount", "AuditEntry", "OperationRecord" CASCADE`, removendo esse admin. *(Inferência sobre ordem: hooks em mesmo nível executam na ordem de registro.)*
- **Problema:** `fixture.admin`/`fixture.adminCookie` ficam pendurados naquele arquivo e a limpeza é redundante (o fixture já trunca as mesmas tabelas); hoje não gera falha porque nenhum teste do arquivo usa o admin (grep = 0).
- **Impacto no contexto do MVP:** armadilha latente: qualquer teste novo que use `fixture.adminCookie` falharia de forma não óbvia (401), com a tendência de investigar o código de produção.
- **Recomendação:** remover o `beforeEach` redundante ou, se a intenção for limpar dados do seed, fazê-lo via helper do fixture que recria o admin em seguida.

#### TST-08. Skip condicional silencioso alcançado pela config unitária, sem CI para expor — severidade: baixo

- **Evidência:** [ui-layout.browser.test.tsx](../../apps/web/test/shared/ui-layout.browser.test.tsx):20-23 (`describe.skipIf(!browserBinary)` condicionado a `AGENT_BROWSER_BIN`), incluído por `vitest.config.ts:6` (`apps/*/test/**/*.test.{ts,tsx}`); único `skipIf` do repositório (grep em `test/**` sem `.only`, `.skip`, `.todo`); sem pipeline de CI (`.github/workflows/*` vazio — ver TOOL-01); hoje o registro vive só em `docs/frontend-status.md:84-88`.
- **Problema:** com `pnpm test` padrão o teste de layout renderizado é descartado sem sinal (listado como skipped apenas se alguém olhar) e nada em merge roda a suíte para notar.
- **Impacto no contexto do MVP:** regressões de layout/capacidades na UI ficam sem detecção automática; um skip silencioso não é reportado por ninguém.
- **Recomendação:** manter o `skipIf` (legítimo — depende de binária externa), mas logar quando a variável não está definida e registrar no README que aquele teste roda apenas com `AGENT_BROWSER_BIN`.

#### TST-09. `*.integration.test.ts` fora de `test/` não roda em nenhuma das duas configs — severidade: baixo

- **Evidência:** `vitest.config.ts:9` exclui `**/*.integration.test.ts` globalmente (inclusive `apps/**` e `packages/**`); `vitest.integration.config.ts:4` inclui apenas `test/**/*.integration.test.ts`; glob `apps/*/test/**` e `packages/*/test/**` hoje não retornam nenhum `.integration.test.ts` — risco latente, não defeito atual.
- **Problema:** um teste de integração criado em `apps/web/test/...` (ex.: contrato de adaptador HTTP contra backend real) seria silenciosamente ignorado nas duas execuções.
- **Impacto no contexto do MVP:** perda de verificação sem nenhum sinal de erro (`vitest run` retorna sucesso).
- **Recomendação:** alinhar os padrões — incluir `apps/*/test/**/*.integration.test.ts` e `packages/*/test/**/*.integration.test.ts` na config de integração ou restringir o `exclude` da unitária ao diretório `test/`.

#### TST-10. Dependências de relógio, porta e contagens internas do fixture — severidade: baixo

- **Evidência:** `redis-sessions.integration.test.ts:44-45` (TTL de 1 ms + espera fixa de 10 ms), `validation.integration.test.ts:106-128` (usa `new Date()` — dia corrente — para asserir 422), `test/app.integration.test.ts:14-16` (porta `1` como PostgreSQL indisponível), `audit-store.integration.test.ts:90` (`pagination.total).toBe(3)` amarrado ao número exato de eventos do setup); únicas 4 ocorrências de variação externa na suíte (grep de `Date.now()|new Date()|Math.random|setTimeout` em `test/**`).
- **Problema:** as margens são amplas (10× no timer; porta 1 quase nunca em uso), mas a asserção de contagem quebra se o fixture passar a gravar um evento de auditoria a mais.
- **Impacto no contexto do MVP:** podem gerar flakiness esporárdico ou quebras de manutenção difíceis de rastrear, corroendo a confiança na suíte.
- **Recomendação:** trocar a espera por polling com limite, derivar a contagem esperada dos eventos em vez de fixar `3` e manter as demais datas fixas (a maioria já é fixa).

#### TST-11. Testes do `apps/web` ficam fora da checagem de tipos — severidade: médio

- **Evidência:** [apps/web/tsconfig.json](../../apps/web/tsconfig.json):6 (`"include": ["src", "vite.config.ts"]` — `apps/web/test/**`, 47 arquivos/~7,8 mil linhas, fica de fora); `apps/web/package.json:6-11` sem script `test` (só `dev`, `build`, `preview`, `typecheck`), suíte roda só pela config raiz (`vitest.config.ts:4-8`); contraste: `tsconfig.json:7` (raiz) e `packages/contracts/tsconfig.json:3` incluem `test`; lint alcança a pasta mas não é lint baseado em tipos; nos arquivos de teste há 28 casts `as unknown as Http*` (ex.: `apps/web/test/features/audit/presentation/audit-page.test.tsx:16,41`) e testes montam `createDemoClient()` em props que nas páginas roteadas são classes `Http*` concretas (`projects-page.test.tsx:47-59`). **Consolidação das fatias 04 (médio) e 05 (baixo).**
- **Problema:** `pnpm --filter @erp/web typecheck` (e `pnpm -r typecheck`) não valida nenhum arquivo de teste — justamente onde estão os maiores desvios de tipo do pacote —, e a divergência entre port e classe HTTP continua invisível porque só `src/` é conferido. **Inferência (não verificada executamente):** com `test/` no `include`, parte desses arquivos provavelmente não compila sem ajustes.
- **Impacto no contexto do MVP:** refatorações de contrato (WEB-01) podem quebrar a suíte sem que `typecheck` acuse; a verificação registrada como gate cobre o código de produto, não os testes de contrato do web.
- **Recomendação:** adicionar `"test"` ao `include` de `apps/web/tsconfig.json` (ou criar `tsconfig.test.json` referenciado por um script `typecheck:test`), corrigir o que aparecer e expor os scripts no manifesto do pacote.

### 3.7 Tooling/build/CI (TOOL) — 12

#### TOOL-01. Ausência total de pipeline de CI — severidade: alto

- **Evidência:** raiz do repositório sem `.github/`, `.gitlab-ci.yml`, `azure-pipelines.yml`, `Jenkinsfile`; sem hooks de git (`package.json:30-43` não tem husky/lint-staged e não há diretório `.husky`); gates existem apenas como scripts manuais (`package.json:14-28`).
- **Problema:** `typecheck`, `lint`, `test`, `build` e `format:check` dependem exclusivamente de execução manual por quem faz a tarefa.
- **Impacto no contexto do MVP:** o AGENTS exige executar os scripts oficiais por tarefa, mas nada garante isso em merge. Regressões podem entrar sem nenhum gate, e falhas como a do `format:check` (TOOL-02) persistem silenciosamente. O artefato arquitetural (`test/eslint-config.test.ts`) só roda quando alguém executa `pnpm test`.
- **Recomendação:** criar CI mínimo (ex.: GitHub Actions) com Node `24.18.0` via `.node-version`: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` e `pnpm format:check` (após corrigir TOOL-02).

#### TOOL-02. `pnpm format:check` falha em 409 arquivos por drift de fim de linha (CRLF vs LF) — severidade: alto

- **Evidência:** `.prettierrc.json:1` (default `lf`); execução de `pnpm format:check` → exit 1 com `Code style issues found in 409 files`; ausência de `.gitattributes`; `git config core.autocrlf` → `true`; `git ls-files --eol` → `i/lf w/crlf` em `src/main.ts`, `package.json`, `tsconfig.json`. O stdout de `prettier src/main.ts` é idêntico ao conteúdo do arquivo sem `\r`.
- **Problema:** o Git normaliza para LF no índice, o checkout no Windows produz CRLF e o Prettier compara contra LF.
- **Impacto no contexto do MVP:** a receita "Validar" termina com falha no Windows; na prática o gate vira ruído e é ignorado.
- **Recomendação:** fixar explícito `"endOfLine": "lf"` no `.prettierrc.json` e adicionar `.gitattributes` (`* text=auto eol=lf`); depois executar `pnpm format` uma única vez.

#### TOOL-03. `tsconfig.json` da raiz não cobre `vitest.config.ts` nem `vitest.integration.config.ts` — severidade: médio

- **Evidência:** `tsconfig.json:7` (`"include": ["src", "test", "prisma.config.ts"]`); `vitest.config.ts` e `vitest.integration.config.ts` fora do include; contraste: `apps/web/tsconfig.json:6` inclui `vite.config.ts`.
- **Problema:** as duas configs de teste na raiz ficam fora da checagem de tipos (`pnpm typecheck:api`).
- **Impacto no contexto do MVP:** erro de digitação/tipo nessas configs quebra silenciosamente a suíte sem que a verificação de tipos acuse.
- **Recomendação:** adicionar `vitest.config.ts` e `vitest.integration.config.ts` ao `include` da raiz.

#### TOOL-04. O lint não alcança os arquivos de configuração da raiz — severidade: médio

- **Evidência:** `package.json:17` → `eslint src test apps packages --max-warnings 0`; o script ignora `build.mjs`, `eslint.config.mjs`, `prisma.config.ts`, `vitest*.ts`. Assimetria: Prettier cobre esses arquivos (`package.json:25-26`).
- **Problema:** as regras `files: ['**/*.{ts,tsx}']` existem, mas o script nunca aponta para os arquivos soltos da raiz.
- **Impacto no contexto do MVP:** o artefato de build e a configuração do próprio lint ficam sem checagem automática de importação.
- **Recomendação:** trocar para `eslint .` (com `ignores` de `eslint.config.mjs:5`) ou listar explicitamente os arquivos.

#### TOOL-05. Restrição de camada de `infra` não bloqueia frameworks HTTP — severidade: médio

- **Evidência:** `eslint.config.mjs:172-188` restringe `**/presentation/**` para `infra`, com a mensagem "Infrastructure implements application ports without HTTP dependencies", mas não lista `fastify`/`@fastify/*`. Contraste: `domain` e `application` bloqueiam.
- **Problema:** a regra não impede que um adaptador importe Fastify, contradizendo a mensagem da regra e a separação documentada (AGENTS.md).
- **Impacto no contexto do MVP:** rota de regressão silenciosa para o monólito modular; o teste arquitetural não cobre esse caso específico.
- **Recomendação:** adicionar `fastify` e `@fastify/*` aos `patterns` do bloco de `infra` e registrar o caso em `test/eslint-config.test.ts`.

#### TOOL-06. O artefato compilado (`dist/`) não é exercitado por nenhuma verificação — severidade: médio

- **Evidência:** `build.mjs:2-18` empacota `@erp/contracts` e Prisma gerado, externalizando Fastify/outros; `dist/` não existe e nenhum teste roda `dist/main.js`; `vitest` roda direto sobre a fonte.
- **Problema:** nenhuma verificação valida que o bundle gerado sobe e acessa banco/cache.
- **Impacto no contexto do MVP:** a receita do artefato compilado pode falhar em runtime sem detecção prévia.
- **Recomendação:** adicionar smoke test do artefato no CI (ex.: `node --check dist/main.js` + boot rápido com banco de teste) e documentar na spec o que compõe o bundle.

#### TOOL-07. `engines`/`.node-version` sem enforcement no gerenciador de pacotes — severidade: baixo

- **Evidência:** `package.json:6-9` e `.node-version` fixam Node `24.18.0` e pnpm `12.10.1`; `pnpm-workspace.yaml:1-11` sem `engineStrict`; sem `.npmrc`.
- **Problema:** o pnpm não falha a instalação se o runtime ou sua versão diferir.
- **Impacto no contexto do MVP:** contribuidor com ambiente divergente não é bloqueado, risco de build incompatível.
- **Recomendação:** ativar `engineStrict: true` no `pnpm-workspace.yaml` e garantir a versão em CI.

#### TOOL-08. `.env.example` sem comandos para segredos e com default divergente — severidade: baixo

- **Evidência:** `src/core/infra/config.ts:6-62` exige segredos, `.env.example` deixa `OPERATION_HMAC_KEYS_JSON={"v1":""}`, o que derruba o boot; `COOKIE_SECURE=false` no exemplo, default é `true` no código; variáveis de teste de integração não citadas.
- **Problema:** cópia literal do exemplo não sobe a aplicação.
- **Impacto no contexto do MVP:** onboarding lento, diagnósticos confusos.
- **Recomendação:** adicionar scripts geradores e corrigir os comentários explicativos no arquivo base.

#### TOOL-09. Scripts dos pacotes filhos ocultos e omissos na documentação — severidade: baixo

- **Evidência:** `apps/web/package.json` sem `test`/`lint`; `packages/contracts/package.json` só com `typecheck`. A raiz orquestra (`package.json:16-18`), mas o README não detalha a suíte fora de `test/`.
- **Problema:** execução pontual local não resolve nos subpacotes; documentação subestima a cobertura.
- **Impacto no contexto do MVP:** induz a falsa sensação de que contratos e o web não possuem suítes ou testes de formatação.
- **Recomendação:** adicionar scripts que deleguem ou documentar na seção "Validar".

#### TOOL-10. Prettier não cobre arquivos markdown ou YAML vitais — severidade: baixo

- **Evidência:** `package.json:25-26` varre `*.json *.mjs *.ts` e diretórios específicos; dotfiles e docs da raiz e os `compose.yaml` não são escaneados.
- **Problema:** formatação divergente em `.md` nunca é acusada no `format:check`.
- **Impacto no contexto do MVP:** apenas ruído editorial.
- **Recomendação:** aditar `*.md` e `*.yaml` ao script.

#### TOOL-11. Frontend sem restrição de importação de camadas (`eslint`) — severidade: baixo

- **Evidência:** `eslint.config.mjs:189-213` não define `domain/application/presentation/infra` para o web.
- **Problema:** componentes React (`presentation`) importam livremente implementações HTTP (`infra`) via valor se quiserem, contrariando o isolamento.
- **Impacto no contexto do MVP:** o web já tem a arquitetura desenhada, mas pode degradar silenciosamente.
- **Recomendação:** adicionar blocos espelhando a raiz para `apps/web/src/features/**`, usando `allowTypeImports` para a `presentation` (ver WEB-01).

#### TOOL-12. Spec de fundação reporta os comandos vigentes como não existentes — severidade: baixo

- **Evidência:** `docs/specs/00-foundation.md:23` descreve os comandos npm/pnpm como "entregáveis a criar".
- **Problema:** texto desatualizado.
- **Impacto no contexto do MVP:** confusão na leitura, nenhum impacto de runtime.
- **Recomendação:** atualizar texto para descrever como "comandos já disponíveis".

### 3.8 Contexto divergente (código × documentação) (CTX) — 8

#### CTX-01. `VALIDATION_ERROR` traduzido incorretamente como uma regra temporal — severidade: médio

- **Evidência:** `apps/web/src/shared/use-action.ts:40-41` traduz `VALIDATION_ERROR` (do Zod) em uma mensagem literal de erro de vigência no futuro, ignorando `details.fields`.
- **Problema:** validações genéricas Zod ou parsing geram mensagens desconexas ao usuário.
- **Impacto no contexto do MVP:** diagnóstico ambíguo que afasta o operador da verdadeira causa.
- **Recomendação:** devolver a mensagem genérica de `use-action.ts:11-12`, exibindo a chave se presente, e usar `BUSINESS_RULE_VIOLATION` para vigência futura.

#### CTX-02. Tradução de erro em 403 e 422 ignora `details.rule` — severidade: médio

- **Evidência:** `use-action.ts:33` e `50-51` aplicam textos fixos para `FORBIDDEN` e `BUSINESS_RULE_VIOLATION`, ignorando o `details.rule` vindo do backend (`error-mapper.ts`).
- **Problema:** regras de domínio específicas são unificadas em uma única string na interface.
- **Impacto no contexto do MVP:** a UI perde o detalhamento exigido pela spec (ex: perfil correto, mas operação indisponível).
- **Recomendação:** traduzir o enum de `rule` em mensagens claras na UI, caindo pro genérico só quando omitido.

#### CTX-03. Indisponibilidade de API ou capacidade apresentadas como "não implementado nesta etapa" — severidade: médio

- **Evidência:** em `activity-page.tsx`, as atividades `ONE_OFF` (excluídas do MVP documentado) ou requisições de usuário sem permissão exibem mensagem genérica de que a rota/feature não está na "etapa".
- **Problema:** uma exclusão intencional ou restrição de perfil é confundida com feature a ser desenvolvida.
- **Impacto no contexto do MVP:** desvio da documentação oficial da ERS/PRD; falsas esperanças ao operador.
- **Recomendação:** tratar ausência de permissão e features ausentes/removidas de forma distinta e sem aludir ao termo "etapa".

#### CTX-04. Componentes e fluxos de demonstração misturados nos testes e bundle — severidade: médio

- **Evidência:** páginas inalcançáveis (`login-page.tsx`, `app-layout.tsx` demo, barris) geram bundle/teste paralelo, e o contrato de UI injeta chamadas dummy (`demoAccounts`, `enterDemo`).
- **Problema:** duas camadas quebram o isolamento. A mensagem de `login-page` ("o acesso real não está conectado") está obsoleta.
- **Impacto no contexto do MVP:** testes passam usando versões falsas; código morto no bundle de produção.
- **Recomendação:** remover os artefatos de "protótipo" (conforme `frontend-status.md`) do bundle conectado ou isolar fisicamente as chamadas Demo.

#### CTX-05. Matriz de permissão TypeScript no frontend bifurca do backend — severidade: baixo

- **Evidência:** o backend tem `src/features/access/domain/permissions.ts`. O web define sua versão ignorando ~5 permissões vitais e a regra de reposição, sendo usada só pelo runtime do demo.
- **Problema:** duas fontes desiguais para um mesmo enum crítico.
- **Impacto no contexto do MVP:** testes com mock frontend podem mascarar falhas no backend real.
- **Recomendação:** derivar do contrato compartilhado via `@erp/contracts/access` e limpar o `hasCapability` abandonado.

#### CTX-06. Oito rotas sem a declaração nativa de capacidade (`capabilities:`) — severidade: baixo

- **Evidência:** várias rotas (ex: `POST /activities/:id/enrollments`) dependem da verificação imperativa no service em vez do helper do Fastify plugin.
- **Problema:** o contrato público diverge da implementação.
- **Impacto no contexto do MVP:** dificultam a revisão estática de segurança. Como a autorização de fato é checada, não vira CVSS.
- **Recomendação:** documentar com comentário as rotas que dependem ativamente de verificação em nível de serviço.

#### CTX-07. Checagem de privilégio atalho oculta exceção `PASSWORD_CHANGE_REQUIRED` — severidade: baixo

- **Evidência:** `ProjectsService.authorize` usa `assertPermission` com atalho opaco `capabilities[0]!`.
- **Problema:** atalho confuso de leitura do código de segurança.
- **Impacto no contexto do MVP:** nenhum funcional. Recomenda-se simplificação para clareza em caso de debug.
- **Recomendação:** renomear a operação ou retirar o desvio oculto de non-null.

#### CTX-08. Costuras de prototipagem em importadores e rotas de auditoria — severidade: baixo

- **Evidência:** `HttpAudit.list` pagina listagens varrendo tudo para perfis que só possuam `registration.read`.
- **Problema:** herança dos testes mock.
- **Impacto no MVP:** sem quebra, mas impõe padrão que a UI real não utilizará.
- **Recomendação:** exigir filtro, ou limpar exportações fantasmas.

## 4. Próximos passos e decisões em aberto

1. Qual a política definitiva do MVP sobre cross-feature import (`domain` e `infra`) e reuso de transação? A arquitetura modular do monólito aceita essas dependências ou a exigência é isolamento forte (ARQ-02, BE-05)?
2. A unidade de revalidação de cadastro (bloqueio `FOR UPDATE` ordenado) será documentada e uniformizada pelas regras de `Family` ou `Person` primárias? (BE-03, PER-03).
3. O vocabulário de auditoria (`AuditAction`) deve manter o status `PUBLISH` mesmo que nunca inserido, ou convergir integralmente entre schema e interface? (CTR-01).
4. As classes "Demo" e os painéis mortos serão mantidos e documentados como "para demonstrações offline" ou expurgados do branch do MVP conectado? (WEB-03, CTX-04).
5. Onde o MVP deve aplicar debounce e listagem restrita para não criar sobrecarga de banco de dados na busca de cadastros/pessoas? (WEB-05).
