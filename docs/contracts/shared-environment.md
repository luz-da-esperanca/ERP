# Shared Executable Environment — C-01 Item 5

- **Status:** Implementation candidate; independent technical review and integration pending.
- **Contract owner:** Felipe (`@FelipeeMartinns`), per the common ownership matrix.
- **Bootstrap executor:** Fabricio (`@Fabricio-Fontenele`), advancing this item on 2026-10-23 at the user's direction.
- **Review:** Independent review of Fabricio's implementation is required; no sign-off is implied by this document.

## Reproducible entry point

[README.md](../../README.md) owns the clean-setup commands. [ADR-0006](../adr/0006-single-package-and-executable-bootstrap.md) records the single-package decision and its trade-off. The package manifest and lockfile own exact dependencies; do not introduce another package manager or parallel root lockfile.

The installed choices are Node.js 24, TypeScript 6, Fastify 5, React 19, Vite 8, Prisma 7, Vitest 5, and ESLint 10. Prisma CLI, client, and PostgreSQL adapter use the same 7.10.1 release. Vite supplies development/build tooling; its server is not part of deployment. No business features, login policy, audit engine, or cache is implemented here.

## Runtime boundaries

- `src/server/main.ts` reads configuration, constructs the Prisma adapter and Fastify application, and disconnects PostgreSQL when the server closes. Add business-module registration at this composition boundary.
- `src/server/app.ts` constructs an injectable HTTP application. `checkDatabase` isolates the real external connection for HTTP tests; it is not a business abstraction or global service locator.
- Liveness is `GET /api/v1/health`. Readiness is `GET /api/v1/ready` and performs a real Prisma query. Database failure yields `503 SERVICE_UNAVAILABLE` without connection details.
- The bootstrap implements safe `400 INVALID_REQUEST`, `404 RESOURCE_NOT_FOUND`, `500 INTERNAL_ERROR`, and `503 SERVICE_UNAVAILABLE` envelopes from the common error contract. Module-specific semantic, authorization, concurrency, and persistence translations must be added with their own behavior tests; throwing a raw domain error is not their public contract.
- Each Problem Details response receives an opaque server-generated UUID trace ID. Request bodies, query strings, and raw exceptions are omitted from automatic request logs. Log failures using safe codes and trace IDs; never restore unrestricted payload logging.
- Compiled-client serving is enabled by the `npm start` command. HTML navigation falls back to `index.html`; unknown API paths retain Problem Details and missing assets return 404.

## Configuration and database

`DATABASE_URL` must identify a PostgreSQL database. `HOST` defaults to `127.0.0.1`; `PORT` defaults to 3000 and must be a valid TCP port. Invalid configuration fails without echoing credentials. The PostgreSQL adapter uses a five-second connection-acquisition timeout as a technical local default, not an institutional performance or availability promise.

`.env.example` supplies synthetic, local-only settings. `compose.yaml` supplies a loopback-bound PostgreSQL 17 service; an existing local PostgreSQL installation is also supported. Do not apply commands to production. Prisma generation works without a live database; migrations require an explicitly configured `DATABASE_URL`.

The initial migration creates `public` and the Prisma migration history, without fake entities. Business migrations subsequently add real models, UUIDv7 entity keys, integrity constraints, and transaction boundaries with their owning tasks. Generated Prisma output, local configuration, and compiled assets stay untracked.

`TEST_DATABASE_URL` is mandatory for the real PostgreSQL integration suite. Unit tests never open an implicit connection. GitHub Actions uses a disposable PostgreSQL database and read-only repository permissions. CI configuration alone is not evidence that a remote workflow ran.

## Acceptance evidence

Executed on 2026-10-23 using Node.js 24.20.0, npm 11.19.0, and an isolated PostgreSQL 17.10 server bound to loopback. PostgreSQL was started from temporary portable binaries because Docker and PostgreSQL were not preinstalled; those verification binaries are not project dependencies.

The clean verification used a fresh local clone of `feature/c-01-common-contracts` with this uncommitted candidate applied, excluding the original working tree's environment files, `node_modules`, generated client, and `dist`. It installed its own dependencies and applied the migration to a separate empty `erp_c01_clean` database. No commit, push, or reviewer approval was created to manufacture this evidence.

| Check | Executed result |
| --- | --- |
| `npm ci --no-fund` in the clean clone | Passed; lockfile reproduced the installation |
| `npm run prisma:generate` | Passed without pre-existing generated code |
| `npm run db:migrate` | Initial versioned migration applied successfully to the empty database |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed with zero warnings |
| `npm test` | 19 tests passed: 7 HTTP/runtime-boundary tests and 12 configuration cases |
| `npm run test:integration` | 1 test passed using Prisma against real PostgreSQL |
| `npm run build` | Fastify/TypeScript and React/Vite outputs compiled successfully |
| Compiled-server HTTP smoke check | Liveness, PostgreSQL readiness, client HTML, built JavaScript asset, HTML navigation fallback, and API 404 all passed in the original tree and clean clone |
| `git diff --check` and documentation entry-point links | Passed |

Docker Compose was not executed because Docker is unavailable on this host. The configured official `postgres:17.10-alpine` image tag was checked against the registry; this is not a claim that the container ran. The alternative native PostgreSQL path was executed. Remote GitHub Actions results are recorded on the corresponding pull request and must be checked separately from the local evidence above.

### Independent review — Felipe (`@FelipeeMartinns`) — 2026-10-23

- **Role:** Contract owner for Item 5 (independent review; no sign-off implied)
- **Branch verified:** `feature/c-01-item5-verification` (commit `a6cf091`) in a fresh clone at `C:\Users\Felipe\AppData\Local\Temp\opencode\c01-clean` (no reuse of `node_modules`, `dist`, `.env`)
- **Environment:** Node.js v24.20.0, npm 11.19.0 (via nvm), Docker Desktop 29.5.2, PostgreSQL 17.10 (`postgres:17.10-alpine`) via `docker compose`. `.node-version`/README specify Node 24.20.0 and npm 11.19.0; environment adjustment required.

| Check | Executed result |
| --- | --- |
| `npm ci --no-fund` | Passed (390 packages, 0 vulnerabilities) |
| `npm run prisma:generate` | Passed |
| `npm run db:migrate` (empty `erp`) | Passed (`20261023160000_initialize_schema`) |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed (0 warnings) |
| `npm test` | Passed (2 files, 19 tests) |
| `npm run test:integration` (`erp_test`) | Passed (1 file, 1 test) |
| `npm run build` | Passed (tsc + vite) |
| `npm start --serve-client` smoke | `GET /api/v1/health` 200; `GET /api/v1/ready` 200; `/` served HTML with client script; `GET /api/v1/naoexiste` 404 (Problem Details) |

**Observations:**
- Docker was available in this environment (Fabricio reported unavailable and used portable binaries) — environment difference, not a code defect.
- Bootstrap commits (`1d103d7`, `74a3767`, `69118aa`, `a6cf091`) entered `develop` directly without a pull request/review, which conflicts with [`git-flow-and-migrations.md`](./git-flow-and-migrations.md). This requires tracking/decision.
- Prisma 7.10.1 reports an update notice to `8.0.0-rc.27` (advisory only).
- Item 5 behavior matches the documented contract; independent verification completed. Formal sign-off still pending per contract.

Contract ratification and institutional approvals remain in [the C-01 review register](./c-01-review-and-approval-evidence.md), not in a successful build. The database/server checks establish a development starting point, not production readiness or completed business functionality.
