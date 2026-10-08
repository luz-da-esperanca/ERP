# Analysis: 06-tests

Read-only exploration of the slice `06-tests` (ordinal `06`) for the research prompt:

> Arquitetura e qualidade dos testes: espelhamento de `src/` em `test/`, separação unit vs integração (vitest.config.ts vs vitest.integration.config.ts vs compose.test.yaml), uso de mocks/doubles conforme a doc (mocks não comprovam atomicidade/concorrência), cobertura dos invariantes críticos (vigência de vínculos, presença vs inscrição, aptidão pendente, autorização em leituras, auditoria na mesma transação, unificação/duplicidades), testes determinísticos e isolados, fixtures compartilhadas em `test/support/`, dívida (skip, .only, testes triviais que só exercutam snapshot, asserts fracos, código morto de teste).

## Scope

- Slice question: arquitetura e qualidade da suíte de testes (espelhamento, separação unit/integração, doubles, invariantes do MVP, determinismo/isolamento, fixtures e dívida).
- Primary sources: `test/**` (71 arquivos `*.test.ts` + 9 arquivos em `test/support/`), `vitest.config.ts`, `vitest.integration.config.ts`, `compose.test.yaml`.
- Sources read in full vs. sampled:
  - **Lidos por inteiro (escopo primário):** `vitest.config.ts`, `vitest.integration.config.ts`, `compose.test.yaml`, `test/support/global-setup.ts`, `test/support/integration-environment.ts`, `test/support/integration-fixture.ts`, `test/support/access-service-fixture.ts`, `test/support/attendance-fixture.ts`, `test/eslint-config.test.ts`, `test/core/application/data-mode.test.ts`, `test/app.integration.test.ts`, `test/features/registration/infra/cpf-conflict.test.ts`, `test/features/registration/infra/registration-integrity.integration.test.ts`, `test/features/registration/domain/membership-rules.test.ts`, `test/features/registration/domain/missing-data-rules.test.ts`, `test/features/registration/presentation/membership-reconciliation.integration.test.ts`, `test/features/attendance/infra/attendance-integrity.integration.test.ts`, `test/features/attendance/domain/frequency-rules.test.ts`, `test/features/attendance/presentation/audit.integration.test.ts`, `test/features/attendance/presentation/dependent-invariants.integration.test.ts`, `test/features/attendance/presentation/validation.integration.test.ts`, `test/features/eligibility/domain/evaluate-eligibility.test.ts`, `test/features/audit/infra/audit-store.integration.test.ts`, `test/features/access/infra/redis-sessions.integration.test.ts`, `test/features/access/infra/jwt-tokens.integration.test.ts`, `test/features/social-forms/presentation/social-forms-routes.test.ts`, `test/features/demo-seed/infra/showcase-seed.integration.test.ts` (linhas 1-60).
  - **Lidos parcialmente (amostra representativa de invariantes):** `test/features/reports/presentation/reports-routes.integration.test.ts` (111-163, 445-545), `test/features/registration/presentation/registration-queries.integration.test.ts` (1-60), `test/features/registration/domain/duplicate-rules.test.ts` (1-30), `test/features/registration/domain/identity-merge-rules.test.ts` (1-30).
  - **Fora do escopo estrito, lido só para contexto:** `AGENTS.md` (política de testes), template `.agents/skills/agent-exploration/assets/analysis-template.md`, `package.json` (scripts), `README.md` (receita "Validar"), `prisma/migrations/*/migration.sql` (análise de FKs para validar o TRUNCATE do fixture), `apps/web/test/shared/ui-layout.browser.test.tsx:1-70` (único `skipIf` alcançado pelo include da config unitária), artefato da fatia irmã `07_analysis_tooling-config.md` (apenas cabeçalhos, para não duplicar achado).
- Total candidate sources surveyed: ~90 (71 testes-raiz + 9 fixtures + 2 configs + compose + manifestos + inventário completo de `src/**/*.ts` sem `generated` = 116 arquivos).

Execuções read-only realizadas durante a exploração (nenhuma escrita além deste artefato; a suíte de testes **não** foi executada):

- Inventários com `Get-ChildItem`/`Grep` de `src/` e `test/`, comparação de caminhos espelhados (`src\x\y.ts` vs `test\x\y.test.ts`).
- Contagens por arquivo de `it(`/`it.each(` e `expect(` (35 unitários com 234 `it`/560 `expect`; 36 de integração com 121 `it`/808 `expect`).
- Grep por `.only`/`.skip`/`.skipIf`/`.todo`/`toMatchSnapshot`/`vi.mock(`/`vi.spyOn`/`mockDeep`/`eslint-disable`/`as any`/`Promise.all`/`new Date()`/`setTimeout`.
- Reprodução do primitive de `global-setup.ts` em diretórios temporários fora do repositório: `execFileSync('pnpm', ['--version'])` → `ERR ENOENT`; `execFileSync('pnpm.cmd', ...)` → `ERR EINVAL`; `execFileSync('git', ['--version'])` → OK (control, prova que o PATH está correto e que `.exe` resolve).
- `git log --oneline -12` e `git status --porcelain` (somente leitura; working tree limpo fora de `.audits/`).
- Glob de `.github/workflows/*` → nenhum arquivo (CI ausente, já apontado pela fatia 07).

## Overview

A suíte de testes é **grande, organizada por feature e, na maior parte, exemplar** para a política declarada em `AGENTS.md`: 71 arquivos `*.test.ts` sob `test/` (35 unitários, 36 `*.integration.test.ts`), mais 45 arquivos (187 casos) de componente/adaptador em `apps/web/test/` (32 `.tsx` + 13 `.ts`) e 11 arquivos (38 casos) em `packages/contracts/test/`, todos alcançados pela config unitária (`vitest.config.ts:4-8`).

A separação unit/integração é feita por sufixo e é coerente: a config unitária **exclui** `**/*.integration.test.ts` (`vitest.config.ts:9`), a config de integração **inclui apenas** esses arquivos (`vitest.integration.config.ts:4`), roda `globalSetup` com a migration real (`vitest.integration.config.ts:5` → `test/support/global-setup.ts:7-11`), serializa arquivos (`fileParallelism: false`, linha 8) e amplia timeouts (linhas 9-10). O `compose.test.yaml` sobe Postgres 18 e Redis 7 em `127.0.0.1` com healthcheck, dados voláteis (`tmpfs`, Redis sem `--save`), e o guard `integration-environment.ts:8-9` exige banco cujo nome termina em `_test` antes de qualquer truncamento.

O ponto mais forte é o uso de **PostgreSQL/Redis reais para as garantias que mocks não comprovam**, exatamente como manda o AGENTS: cinco suítes criam trigger/constraint sintéticos (`fail_attendance_audit`, `fail_social_form_audit`, `fail_missing_data_audit`, `fail_merge_audit`, `CHECK` em `AuditEntry`) para forçar falha de auditoria e verificar rollback do negócio, da operação idempotente e da chave ao mesmo tempo; há corridas com `Promise.all` (CPF único, titular único, encerramento retroativo vs. confirmação de sessão, última conta administradora), unicidade por `P2002` e vigência por constraint de sobreposição. Doubles existem apenas nas portas (`vi.fn()` tipado com `satisfies` em `test/support/access-service-fixture.ts:44-88`), nunca dentro do domínio; não há `vi.mock` de módulo nem `vitest-mock-extended`.

Os seis invariantes críticos do AGENTS estão cobertos por asserções observáveis e não triviais (detalhes em "Achados"; os padrões positivos reutilizáveis estão em "Transferable Patterns"). A dívida clássica está praticamente ausente: **zero** `.only`, `.skip`, `.todo`, `toMatchSnapshot`/`toMatchInlineSnapshot`, `eslint-disable` ou `as any` em `test/**`; nenhum fixture órfão (todos os 9 arquivos de `test/support/` têm importadores).

O que falta é infraestrutura de medição e alguns pontos finos: não há medição de cobertura, o `globalSetup` não executa no Windows (verificado), um service de `application` ficou sem teste unitário e há asserts genéricos/condicionais pontuais. A soma é ~355 testes e ~1.368 `expect`.

## Achados

### 1. `global-setup.ts` invoca `execFileSync('pnpm')`, que falha com ENOENT no Windows — severidade: alto

- **Evidência:** `test/support/global-setup.ts:1,7-11` — `execFileSync('pnpm', ['db:migrate'], { cwd, env, stdio: 'pipe' })`, executado pelo `globalSetup` de `vitest.integration.config.ts:5`; no ambiente deste repositório (win32) `Get-Command pnpm` resolve para `pnpm.CMD`/`pnpm.ps1` (não há `pnpm.exe`). Reprodução read-only em diretório temporário: `execFileSync('pnpm',['--version'])` → `ENOENT: spawnSync pnpm ENOENT`; `execFileSync('pnpm.cmd', ...)` → `EINVAL`; controle `execFileSync('git',['--version'])` → OK. (Evidência direta do primitive; a suíte completa não foi executada.)
- **Problema:** sem `shell: true`, o `child_process` do Node não resolve `pnpm.cmd` no Windows (e desde o fix de CVE do Node, `.cmd` sem shell lança `EINVAL`). A migration exigida pelo setup da suíte nunca roda.
- **Impacto no MVP:** a suíte de integração — os 36 arquivos que comprovam atomicidade, concorrência, unicidade e vigência exigidos por `AGENTS.md:127` — fica inexecutável no ambiente nativo do repositório, que é Windows. A receita do `README.md:221-225` (bash com continuação de linha) também não roda em PowerShell. O efeito prático é que as garantias de transação deixam de ser verificadas na prática diária, mesmo estando escritas.
- **Recomendação:** trocar por uma invocação resiliente, ex. `execSync('pnpm db:migrate', { cwd, env, stdio: 'pipe', shell: true })` ou `execFileSync(process.execPath, [require.resolve('prisma/...'), 'migrate', 'deploy'], ...)`; não basta `'pnpm.cmd'` (dá `EINVAL`). Documentar no README a linha de comando para PowerShell.

### 2. Nenhuma medição de cobertura de testes — severidade: médio

- **Evidência:** `vitest.config.ts:2-13` e `vitest.integration.config.ts:2-12` sem bloco `coverage`; `package.json:30-43` sem `@vitest/coverage-v8` nem outro provider; nenhum script `test:coverage` (`package.json:10-29`).
- **Problema:** não existe forma de saber quê parte da base está verificada nem de fixar piso mínimo; a contagem de arquivos mostra a assimetria: 116 arquivos em `src/` (sem `generated`) contra 71 arquivos de teste (69 raízes únicas), dos quais 72 arquivos de `src/` não têm teste no mesmo caminho (grande parte são `*-ports.ts`, `*-errors.ts` e types, mas incluem casos com lógica).
- **Impacto no MVP:** invariantes sem teste podem regredir de forma invisível (ex.: regras de aptidão ou de vigência adicionadas em arquivos já existentes). O AGENTS pede "testes de resultados, contratos e limites" para comportamento novo, mas nada mede se isso está acontecendo.
- **Recomendação:** adicionar `@vitest/coverage-v8` e um script `test:coverage` com provider `v8`/`text`, começando sem threshold obrigatório e elevando por módulo conforme a tarefa; rodar pontualmente em revisões grandes.

### 3. `MembershipReconciliationService` é o único service de `application` sem teste unitário — severidade: médio

- **Evidência:** `src/features/registration/application/membership-reconciliation-service.ts` (523 linhas) não é importado por nenhum arquivo de `test/` (grep por `membership-reconciliation-service|MembershipReconciliationService` em `test/**` → zero ocorrências); o único teste do módulo é HTTP: `test/features/registration/presentation/membership-reconciliation.integration.test.ts:9-158`. Contraste com os demais services, todos com espelho unitário: `identity-merge-service.test.ts`, `registration-service.test.ts`, `missing-data.test.ts`, `missing-data-selection-service.test.ts`, `attendance-service.test.ts`, `eligibility-service.test.ts`, `social-forms-service.test.ts`, `reports-service.test.ts`, `access-service.test.ts`, `accounts-service.test.ts`.
- **Problema:** viola a regra "Teste regras de `domain` e orquestração de `application` por unidade" (`AGENTS.md:127`). Obs.: `src/features/registration/domain/membership-reconciliation.ts` é apenas um arquivo de tipos (interfaces, sem funções), portanto o gap está na camada `application`.
- **Impacto no MVP:** a reconciliação de vínculos é justamente onde estão os invariantes de vigência histórica e de contexto de família por presença. Ramificações não alcançáveis por HTTP (rejeições de plano sem conflito, ordem dos passos da transação, autorização interna por papel, caminhos de erro mapeados) só são verificadas de forma indireta e cara.
- **Recomendação:** criar `test/features/registration/application/membership-reconciliation-service.test.ts` com portas falsas, cobrindo ao menos: plano com conflito de presença → erro de regra, plano válido sem alteração de presença, autorização negada e replay/idempotência; manter a integração HTTP como prova de contrato.

### 4. Matriz de autorização de leitura da auditoria coberta só pelos casos exercitados — severidade: baixo

- **Evidência:** `src/features/audit/domain/audit-scopes.ts:3-63` (tabela `classification` × `capability` × `entities`) não tem teste unitário (grep por `auditScopes|audit-scopes` em `test/**` → zero). A autorização é verificada indiretamente: `test/features/attendance/presentation/audit.integration.test.ts:40-64` (403 para admin em `ActivitySession`, 404 para `Family` fora do escopo), `test/features/audit/infra/audit-store.integration.test.ts:6-52` (403 por lista, 404 por id), `test/features/reports/presentation/reports-routes.integration.test.ts:448-493`, `test/features/social-forms/presentation/social-forms-routes.integration.test.ts:101-131`.
- **Problema:** cada entidade nova adicionada à tabela só passa a ter autorização verificada se algum teste existir para ela; não há asserção que percorra a tabela inteira.
- **Impacto no MVP:** "Faça autorização no backend para operações e dados retornados, incluindo buscas, relatórios, histórico e auditoria" (`AGENTS.md:116`) é um invariante de segurança; um slot esquecido na tabela não gera falha em nenhum teste atual.
- **Recomendação:** teste unitário tabular sobre `auditScopes` (toda entidade mapeada a exatamente uma classificação/capability, sem entidade órfã) complementando os testes HTTP pontuais.

### 5. Asserções genéricas `rejects.toThrow()` sem regra ou código de erro — severidade: baixo

- **Evidência:** `test/features/registration/infra/registration-integrity.integration.test.ts:58-78` (três casos: `rejects.toThrow()` para sobreposição de vínculo, titular duplicado e reescrita de código de família), `test/features/audit/infra/audit-store.integration.test.ts:111-116` (imutabilidade da auditoria).
- **Problema:** qualquer erro satisfaz a asserção — inclusive um erro acidental (timeout, conexão, bug de tipagem) que não tenha relação com a regra pretendida.
- **Impacto no MVP:** esses testes protegem vigência, titularidade única e imutabilidade da auditoria; se quebrarem por outro motivo, o diagnóstico é ambíguo e o teste pode ser "consertado" trocando a expectativa, enfraquecendo o invariante.
- **Recomendação:** usar `rejects.toMatchObject({ code: 'P2002' })` ou `rejects.toThrow(expect.objectContaining({ rule: 'MEMBERSHIP_OVERLAP' }))`, padrão já adotado em `attendance-integrity.integration.test.ts:140` e `duplicate-rules.test.ts:18-36`.

### 6. Asserção condicional em teste de corrida aceita os dois desfechos — severidade: baixo

- **Evidência:** `test/features/attendance/infra/attendance-integrity.integration.test.ts:57-77` — espera exatamente um `409` e um `2xx`, mas fecha com `expect(sessions).toHaveLength(current.status === 'CLOSED' ? 0 : 1)`.
- **Problema:** a última linha se adapta ao resultado observado: qualquer um dos dois desfechos passa, desde que sejam coerentes entre si. A asserção anterior já restringe bem (1×409 + 1×2xx), mas a consistência final vira tautologia parcial.
- **Impacto no MVP:** a corrida entre encerramento retroativo e confirmação de sessão é um invariante de histórico; a leitura do teste não deixa explícito qual invariante está sendo protegido (encerrado ⇒ zero sessões válidas; aberto ⇒ exatamente uma).
- **Recomendação:** expressar a regra explicitamente (`if (current.status === 'CLOSED') expect(sessions).toHaveLength(0); else expect(sessions).toHaveLength(1);`) ou, melhor, fixar a pré-condição antes da corrida para tornar o desfecho determinístico.

### 7. `beforeEach` do arquivo de showcase apaga o admin criado pelo fixture compartilhado — severidade: baixo

- **Evidência:** `test/features/demo-seed/infra/showcase-seed.integration.test.ts:6-13` — `setupIntegrationFixture()` (linha 6) registra primeiro o `beforeEach` que trunca e faz bootstrap do admin (`test/support/integration-fixture.ts:118-150`); o `beforeEach` do arquivo (linhas 9-13) roda depois e executa `TRUNCATE "UserAccount", "AuditEntry", "OperationRecord" CASCADE`, removendo esse admin. *(Inferência sobre ordem: hooks em mesmo nível executam na ordem de registro.)*
- **Problema:** `fixture.admin`/`fixture.adminCookie` ficam pendurados dentro daquele arquivo; a limpeza também é redundante (o fixture já trunca as mesmas tabelas). Hoje não gera falha porque nenhum teste do arquivo usa o admin do fixture (grep por `adminCookie|fixture\.admin` nesse arquivo → zero).
- **Impacto no MVP:** armadilha latente: qualquer teste novo nesse arquivo que use `fixture.adminCookie` falharia de forma não óbvia (401 em requisições que "deveriam" funcionar), e a tendência é investigar o código de produção.
- **Recomendação:** remover o `beforeEach` redundante (o fixture já limpa) ou, se a intenção for limpar os dados do seed, fazê-lo via helper do fixture que recria o admin em seguida.

### 8. Skip condicional silencioso alcançado pela config unitária, sem CI para expor — severidade: baixo

- **Evidência:** `apps/web/test/shared/ui-layout.browser.test.tsx:20-23` — `describe.skipIf(!browserBinary)` condicionado a `AGENT_BROWSER_BIN`; esse arquivo é incluído por `vitest.config.ts:6` (`apps/*/test/**/*.test.{ts,tsx}`). Verificação por grep: nenhum `.only`, `.skip` ou `.todo` em `test/**`; único `skipIf` do código de teste no repositório está nesse arquivo. Não existe pipeline de CI (glob `.github/workflows/*` → vazio; já registrado pela fatia 07).
- **Problema:** com `pnpm test` padrão, o teste de layout renderizado é descartado sem sinal (a saída do Vitest lista como skipped apenas se alguém olhar), e nada em merge roda a suíte para notar.
- **Impacto no MVP:** regressões de layout/capacidades na UI ficam sem detecção automática; o AGENTS exige informar verificações executadas, mas um skip silencioso não é reportado por ninguém.
- **Recomendação:** manter o `skipIf` (é legítimo — depende de binária externa), mas tornar a ausência explícita: logar no `globalSetup`/setup do arquivo quando a variável não está definida e registrar no README que aquele teste roda apenas com `AGENT_BROWSER_BIN` (hoje documentado só em `docs/frontend-status.md:84-88`).

### 9. Nenhum `*.integration.test.ts` fora de `test/` rodaria em nenhuma das duas configs — severidade: baixo

- **Evidência:** `vitest.config.ts:9` exclui `**/*.integration.test.ts` globalmente (inclusive `apps/**` e `packages/**`), enquanto `vitest.integration.config.ts:4` inclui apenas `test/**/*.integration.test.ts`. Glob `apps/*/test/**/*` e `packages/*/test/**/*` hoje não retornam nenhum `.integration.test.ts` → é risco latente, não defeito atual.
- **Problema:** um teste de integração criado em `apps/web/test/...` (ex.: contrato de adaptador HTTP contra backend real) seria silenciosamente ignorado nas duas execuções.
- **Impacto no MVP:** perda de verificação sem nenhum sinal de erro (`vitest run` retorna sucesso).
- **Recomendação:** alinhar os padrões (adicionar `apps/*/test/**/*.integration.test.ts` e `packages/*/test/**/*.integration.test.ts` ao include da config de integração, ou restringir o `exclude` da unitária ao diretório `test/`).

### 10. Dependências de relógio, porta e contagens internas do fixture — severidade: baixo

- **Evidência:** `test/features/access/infra/redis-sessions.integration.test.ts:44-45` (TTL de 1 ms + espera fixa de 10 ms), `test/features/attendance/presentation/validation.integration.test.ts:106-128` (usa `new Date()` — dia corrente — para asserir `422`), `test/app.integration.test.ts:14-16` (porta `1` como "PostgreSQL indisponível"), `test/features/audit/infra/audit-store.integration.test.ts:90` (`pagination.total).toBe(3)` amarrado ao número exato de eventos gerados pelo setup do fixture).
- **Problema:** são as únicas fontes de variação externa detectadas na suíte (grep por `Date.now()|new Date()|Math.random|setTimeout` em `test/**` retornou 4 ocorrências). As margens são amplas (10× no timer; porta 1 quase nunca em uso), mas a asserção de contagem quebra se o fixture passar a gravar um evento de auditoria a mais.
- **Impacto no MVP:** baixo: podem gerar flakiness esporárdico ou quebras de manutenção difíceis de rastrear, o que corro a confiança na suíte.
- **Recomendação:** trocar a espera por polling com limite (`pExpire` + `checkLogin` em loop com deadline), derivar a contagem esperada dos eventos em vez de fixar `3`, e manter as demais datas fixas (a maioria já é fixa, ex. `2026-01-05T13:00:00Z`).

## Relevant Sources

- `vitest.config.ts:4-12` — include de `test/**`, `apps/*/test/**`, `packages/*/test/**`; `exclude: ['**/*.integration.test.ts']`; `environment: 'node'`; `restoreMocks: true`.
- `vitest.integration.config.ts:4-11` — include só de `*.integration.test.ts`, `globalSetup`, `fileParallelism: false`, `testTimeout: 20000`, `hookTimeout: 30000`.
- `compose.test.yaml:1-26` — Postgres 18 (`127.0.0.1:55432`, `tmpfs`, healthcheck) e Redis 7.4 (`127.0.0.1:56379`, sem persistência).
- `test/support/global-setup.ts:5-12` — `execFileSync('pnpm', ['db:migrate'])` (achado 1).
- `test/support/integration-environment.ts:2-10` — exige `TEST_DATABASE_URL`/`TEST_REDIS_URL` e sufixo `_test`.
- `test/support/integration-fixture.ts:115-156` — `beforeAll` cria runtime; `beforeEach` trunca 12 tabelas com `CASCADE`, recria `SocialFormOption`/`ServiceType`/institutos, limpa Redis por prefixo e faz bootstrap do admin; `afterAll` fecha app/Redis.
- `test/support/access-service-fixture.ts:44-88` — doubles tipados (`satisfies`) só nas portas.
- `test/support/attendance-fixture.ts:44-51,79-87,96-113` — helpers com `expect` + parse de schema de contrato.
- `test/eslint-config.test.ts:6-128` — teste automatizado das restrições de camada do ESLint.
- `test/features/registration/infra/registration-integrity.integration.test.ts:7-35,36-89,90-132,133-182` — CPF concorrente, vigência/titularidade por constraint, rollback com constraint falhando, corrida de primeiro titular.
- `test/features/attendance/infra/attendance-integrity.integration.test.ts:15-78,79-141,142-197` — corrida encerramento×sessão, idempotência por autor/chave, trigger `fail_attendance_audit` + rollback.
- `test/features/audit/infra/audit-store.integration.test.ts:6-52,53-79,80-117` — autorização de leitura, rollback de escrita+chave, imutabilidade e snapshot sem segredos.
- `test/features/attendance/presentation/audit.integration.test.ts:35-64` — autorização de leitura da auditoria por classificação (403/404).
- `test/features/reports/presentation/reports-routes.integration.test.ts:111-163,448-493,495-544` — unidades de contagem, fingerprint de consulta, autorização de leitura, unificação contada uma vez.
- `test/features/eligibility/domain/evaluate-eligibility.test.ts:22-66,114-168,192-241,289-341` — aptidão pendente sem política, inscrição≠presença, cobertura incompleta≠não apta, família histórica.
- `test/features/attendance/domain/frequency-rules.test.ts:130-211` — oportunidades: inscrição, marcação explícita, canceladas e corte por família.
- `test/features/registration/domain/membership-rules.test.ts:5-41` — intervalos consecutivos, sobreposição, titular e futuro.
- `test/features/attendance/presentation/dependent-invariants.integration.test.ts:14-107` — bloqueio de encerramento/alteração retroativa que invalidaria marcações.
- `test/features/registration/presentation/membership-reconciliation.integration.test.ts:9-158` — único teste do serviço de reconciliação (HTTP).
- `test/features/social-forms/presentation/social-forms-routes.test.ts:24-58` — `Proxy` que lança em qualquer efeito de persistência não esperado.
- `test/features/demo-seed/infra/showcase-seed.integration.test.ts:6-13` — `beforeEach` duplicado (achado 7).
- `apps/web/test/shared/ui-layout.browser.test.tsx:20-23` — `describe.skipIf(!browserBinary)` (achado 8).
- `package.json:18-20,30-43` — scripts `test`/`test:integration` e ausência de provider de coverage.

## Transferable Patterns

- **Split unit/integração por sufixo com exclude complementar** → vale para qualquer feature nova: `x.test.ts` roda em `pnpm test` (rápido, sem infra) e `x.integration.test.ts` roda sob `pnpm test:integration` com migration real; o AGENTS exige exatamente essa divisão (`domain`/`application` por unidade, HTTP com `inject`, `infra` por integração).
- **Provar transação com trigger/constraint sintético em vez de mock** → aplicável a qualquer regra que dependa de rollback (ex.: futuras operações com auditoria): `CREATE FUNCTION fail_*` + `CREATE TRIGGER ... BEFORE INSERT ON "AuditEntry"` e `try/finally` removendo o objeto; é o único método que comprova atomicidade, conforme `AGENTS.md:127`.
- **Guardas de ambiente antes de destruir dados** → `integration-environment.ts:8-9` (sufixo `_test`) e prefixo de Redis por execução (`integration-fixture.ts:30`) podem ser replicados a qualquer nova infra de teste que trunque.
- **Doubles só nas portas, tipados** → `satisfies AccountsStore` em fixtures (`access-service-fixture.ts:44-88`) mantém o domínio intocado e ainda valida o contrato da porta; modelo para services futuros.
- **Proxy que falha em efeito inesperado** → `social-forms-routes.test.ts:24-44` transforma "a rota não deve persistir antes de validar" em asserção executável; reutilizável em qualquer transporte HTTP.
- **Relatórios com unidade de contagem + fingerprint + recuperação dos registros** → `reports-routes.integration.test.ts:111-163` atende direto ao invariante "totais informam período, filtros e unidade de contagem" (`AGENTS.md:114`); repetir em qualquer relatório novo.
- **Teste da própria restrição arquitetural** → `test/eslint-config.test.ts` faz do ESLint uma asserção da suíte; mantido vivo, dá ao `pnpm test` o poder de barrar importação proibida.

## Risks / Mismatches

- **"Basta adicionar `.cmd`" violaria o runtime do Node** → em Node ≥ 18.20/20.12, `execFileSync('pnpm.cmd', ...)` sem `shell` lança `EINVAL` (verificado neste ambiente); a correção do achado 1 precisa de `shell: true` ou de invocar o processo via `process.execPath`.
- **Remover `fileParallelism: false` para acelerar quebraria o isolamento** → todos os arquivos de integração compartilham o mesmo banco e o mesmo `TRUNCATE` por teste (`integration-fixture.ts:119-121`); paralelismo criaria corridas artificiais entre arquivos. O custo (suíte serial) é o preço do isolamento.
- **Cobertura por mock não substitui integração** → ainda que o achado 2 recomende medir cobertura, a métrica não pode ser usada para justificar cobrir `infra` com unit tests; as garantias de unicidade/vigência só existem no Postgres real.
- **Contagens fixadas ao fixture são intencionais mas frágeis** → trocar `total).toBe(3)` por algo mais solto enfraqueceria a prova de que cada passo grava auditoria; a recomendação é derivar a expectativa, não relaxá-la.
- **Não executar a suíte nesta exploração** → nada aqui afirma que os testes passam; as conclusões são sobre estrutura, cobertura declarada e qualidade das asserções lidas.

## Open Questions

- A suíte de integração já rodou com sucesso neste repositório? Se sim, em qual ambiente (WSL/Linux/contêiner), já que no Windows nativo o `globalSetup` falha (achado 1)?
- Existe decisão sobre thresholds de cobertura, ou a ausência de coverage (achado 2) é aceita até a estabilização do MVP?
- O comportamento do `MembershipReconciliationService` sem teste unitário (achado 3) é uma lacuna conhecida ou uma escolha por testar apenas via HTTP?
- Quem executa `pnpm test` / `pnpm test:integration` em merge? Não há CI (glob `.github/workflows/*` vazio; já tratado pela fatia 07), então a execução depende de disciplina manual.
- Seria desejável um teste tabular da matriz de auditoria (achado 4) ou a cobertura pontual atual é suficiente para o recorte do MVP?

## Evidence

- Inventário: `test/` tem 71 `*.test.ts` (35 unit + 36 integração) e 9 arquivos em `test/support/`; `src/` sem `generated/` tem 116 arquivos; 72 sem arquivo de teste no mesmo caminho; 25 arquivos de teste sem `src/` homônimo (cenários de fluxo, ex. `*-integrity`, `*-queries`, `dependent-invariants`).
- Contagens: 234 `it`/560 `expect` nos unitários; 121 `it`/808 `expect` nos de integração; total 355 `it`/1368 `expect`.
- Grep negativos (dívida ausente): `.only|.skip|.todo|.failing` → 0 em `test/**`; `toMatchSnapshot|toMatchInlineSnapshot` → 0 (as 33 ocorrências de "snapshot" são nomes de variáveis/DTOs, ex. `test/support/eligibility-fixture.ts:56`); `vi.mock(|mockDeep|vitest-mock-extended` → 0; `vi.spyOn` → 1 (`test/features/attendance/application/attendance-service.test.ts:37`); `eslint-disable|@ts-expect-error|as any` → 0.
- Grep positivos de invariantes: `Promise.all` em 13 pontos de integração (CPF, titular, sessão×encerramento, elegibilidade, merges, attendance, projects); triggers `fail_*` em `social-forms-integrity:71-94`, `attendance-integrity:164-189`, `missing-data-integrity:31-63`, `identity-merges:651-665`, `showcase-seed:297-313`, `eligibility-routes:499-513`; `403` presente em 18 arquivos de teste, com leitura negada explicitamente lida em `reports-routes:485-493`, `attendance/audit:53`, `audit-store:32-41`, `social-forms-routes.integration:101-131`, `eligibility-routes:454-470`, `responsible-candidates:87` e `identity-merges:836-837`.
- Reprodução do achado 1 em diretório temporário fora do repositório (nenhuma escrita no repositório): `ENOENT` para `pnpm`, `EINVAL` para `pnpm.cmd`, OK para `git`.
- Cobertura ausente: grep por `coverage` em `vitest.config.ts`/`vitest.integration.config.ts` → sem bloco; `package.json` sem `@vitest/coverage-*`.
- `git status --porcelain` → apenas `.audits/exploration/20261007-code-quality-review/` não rastreada; nenhum outro arquivo alterado por esta exploração.
