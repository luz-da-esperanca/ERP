# Analysis: 07-tooling-config

Read-only exploration of the slice `07-tooling-config` (ordinal `07`) for the research prompt:

> Problemas de build/ferramenta/configuração e inconsistências: scripts do package.json vs realidade (lint cobre src test apps packages?), consistência entre tsconfig raiz/base/apps/packages, cobertura e regras do ESLint, Prettier ignore drift, versionamento/pin de dependências vs "versões compatíveis fixadas", engines/.node-version vs CI, build.mjs/esbuild e o que ele empacota, ausência de CI/lint/test no pipeline, drift entre `.env.example` e `src/core/infra/config.ts`, workspace protocol e scripts dos pacotes filhos.

## Scope

- Slice question: auditar tooling/config/build do monorepo (scripts vs realidade, tsconfig, ESLint, Prettier, pin de versões, engines vs CI, esbuild, `.env.example` vs `config.ts`, workspace protocol e scripts dos pacotes filhos).
- Primary sources: `package.json`, `pnpm-workspace.yaml`, `tsconfig.json`, `tsconfig.base.json`, `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`, `build.mjs`, `vitest.config.ts`, `vitest.integration.config.ts`, `.node-version`, `.gitignore`, `.env.example`, `apps/web/package.json` + `apps/web/tsconfig.json` + `apps/web/vite.config.ts`, `packages/contracts/package.json` + `packages/contracts/tsconfig.json`, presença/ausência de CI (`.github/` etc.).
- Sources read in full vs. sampled: **Lidos por inteiro** — os Primary sources acima, mais `AGENTS.md`, `.agents/skills/agent-exploration/assets/analysis-template.md`, `test/eslint-config.test.ts`, `test/support/global-setup.ts`, `test/support/integration-environment.ts`, `src/core/infra/config.ts`, `compose.test.yaml`. **Amostrados** — `README.md` (linhas 20–74 e 180–243), `docs/specs/00-foundation.md` (12–41), `prisma/schema.prisma` (bloco generator), `src/generated/prisma/client.ts` (início + greps), `docs/api/*.md` (busca por `TEST_*`), `node_modules/eslint/lib/rules/no-restricted-imports.js` e `node_modules/@prisma/client` (verificação pontual de opções de regra e runtime), `compose.yaml` (grep de imagem/build).
- Total candidate sources surveyed: ~32 arquivos/diretórios (incluindo checagens de existência de `.github/`, `.gitlab-ci.yml`, `azure-pipelines.yml`, `Jenkinsfile`, `.gitattributes`, `.npmrc`, `dist/`, `src/generated/`).

## Overview

A fatia cobre a camada de ferramentas do monorepo: manifestos e scripts da raiz, configs de TypeScript/ESLint/Prettier/Vitest, empacotamento com esbuild, variáveis de ambiente e a ausência total de pipeline de CI.

Conclusão de alto nível: **a configuração de base é coerente e moderna** (pnpm workspaces com `workspace:*`, dependências fixadas em versão exata, lockfile presente, `packageManager` com hash, `minimumReleaseAge: 1440` e `allowBuilds` válidos para pnpm 12, tsconfig estrito estendido por todos os pacotes, ESLint flat config com restrições de camada **testadas automaticamente**, separação unitário/integração no Vitest). Os problemas concretos estão na **execução**: não existe CI que rode nenhum gate; o comando `pnpm format:check` documentado no README **falha com 409 arquivos** neste ambiente Windows (drift de fim de linha, não de formatação); e o artefato compilado (`pnpm build:api` + `pnpm start`) não é exercitado por nenhuma verificação.

Execuções read-only realizadas durante a exploração (nenhuma escrita além deste artefato):

- `pnpm lint` → exit 0 (`eslint src test apps packages --max-warnings 0`).
- `pnpm format:check` → exit 1, `Code style issues found in 409 files` (último passo da receita "Validar" do README).
- Comparação pontual `prettier src/main.ts` (stdout) vs. arquivo: idênticos ignorando EOL — única diferença é CRLF.
- `git ls-files --eol` (amostra: `i/lf w/crlf` em `src/main.ts`, `package.json`, `tsconfig.json`), `git config core.autocrlf` → `true`.
- `node -v` → `v24.18.0`; `pnpm -v` → `12.10.1` (batem com `engines`, `.node-version` e `packageManager`).
- `Test-Path` de `.github/`, `.gitlab-ci.yml`, `azure-pipelines.yml`, `Jenkinsfile`, `.gitattributes`, `.npmrc` → todos ausentes; `dist/` ausente; `src/generated/` presente.

## Achados

### 1. Ausência total de pipeline de CI — severidade: alto

- **Evidência:** raiz do repositório sem `.github/`, `.gitlab-ci.yml`, `azure-pipelines.yml`, `Jenkinsfile` (checagem de existência); sem hooks de git (`package.json:30-43` não tem husky/lint-staged e não há diretório `.husky`); gates existem apenas como scripts manuais (`package.json:14-28`).
- **Problema:** `typecheck`, `lint`, `test`, `build` e `format:check` dependem exclusivamente de execução manual por quem faz a tarefa.
- **Impacto no MVP:** o AGENTS (linha 129) exige executar os scripts oficiais por tarefa, mas nada garante isso em merge. Regressões de contrato, autorização ou auditoria podem entrar sem nenhum gate; além disso, a falha real do `format:check` (achado 2) persiste silenciosamente porque ninguém o roda continuamente. O único artefato que automatiza uma verificação arquitetural (`test/eslint-config.test.ts`) só roda quando alguém executa `pnpm test`.
- **Recomendação:** criar CI mínimo (ex.: GitHub Actions) com Node `24.18.0` via `.node-version`: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` e `pnpm format:check` (após corrigir o achado 2).

### 2. `pnpm format:check` falha em 409 arquivos por drift de fim de linha (CRLF vs LF) — severidade: alto

- **Evidência:** `.prettierrc.json:1` (só `singleQuote` e `trailingComma`, sem `endOfLine` → default `lf`); execução de `pnpm format:check` → exit 1 com `Code style issues found in 409 files`; `package.json:26` define o script; `README.md:215` o lista como etapa de validação; ausência de `.gitattributes` na raiz; `git config core.autocrlf` → `true`; `git ls-files --eol` → `i/lf w/crlf` para `src/main.ts`, `package.json`, `tsconfig.json`. Verificação pontual (direta): o stdout de `prettier src/main.ts` é idêntico ao conteúdo do arquivo quando se remove `\r` — ou seja, não há divergência de estilo, apenas de EOL.
- **Problema:** o Git normaliza para LF no índice, o checkout no Windows produz CRLF (autocrlf) e o Prettier compara contra LF. **Inferência:** a causa é a mesma para os demais 408 arquivos (409 ≈ todos os arquivos alcançados pelos globs; amostra de 40 `.ts` de `src/` com 40/40 CRLF).
- **Impacto no MVP:** a receita "Validar" do `README.md:210-216` termina com falha neste ambiente de desenvolvimento; na prática o gate vira ruído e é ignorado. Rodar `pnpm format` reescreveria ~409 arquivos (no histórico do Git o diff não aparece por causa do autocrlf, mas o working tree muda de EOL).
- **Recomendação:** fixar explicitamente `"endOfLine": "lf"` no `.prettierrc.json` **e** adicionar `.gitattributes` (`* text=auto eol=lf`) para que o checkout reproduza o EOL esperado (alternativa: `endOfLine: "auto"` se o time aceitar ambos); depois executar `pnpm format` uma única vez e confirmar diff vazio.

### 3. `tsconfig.json` da raiz não cobre `vitest.config.ts` nem `vitest.integration.config.ts` — severidade: médio

- **Evidência:** `tsconfig.json:7` → `"include": ["src", "test", "prisma.config.ts"]`; `vitest.config.ts` e `vitest.integration.config.ts` fora do include; contraste: `apps/web/tsconfig.json:6` **inclui** `vite.config.ts`.
- **Problema:** as duas configs de teste em TypeScript na raiz ficam fora da checagem de tipos (`pnpm typecheck:api` = `tsc -p tsconfig.json`, `package.json:28`).
- **Impacto no MVP:** erro de digitação/tipo nessas configs só aparece na hora de rodar os testes (quebra silenciosa da suíte unitária ou de integração), não na verificação de tipos que o README lista como gate.
- **Recomendação:** adicionar `vitest.config.ts` e `vitest.integration.config.ts` ao `include` da raiz (mesmo padrão já adotado pelo web).

### 4. O lint não alcança os arquivos de configuração da raiz (`build.mjs`, `eslint.config.mjs`, `prisma.config.ts`, `vitest*.ts`) — severidade: médio

- **Evidência:** `package.json:17` → `eslint src test apps packages --max-warnings 0` (somente diretórios); a própria config do ESLint (`eslint.config.mjs`) e o script de build (`build.mjs`) ficam fora. Assimetria: o Prettier **cobre** esses arquivos (`package.json:25-26` com `*.json *.mjs *.ts` — confirmado na saída do `format:check`, que listou `build.mjs`, `eslint.config.mjs`, `prisma.config.ts`, `vitest.config.ts`, `vitest.integration.config.ts`).
- **Problema:** o lint roda apenas sobre `src`, `test`, `apps` e `packages`; as regras `files: ['**/*.{ts,tsx}']` (`eslint.config.mjs:8-13`) existem, mas o script nunca aponta para os arquivos da raiz.
- **Impacto no MVP:** `build.mjs` — o artefato que produz o binário de produção — e a configuração do próprio lint ficam sem nenhuma checagem automática de qualidade/segurança de importação.
- **Recomendação:** trocar para `eslint .` (com `ignores` já existentes em `eslint.config.mjs:5`) ou listar explicitamente os arquivos/arquivos-raiz; manter `--max-warnings 0`.

### 5. Restrição de camada de `infra` não bloqueia frameworks HTTP (regra contradiz a própria mensagem) — severidade: médio

- **Evidência:** `eslint.config.mjs:172-188` — o bloco de `src/**/infra/**/*.ts` só restringe `**/presentation/**` (linha 180) com a mensagem "Infrastructure implements application ports without HTTP dependencies" (linhas 181-183), mas **não** lista `fastify`/`@fastify/*`; em contraste, `domain` bloqueia `fastify`, `@fastify/*`, `node:*` etc. (`eslint.config.mjs:64-77`) e `application` idem (`eslint.config.mjs:125-137`). Evidência direta de conformidade **atual**: grep em `src/` mostra os 14 imports de `fastify`/`@fastify/*` todos em `presentation` e `src/app.ts` (ex.: `src/features/access/presentation/access-routes.ts:1`, `src/app.ts:11-12`) — nenhum em `infra` hoje.
- **Problema:** a regra de infra não impede que um adaptador passe a importar Fastify, contradizendo a intenção registrada na própria mensagem da regra e a separação descrita no AGENTS (presentation = interface HTTP; infra = implementações concretas sem HTTP).
- **Impacto no MVP:** é uma rota de regressão silenciosa para a arquitetura do monólito modular; como não há CI (achado 1), só seria pego se alguém rodasse `pnpm test` — e o teste `test/eslint-config.test.ts` **não** cobre o caso infra→fastify (cobre infra→presentation, linhas 96-101).
- **Recomendação:** adicionar `fastify` e `@fastify/*` aos `patterns` do bloco de infra (não adicionar `node:*`, pois infra legitimamente usa filesystem/processo) e registrar o caso em `test/eslint-config.test.ts`.

### 6. O artefato compilado (`pnpm build:api` → `dist/`) não é exercitado por nenhuma verificação — severidade: médio

- **Evidência (direta):** `build.mjs:2-18` — entry points `src/main.ts` e `src/bootstrap.ts`, `bundle: true`, `format: 'esm'`, `target: 'node24'`, `external: ['fastify', '@fastify/cookie', '@prisma/*', 'bcrypt', 'redis', 'jose']`; `zod` e `@erp/contracts` **não** são externos (empacotados); o cliente Prisma gerado em `src/generated/prisma` (saída definida em `prisma/schema.prisma:1-3`) é importado por caminho relativo (`src/core/infra/database.ts:2`) e portanto **também é empacotado**, enquanto o runtime fica externo via padrão `@prisma/*` — incluindo o `await import("@prisma/client/runtime/query_compiler_fast_bg.postgresql.wasm-base64.mjs")` em `src/generated/prisma/internal/class.ts:51`. `dist/` **não existe** no working tree; nenhum teste roda `dist/main.js` (`vitest.config.ts:4-9` roda fonte; `vitest.integration.config.ts:4` idem); `README.md:230-235` instrui `pnpm build:api && pnpm start` e `README.md:38` registra apenas que o build "passou" (exit 0) em 06/10/2026.
- **Problema:** nenhuma verificação automatizada valida que o bundle gerado sobe e conversa com Prisma/PostgreSQL/Redis.
- **Impacto no MVP:** a receita de execução do artefato compilado pode falhar em runtime sem que qualquer gate detecte.
- **Inferências (não verificadas — build não pôde ser executado por serem leituras apenas):** (a) `src/generated/prisma/client.ts:16` faz `globalThis['__dirname'] = path.dirname(fileURLToPath(import.meta.url))`, que após o bundle passaria a apontar para `dist/` em vez de `src/generated/prisma` (efeito colateral hoje não é lido em lugar nenhum do código gerado, grep único); (b) o `import.meta.url`/`fileURLToPath` do runtime gerado sofre a mesma relocação no bundle.
- **Recomendação:** adicionar smoke test do artefato em CI (ex.: `node --check dist/main.js` + boot mínimo com banco de teste) e documentar explicitamente o que é *bundled* vs *external* (contratos e cliente Prisma gerado entram no bundle; `zod` também).

### 7. `engines`/`.node-version` consistentes entre si e com o runtime, mas sem qualquer enforcement — severidade: baixo

- **Evidência:** `package.json:7-9` → `"node": ">=24.18.0 <25"`; `.node-version:1` → `24.18.0`; `package.json:6` → `packageManager: pnpm@12.10.1+sha512...`; `pnpm-workspace.yaml:1-11` sem `nodeVersion`/`engineStrict`; ausência de `.npmrc` (onde ficaria `engine-strict=true`); sem CI (achado 1). Runtime real verificado: `node -v` = `v24.18.0`, `pnpm -v` = `12.10.1`; `pnpm-lock.yaml` com `lockfileVersion: '9.0'` e `packageManagerDependencies.pnpm: 12.10.1`.
- **Problema:** sem `engineStrict`/CI, um Node 25+ ou pnpm divergente só gera aviso (ou nada) em vez de falhar.
- **Impacto no MVP:** contribuidor com runtime diferente pode "passar" nos gates locais e produzir comportamento distinto do alvo (`build.mjs` assume `node24`).
- **Recomendação:** ativar `engineStrict: true` (e opcionalmente `nodeVersion: 24.18.0`) no `pnpm-workspace.yaml` e fixar a versão no CI.

### 8. `.env.example` alinhado campo a campo com `config.ts`, mas com nuances de operação — severidade: baixo

- **Evidência:** comparação direta `src/core/infra/config.ts:6-62` vs `.env.example:1-29` — **25/25 chaves presentes** (sem drift de chaves). Nuances: (a) `config.ts:44,47-48,91-104` exige segredos não vazios (`JWT_SECRET_BASE64`, `OPERATION_HMAC_*`), mas `.env.example:11-17` só traz instrução de geração para o JWT; `OPERATION_HMAC_KEYS_JSON={"v1":""}` (linha 17) é placeholder vazio que derruba o boot com o erro genérico "Invalid operation HMAC key configuration" (`config.ts:101`); (b) `.env.example:23` fixa `COOKIE_SECURE=false` enquanto o default do schema é `true` (`config.ts:53`) — aceitável para dev local (restrito a localhost em `config.ts:84-88`), mas divergente do default seguro sem comentário; (c) `TEST_DATABASE_URL`/`TEST_REDIS_URL`, exigidos pelos testes de integração (`test/support/integration-environment.ts:2-7`), não constam do `.env.example` — estão documentados em `README.md:220-226` e `docs/api/*.md`.
- **Problema:** cópia literal do `.env.example` não sobe a API e o caminho de geração dos secrets não está completo no próprio arquivo.
- **Impacto no MVP:** onboarding lento e erros de configuração opacos; a config carrega regras de segurança relevantes para o MVP (independência de chaves, HTTPS em produção — `config.ts:79-110`).
- **Recomendação:** incluir o comando de geração para todos os secrets (ou um script `secrets:generate`), comentar o `COOKIE_SECURE` do exemplo e listar as variáveis `TEST_*` como comentário no `.env.example`.

### 9. Scripts dos pacotes filhos não expõem `test`/`lint` e o README não menciona a suíte de web/contracts na receita "Validar" — severidade: baixo

- **Evidência:** `apps/web/package.json:6-11` → apenas `dev`, `build`, `preview`, `typecheck`; `packages/contracts/package.json:9-11` → apenas `typecheck`; a raiz é quem cobre tudo: `package.json:16-18` (`typecheck` inclui `pnpm -r typecheck`; `lint` cobre `apps packages`) e `vitest.config.ts:4-8` inclui `apps/*/test/**` e `packages/*/test/**`. `README.md:44` afirma que "Ambos os pacotes entram na verificação de tipos e lint" (correto), mas `README.md:218` descreve os testes como "Ficam em `test/` e espelham os módulos de `src/`", sem citar `apps/web/test/**` (~45 arquivos) nem `packages/contracts/test/**` (11 arquivos).
- **Problema:** `pnpm --filter @erp/web test` (ou `--filter @erp/contracts test`) falharia por falta de script; a documentação da suíte subestima a cobertura real de `pnpm test`.
- **Impacto no MVP:** risco de alguém concluir que testes de UI/contratos "não existem" e pular a validação de contratos compartilhados.
- **Recomendação:** adicionar scripts delegativos (`test`/`lint`) nos pacotes filhos ou documentar na seção "Validar" que `pnpm test` roda `test/`, `apps/web/test/` e `packages/contracts/test/`.

### 10. Cobertura do Prettier assimétrica: markdown e YAML da raiz/`docs/` ficam de fora — severidade: baixo

- **Evidência:** `package.json:25-26` → `prettier --write/--check src test apps packages *.json *.mjs *.ts pnpm-workspace.yaml`; a saída real confirmou que glob alcança dotfiles e markdown **dentro** de diretórios listados (ex.: `.prettierrc.json`, `apps/web/DESIGN.md`, `apps/web/index.html` apareceram no `format:check`), mas `README.md`, `AGENTS.md`, `docs/**` (dezenas de `.md`) e `compose.yaml`/`compose.test.yaml` ficam fora; `.prettierignore:1-4` (`node_modules`, `dist`, `pnpm-lock.yaml`, `**/generated/**`) está correto para o que os globs alcançam — não há *ignore* errado, há **globs incompletos**.
- **Problema:** markdown/YAML críticos (documentação canônica do MVP) nunca passam por `format:check`.
- **Impacto no MVP:** apenas consistência editorial; nenhum efeito em runtime. Nota: o AGENTS determina que alterações documentais exijam revisão de conteúdo/links — formatação não é requisito.
- **Recomendação:** incluir `*.md`, `docs`, `compose*.yaml` nos globs ou registrar explicitamente a exclusão intencional.

### 11. `apps/web` espelha as camadas (`domain/application/presentation/infra`) mas não tem restrições de camada no ESLint — severidade: baixo

- **Evidência:** `eslint.config.mjs:189-213` aplica ao web/contracts apenas o bloqueio de internals do backend/persistência (`@prisma/*`, `**/src/features/**` do backend etc.); não há análogo dos blocos `src/**/domain|application|presentation|infra` para `apps/web/**`. Código atual **depende** do par presentation→infra: 41 referências em `apps/web/src/features/**/presentation/*.tsx`, majoritariamente `import type { HttpX } from '../infra/http-...'` (ex.: `apps/web/src/features/audit/presentation/audit-page.tsx:5`, `apps/web/src/features/reports/presentation/reports-page.tsx:2-6`).
- **Problema:** nada impede um componente React de importar implementação de infraestrutura como **valor** (ex.: `new HttpAttendance(...)`) diretamente na apresentação; a regra atual só impede persistência/backend.
- **Impacto no MVP:** risco de acoplamento da UI à implementação HTTP/demo (a fronteira "gateway" fica sem enforcement). Observação: o AGENTS descreve a tabela de camadas como regra **"No backend"** (`AGENTS.md:65`), então a ausência é plausível como decisão — mas o código do web já organiza as camadas, tornando a regra desejável.
- **Recomendação:** se desejado, adicionar bloco para `apps/web/src/features/**` com `no-restricted-imports` usando `allowTypeImports: true` para `**/infra/**` (o código atual só faz type imports), evitando refatoração.

### 12. Spec de fundação desatualizada sobre a disponibilidade dos scripts — severidade: baixo

- **Evidência:** `docs/specs/00-foundation.md:23` → "Os comandos desta seção descrevem entregáveis a criar, não comandos disponíveis hoje: `dev`, `build`, `typecheck`, `lint`, `test`, `test:integration`, `db:migrate` e `db:seed`"; todos já existem em `package.json:10-28` e são citados como executáveis no `README.md:44,210-235`.
- **Problema:** redação de spec presa ao estado pré-implementação, conflitando com a implementação existente (na hierarquia do AGENTS, código/README vigente descrevem a realidade).
- **Impacto no MVP:** confusão de onboarding (quem lê a spec pode achar que os scripts ainda não existem); sem efeito técnico.
- **Recomendação:** atualizar a frase para indicar que os comandos já estão disponíveis e apontar ao README.

## Relevant Sources

Fontes por achado (caminhos e linhas verificados):

- **Achado 1 (sem CI):** raiz do repositório — ausência confirmada de `.github/`, `.gitlab-ci.yml`, `azure-pipelines.yml`, `Jenkinsfile` (Test-Path = false); `package.json:14-28` (scripts manuais); `package.json:30-43` (devDependencies sem husky/lint-staged); `README.md:208-235` (receita manual "Validar"); `test/eslint-config.test.ts:1-129` (única automação arquitetural, depende de `pnpm test`).
- **Achado 2 (EOL/Prettier):** `.prettierrc.json:1`; `package.json:25-26`; `README.md:210-216`; ausência de `.gitattributes` (listagem da raiz); configuração local `git config core.autocrlf=true`; `git ls-files --eol` → `i/lf w/crlf` em `src/main.ts`, `package.json`, `tsconfig.json`; comparação `prettier src/main.ts` vs. arquivo (idênticos ignorando `\r`); saída de `pnpm format:check` (409 arquivos, exit 1).
- **Achado 3 (tsconfig vs configs do Vitest):** `tsconfig.json:7`; `tsconfig.base.json:1-18`; `apps/web/tsconfig.json:6` (inclui `vite.config.ts`); `package.json:16,28`.
- **Achado 4 (lint não cobre configs da raiz):** `package.json:17`; `eslint.config.mjs:5,8-13`; `build.mjs:1-18`; saída do `format:check` listando `build.mjs`, `eslint.config.mjs`, `vitest.config.ts`, `vitest.integration.config.ts`, `prisma.config.ts`.
- **Achado 5 (infra x fastify):** `eslint.config.mjs:172-188` (bloco infra), `eslint.config.mjs:64-77` (domain), `eslint.config.mjs:125-137` (application), `eslint.config.mjs:148-171` (presentation); grep de `from 'fastify'` em `src/` (14 matches, todos em `presentation`/`src/app.ts`); `test/eslint-config.test.ts:96-101` (teste cobre infra→presentation, não infra→fastify).
- **Achado 6 (artefato esbuild):** `build.mjs:2-18`; `prisma/schema.prisma:1-3`; `src/core/infra/database.ts:1-2`; `src/generated/prisma/client.ts:13-16`; `src/generated/prisma/internal/class.ts:51`; `vitest.config.ts:4-9`; `vitest.integration.config.ts:4-11`; `package.json:14-15,27`; `README.md:38,230-235`; ausência de `dist/` (Test-Path = false).
- **Achado 7 (engines vs enforcement):** `package.json:6-9`; `.node-version:1`; `pnpm-workspace.yaml:1-11`; ausência de `.npmrc`; `pnpm-lock.yaml:1-10` (`lockfileVersion: '9.0'`, `packageManagerDependencies.pnpm: 12.10.1`); `node -v`/`pnpm -v` executados.
- **Achado 8 (`.env.example` x `config.ts`):** `.env.example:1-29`; `src/core/infra/config.ts:6-62` (schema), `:44,47-48,51-55` (segredos/defaults), `:79-140` (validações cruzadas), `:91-104` (erros de secret); `test/support/integration-environment.ts:1-11`; `README.md:220-226`; `docs/api/social-forms.md:149-152` (mesmo padrão em docs).
- **Achado 9 (scripts dos pacotes filhos):** `apps/web/package.json:6-11`; `packages/contracts/package.json:9-11`; `vitest.config.ts:4-8`; `package.json:16-18`; `README.md:44,218`.
- **Achado 10 (cobertura do Prettier):** `package.json:25-26`; `.prettierignore:1-4`; saída do `format:check` (`apps/web/DESIGN.md`, `.prettierrc.json` incluídos; `docs/**`, `README.md`, `AGENTS.md`, `compose*.yaml` ausentes).
- **Achado 11 (camadas no web):** `eslint.config.mjs:189-213`; `AGENTS.md:63-80` (tabela de camadas "No backend"); grep `from '.*infra/` em `apps/web/src/features/**/presentation` (41 matches, ex.: `apps/web/src/features/audit/presentation/audit-page.tsx:5`, `apps/web/src/features/reports/presentation/reports-page.tsx:2-6`).
- **Achado 12 (spec desatualizada):** `docs/specs/00-foundation.md:23`; `package.json:10-28`; `README.md:44,210-235`.

## Transferable Patterns

- **Teste automatizado da configuração de lint** (`test/eslint-config.test.ts`) → aplicável a qualquer regra arquitetural nova: em vez de confiar que a restrição "pega", fixar comportamento esperado (positivo e negativo) via `ESLint.lintText`. Já cobre backend, web e contracts; estender aos casos dos achados 5 e 11.
- **Pin exato + supply chain do pnpm** (versões sem `^`/`~` em todos os manifestos, `packageManager` com hash, `minimumReleaseAge: 1440`, `allowBuilds` explícito, lockfile versionado) → padrão alinhado ao AGENTS ("versões compatíveis fixadas") e pronto para ser replicado em novos pacotes do workspace.
- **tsconfig base único estendido por todos os pacotes** (`strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `moduleResolution: Bundler`, sem `paths`/aliases divergentes) → manter como única fonte de opções; novos pacotes só declaram `include` e sobrescritas pontuais (`lib`/`types`).
- **Separação unitário/integração no Vitest** (`vitest.config.ts` exclui `*.integration.test.ts`; config dedicada com `globalSetup` que roda `pnpm db:migrate` contra banco `_test`) + docblocks `// @vitest-environment jsdom` por arquivo → permite ambiente `node` padrão com DOM onde necessário, sem config extra por pacote.

## Risks / Mismatches

- **Aplicar as restrições de camada do backend ao `apps/web` quebraria ~41 imports existentes** (presentation → `../infra/http-*`), a menos que se use `allowTypeImports: true` ou se movam as portas para `application` — recomendação do achado 11 já contempla isso, mas exige decisão de design, não só de config.
- **Bloquear `node:*` em `infra`** (cópia cega do bloco de domain/application) impediria filesystem/processo, que o próprio AGENTS lista como responsabilidade de infra (`AGENTS.md:72`) — por isso a recomendação do achado 5 restringe apenas `fastify`/`@fastify/*`.
- **Rodar `pnpm format` para "consertar" o achado 2** reescreve ~409 arquivos de uma vez; com `core.autocrlf=true` o diff Git tende a ficar vazio (o que confirma que é mudança só de working tree), mas ainda exige revisão/calibração do time antes de virar gate de CI.
- **`endOfLine: "auto"`** evitaria o choque imediato, mas abandona a normalização LF no repositório — conflita com a ausência de `.gitattributes` e mantém o drift latente entre máquinas.
- **Números de testes citados no README** (`README.md:36-38`: 401 unitários + 114 de integração em 06/10/2026) são registros históricos; esta fatia não reexecutou as suítes e não os confirma.

## Open Questions

- Estado atual de `pnpm typecheck`, `pnpm test` e `pnpm build`: **não executados** nesta exploração (typecheck/build escreveriam `src/generated/` e `dist/`; a tarefa é somente leitura). Sustenta-se apenas o registro do `README.md:38` (06/10/2026).
- Comportamento real do `dist/main.js` (bundle com cliente Prisma gerado, wasm do query compiler externo via `@prisma/*`, `globalThis.__dirname` relocado) permanece não verificado — `dist/` não existe e o build não pôde ser rodado (achado 6, inferências a/b).
- Não foi verificado se `allowBuilds` cobre **todas** as dependências com scripts de build (a instalação existente em `node_modules` sugere que sim, mas uma instalação limpa com `strictDepBuilds` — default `true` em pnpm 11+ — não foi testada).
- Não foi validada a resolução do ambiente `jsdom`/`vitest` em instalação limpa (os pacotes ficam em `apps/web`; a execução depende do hoisting do pnpm) — inferência.
- Quem decide a adoção de CI (GitHub Actions vs outra ferramenta) e se `format:check` deve entrar como gate imediato são decisões fora desta fatia.

## Evidence

- Execuções read-only: `pnpm lint` (exit 0); `pnpm format:check` (exit 1, 409 arquivos); `prettier src/main.ts` (comparação de conteúdo, diferença somente EOL); `git ls-files --eol`; `git config core.autocrlf`; `git log --oneline -5`; `node -v` = `v24.18.0`; `pnpm -v` = `12.10.1`; `git status --porcelain` (apenas o diretório de auditoria novo, nenhum código alterado).
- Checagens de existência: `.github/`, `.gitlab-ci.yml`, `azure-pipelines.yml`, `Jenkinsfile`, `.gitattributes`, `.npmrc`, `dist/` → ausentes; `pnpm-lock.yaml`, `src/generated/prisma`, `.audits/exploration/20261007-code-quality-review/analysis/` → presentes.
- Greps: `from 'fastify'` em `src/` (14); `from '.*infra/` em presentation do web (41); `process.env.[A-Z_]+` (3 ocorrências: `test/support/integration-environment.ts:2-3`, `prisma.config.ts:7`); `@vitest-environment` (31 arquivos de teste do web); `TEST_DATABASE_URL|TEST_REDIS_URL` (README, docs/api, docs/showcase-seed.md, test/support); DOM em `packages/contracts/src` (nenhuma ocorrência — sem achado decorrente; nota: os contratos herdam `lib` com `DOM` do `tsconfig.base.json:4`, enquanto a API restringe a `ES2022` em `tsconfig.json:4`).
- Verificação externa (documentação do pnpm, 2026): `https://pnpm.io/settings/build` (`allowBuilds`, adicionado em v10.26.0, default de `strictDepBuilds`), `https://pnpm.io/settings/dependency-resolution` (`minimumReleaseAge` em minutos, adicionado em v10.16.0) — confirmam que `pnpm-workspace.yaml:5-11` é configuração válida para o pnpm 12 pinado.
- Verificação de que o ESLint core suporta `allowTypeImports` (usado em `eslint.config.mjs:80,140`): `node_modules/eslint/lib/rules/no-restricted-imports.js:44,113`.
