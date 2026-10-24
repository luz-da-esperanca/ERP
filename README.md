# ERP Social Luz da Esperança

A TypeScript modular monolith for social assistance. Fastify serves the versioned API and the compiled React application from one process; PostgreSQL is managed through one root Prisma schema. This C-01 bootstrap contains operational endpoints and an initial client shell, with business features delivered by their assigned modules.

## Prerequisites

- Node.js 24.20.0 (see `.node-version`) and npm 11 or 12. Use the committed `package-lock.json` and `npm ci`.
- PostgreSQL 17, either installed locally or supplied through Docker Compose v2. The application does not require Docker when an isolated PostgreSQL database is available.
- Synthetic development data only; institutional decisions and access to real data remain pending.

## First setup

From the repository root, copy the example environment and install dependencies:

```powershell
Copy-Item .env.example .env
npm ci
```

On a POSIX shell, use `cp .env.example .env` instead. The example credentials are for an isolated local database only. Set your own local database settings and keep `DATABASE_URL` consistent with the `POSTGRES_*` values. Environment files are ignored by Git; never copy production credentials into them.

Start PostgreSQL with either your local installation or the provided development service:

```sh
docker compose up -d --wait postgres
```

The Compose service binds PostgreSQL to `127.0.0.1` and preserves data in a named volume. Then generate the client and apply versioned migrations:

```sh
npm run prisma:generate
npm run db:migrate
```

The first migration establishes the shared schema. Subsequent migrations add access, audit, operation confirmations, institutes, and projects. Apply the complete versioned history and follow [migration conventions](docs/contracts/git-flow-and-migrations.md); never rewrite a migration that has already been applied.

## Initial administrator

Provision the first named operator through the local command after applying migrations. This procedure is for the authorized environment operator; it grants only the explicit `ADMIN` profile. It creates an audit entry, refuses to run once any user exists, and serializes concurrent provisioning attempts. It does not create a shared account, default password, operational privileges, or a public registration endpoint.

On PowerShell, supply the credentials through the process environment, with the password read interactively:

```powershell
$env:BOOTSTRAP_ADMIN_LOGIN = Read-Host 'Initial administrator login'
$env:BOOTSTRAP_ADMIN_DISPLAY_NAME = Read-Host 'Initial administrator display name'
$bootstrapPassword = Read-Host 'Initial administrator password' -AsSecureString
$env:BOOTSTRAP_ADMIN_PASSWORD = [System.Net.NetworkCredential]::new('', $bootstrapPassword).Password
try { npm run admin:bootstrap }
finally {
  Remove-Item Env:BOOTSTRAP_ADMIN_PASSWORD -ErrorAction SilentlyContinue
  $bootstrapPassword.Dispose()
}
```

On other shells or for a compiled deployment, provide the same `BOOTSTRAP_ADMIN_*` variables through a protected process environment, then run `npm run admin:bootstrap` or `node dist/server/provision-initial-admin.js`, respectively. Keep passwords out of command arguments, shell history, committed files, and shared logs. Later accounts and profiles are managed by the authenticated ADMIN API. Account recovery after deactivating every administrator requires a separate approved procedure; this command does not bypass that guard.

## Authentication and contracts

The [access/session contract](docs/contracts/access-and-session.md) defines the public `loginIdentifier`, `sessionToken`, and `expiresAt` fields. The [institute/project contract](docs/contracts/institutes-and-projects.md) defines protected operations and paginated lists. An ADMIN-only account has no implicit permission to manage projects; assign approved operational profiles explicitly.

`AUTH_MAX_FAILED_ATTEMPTS`, `AUTH_LOCKOUT_DURATION_SECONDS`, and `AUTH_SESSION_IDLE_TIMEOUT_SECONDS` are validated positive integers. Their defaults in `.env.example` are technical proposals under LAC-10. Failure counting is per normalized login and resets after a successful login or expiry of a lock; the proposed lock duration is 900 seconds. All counters and lock transitions are serialized on the server. Production always uses `Secure` cookies; other shared HTTPS environments must set `AUTH_COOKIE_SECURE=true`. Local loopback HTTP uses `false`.

## Development

Run the server and client in separate terminals:

```sh
npm run dev:server
```

```sh
npm run dev:client
```

Open `http://127.0.0.1:5173`. Vite proxies `/api` to the Fastify port configured in `.env` (3000 by default). The two development processes produce one deployable application; Vite is not a separate production service.

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

Unit/HTTP tests use injected external dependencies and require no database. Integration tests require an explicitly selected, isolated PostgreSQL database; they do not silently use development or production data:

```powershell
$env:TEST_DATABASE_URL = 'postgresql://erp:erp-local-only@127.0.0.1:5432/erp_test?schema=public'
$env:DATABASE_URL = $env:TEST_DATABASE_URL
npm run db:migrate
npm run test:integration
```

Create that control database first using your PostgreSQL administration tools. The integration-test role needs `CREATEDB` only in this isolated test service: tests create a randomly named disposable database, apply all migrations, exercise real access/project flows and concurrency, then drop only that database. The production application role does not need this privilege. In a POSIX shell, use `export TEST_DATABASE_URL='...'` and `export DATABASE_URL="$TEST_DATABASE_URL"`. GitHub Actions supplies an ephemeral PostgreSQL service and runs the same quality gates. Feature pull requests must target `develop`; CI rejects feature-to-`main` requests.

## Run the compiled monolith

```sh
npm run build
npm start
```

Open `http://127.0.0.1:3000` (or your configured port). The server serves the compiled React application and its assets, with an HTML navigation fallback that does not intercept API failures.

| Endpoint | Purpose | Result |
| --- | --- | --- |
| `GET /api/v1/health` | Liveness; does not query PostgreSQL | `200 {"status":"ok"}` |
| `GET /api/v1/ready` | Readiness; executes a Prisma query against PostgreSQL | `200` when reachable; safe `503` Problem Details otherwise |

Login is also public; session, user administration, institutes, and projects enforce the C-02 authentication/authorization contract. Local loopback development uses HTTP; shared deployments require TLS and a separate approved operational procedure. This setup does not authorize production deployment.

## Project layout

```text
src/
  client/       React entry point; feature UI added as needed
  server/       Fastify composition, configuration, errors, database adapter
  modules/      Cohesive business modules added by backlog task
test/
  server/       HTTP/configuration tests and PostgreSQL integration test
  modules/      Add module behavior tests alongside their source organization
prisma/         Single schema and versioned migrations
docs/contracts/ Common API, identity, error, ownership, and migration contracts
docs/adr/       Architecture decisions, still subject to recorded review
```

Generated Prisma code lives under `src/server/generated/` and is ignored. Build artifacts live under `dist/` and are ignored. Frontend feature directories are created only when needed.

Read the [module boundaries](src/modules/README.md), [glossary](GLOSSARY.md), [common contracts](docs/contracts/README.md), and [shared environment contract](docs/contracts/shared-environment.md) before starting a feature. Redis is reserved for a justified cache use case with explicit TTL and invalidation; it is not a required bootstrap dependency. Authentication, audit, and business models remain assigned to C-02, C-03, and their product tasks.

Agent users start with [AGENTS.md](AGENTS.md). [CLAUDE.md](CLAUDE.md) and [GEMINI.md](GEMINI.md) delegate to that canonical guide; the latter supports Gemini CLI and AGY/Antigravity without duplicating policy.
