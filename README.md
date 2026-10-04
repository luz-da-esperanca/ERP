# ERP Social Luz da Esperança

Monorepo TypeScript do MVP. O recorte e suas decisões estão no [índice das specs](docs/specs/README.md).

## Estado da implementação

Esta primeira etapa do backend entrega **CORE, ACS e auditoria de contas**:

- Fastify com contratos Zod, paginação, erros padronizados e validação da configuração.
- PostgreSQL/Prisma com migration reproduzível, revisões, autoria e auditoria imutável.
- Login/logout, troca obrigatória de senha, contas, catálogo de perfis, ativação e reset administrativo.
- JWT em cookie HttpOnly, sessão revogável no Redis, expiração e limites de tentativas.
- Autorização com perfis atuais e nova verificação do autor dentro da transação de escrita.
- Idempotência com referências de revisão; criação/reset com comparação HMAC e chaves independentes das de autenticação.
- Consulta de auditoria de contas com autorização e snapshots sem credenciais.

**Ainda não há endpoints de CAD, FIC, ATV, FRQ, APT ou REL.** A auditoria desses módulos será entregue com suas operações. A administração de decisões institucionais também está pendente; o mecanismo de inicialização já recusa `DATA_MODE=REAL` sem decisão registrada. Isso não aprova o uso institucional nem reconhece automaticamente se o dado inserido é sintético.

`apps/web` contém a reorganização do protótipo, com adaptadores em memória, e ainda precisa concluir suas telas e integração HTTP. O backend não usa esses adaptadores. Contas da demonstração não são contas PostgreSQL.

Os comandos padrão `pnpm dev` e `pnpm build` operam a API nesta etapa. A aplicação web permanece em preparação; sua configuração e seus módulos entram na verificação de tipos e lint.

## Organização

```text
apps/api/src/
  main.ts                   # entrada do servidor
  app.ts                    # composição HTTP e proteções comuns
  core/                     # configuração, erros e transações
  features/access/
    domain/                 # capacidades e invariantes de contas
    application/            # autenticação e contratos das fronteiras
    infra/                  # rotas, Prisma, Redis, jose e bcrypt
  features/audit/infra/      # auditoria transacional e consulta de contas
apps/api/prisma/             # schema e migrations
apps/api/test/               # espelha src/: core, features/access, features/audit
  support/                  # fixtures e preparação da integração
apps/web/                    # protótipo React
packages/contracts/          # contratos públicos; sem Prisma ou segredos
  test/                     # testes espelhando src/ do pacote
docs/specs/                  # especificações vigentes do MVP
```

O backend é um monólito modular. As transações de contas compartilham um bloqueio PostgreSQL para bootstrap e proteção do último administrador. As linhas de autor/alvo são bloqueadas em ordem de ID. O isolamento é serializable, com até três tentativas somente para serialização/deadlock. Comparação e hash bcrypt acontecem fora da transação. Auditoria e conclusão da operação confirmam junto com a alteração; replay e no-op não geram nova revisão/evento.

## Executar a API local

Pré-requisitos: Node.js da [.node-version](.node-version), pnpm da propriedade `packageManager`, PostgreSQL e Redis. Os arquivos Compose servem ao desenvolvimento local; requerem Docker com plugin Compose e acesso ao daemon.

```bash
pnpm install
docker compose up -d --wait
cp apps/api/.env.example apps/api/.env
```

Preencha `JWT_SECRET_BASE64` e a chave `v1` de `OPERATION_HMAC_KEYS_JSON` em `apps/api/.env` com **dois valores diferentes**, gerados separadamente:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Mantenha `DATA_MODE=SYNTHETIC`. Em seguida:

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:bootstrap
pnpm dev:api
```

O bootstrap local pede login, nome e senha com entrada oculta; funciona apenas se não existir nenhuma conta. Cria um administrador que precisa trocar a senha no primeiro acesso. Não há usuário/senha padrão nem seed de pessoas ou aprovações. O catálogo fixo de perfis é criado nessa mesma transação.

Disponibilidade: `GET http://127.0.0.1:3001/api/v1/health`. Essa rota verifica o processo HTTP; não é diagnóstico completo das dependências.

### Configuração operacional

- `APP_ORIGIN`: origem exata da SPA, sem caminho ou barra final. Produção usa HTTPS e `COOKIE_SECURE=true`, com cookie `__Host-erp_session`. HTTP com cookie inseguro só é permitido em origem local explícita.
- Login e escritas exigem `Content-Type: application/json`, `Origin` igual a `APP_ORIGIN` e `X-ERP-Request: 1`. Se enviado, `Sec-Fetch-Site` precisa ser `same-origin`. A produção deve servir SPA e `/api` na mesma origem.
- `TRUST_PROXY_ADDRESSES`: IPs exatos de proxies confiáveis, separados por vírgula; vazio por padrão. Configure somente os proxies de entrada da implantação para que o limite por IP use a origem correta. Cabeçalhos encaminhados não são confiados indiscriminadamente.
- `SESSION_IDLE_SECONDS=1800`, `SESSION_MAX_SECONDS=28800`; sem refresh token. Redis indisponível retorna 503 nos caminhos que precisam de sessão/revogação.
- `BCRYPT_COST=12`, mínimo 10. Meça o custo no ambiente do piloto. Senhas usam no mínimo 12 caracteres Unicode, no máximo 72 bytes UTF-8, sem NUL; espaços são preservados.
- Criação, troca/reset e desativação preservam autoria. Senha/reset/desativação mudam `authVersion` em PostgreSQL. Sessões antigas são negadas mesmo enquanto suas chaves Redis existem; elas expiram por TTL. Não há dependência de limpeza posterior para revogar.
- Ao rotacionar HMAC, mantenha em `OPERATION_HMAC_KEYS_JSON` as chaves antigas referenciadas por operações existentes e altere apenas o ID corrente. Uma chave ausente impede comparar o replay; nunca reutilize a chave JWT.
- Logs de requisição contêm ID técnico, método e status; corpos, cookies, tokens, hashes e snapshots não são registrados.

## Contratos HTTP entregues

| Método    | Caminho sob `/api/v1`                   | Acesso                                                |
| --------- | --------------------------------------- | ----------------------------------------------------- |
| GET       | `/health`                               | Público, sem manter sessão viva                       |
| POST      | `/auth/login`                           | Login e senha                                         |
| GET       | `/auth/session`                         | Sessão válida; perfis/capacidades atuais              |
| POST      | `/auth/logout`                          | Limpa sessão/cookie; ausência aceita                  |
| PUT       | `/auth/password`                        | Própria conta, revisão e senha atual                  |
| GET, POST | `/users`                                | `accounts.manage`                                     |
| PATCH     | `/users/:userId`                        | `accounts.manage`, revisão                            |
| POST      | `/users/:userId/activation`             | `accounts.manage`, revisão e motivo                   |
| PUT       | `/users/:userId/password`               | `accounts.manage`, revisão e motivo                   |
| GET       | `/roles`                                | `accounts.manage`                                     |
| GET       | `/audit-entries?entityType=UserAccount` | `audit.read` e `accounts.manage`                      |
| GET       | `/audit-entries/:entryId`               | Mesma autorização; detalhe fora do acesso retorna 404 |

As escritas de contas usam `Idempotency-Key` UUID; login, logout e troca da própria senha são exceções. Uma repetição com a mesma chave/autor/conteúdo retorna a revisão original. Outra senha, alvo ou autor produz 409. As entradas e DTOs estão em [access-api.ts](packages/contracts/src/access-api.ts); os contratos de cada rota seguem [SPEC-ACS](docs/specs/01-access.md). Auditoria aceita período `from/to` com fim exclusivo e paginação de 1 a 100 itens, padrão 20.

## Validar

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build:api
```

Os testes unitários são separados dos de integração. **A integração requer banco exclusivo cujo nome termine em `_test` e apaga seus registros.** O Redis recebe prefixo único por execução; o teste não usa `FLUSHDB`.

```bash
docker compose -f compose.test.yaml up -d --wait
TEST_DATABASE_URL=postgresql://erp:erp_test_only@localhost:55432/erp_test \
TEST_REDIS_URL=redis://localhost:56379 \
pnpm test:integration
docker compose -f compose.test.yaml down
```

Vitest/Fastify `inject` verifica contratos, cookies, matriz de acesso, origem, bloqueio de login, expiração, revogação, HMAC/replay, concorrência de revisões e administradores, rollback por falha de auditoria, imutabilidade e indisponibilidade de dependências. A suíte aplica a migration real antes dos testes. Não use essas URLs com dados de operação.

Para executar o artefato compilado:

```bash
pnpm build:api
pnpm --filter @erp/api start
```

## Próximas etapas do MVP

1. CAD: pessoas/famílias, vigências, titularidade, busca de duplicidades e unificação autorizada.
2. FIC e decisões: aprovação de campos, versões e composição histórica; habilitações auditadas.
3. ATV/FRQ: projetos, atividades, inscrições, encontros, chamada, correções e cancelamentos.
4. APT: políticas versionadas e evidências; sem política, estado Pendente.
5. REL: consultas e detalhamento de totais somente sobre os módulos acima.
6. Integração da interface com esses contratos, incluindo autenticação real e troca obrigatória de senha.

Não foram introduzidos atendimentos, estoque, entregas, Bazar ou migração. A referência normativa continua no [AGENTS.md](AGENTS.md) e nas specs. Referências técnicas da base: [Prisma 7 e adapter PostgreSQL](https://docs.prisma.io/docs/guides/upgrade-prisma-orm/v7), [Fastify: erros](https://fastify.dev/docs/latest/Reference/Errors/).
