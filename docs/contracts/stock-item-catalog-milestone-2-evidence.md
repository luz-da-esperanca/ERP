# TG-01-02 — Milestone 2 Implementation Evidence

- **Date:** 2026-10-26. **Owner:** Erick (`@Erick-VP`). **Reviewer:** Felipe (`@FelipeeMartinns`).
- **Scope:** B1 readable codes and m1 canonical revision identifiers; preserve m3 pagination and m4 atomic audit semantics.
- **Contract:** [catalog 0.2.0 implementation candidate](stock-item-catalog.md), following the [Milestone 1 proposal](stock-item-catalog-review-alignment.md).
- **Delivery state:** local working-tree changes on `feature/tg-01-02`, based on published HEAD `9ec9ee38eb8dffa893901ed8e3bb18aae43732e5`. No commit, push, merge, deployment or GitHub comment was created by this milestone. Felipe has not yet reviewed this implementation.

## Implemented behavior

PostgreSQL allocates `ITEM`, `CAT`, `UNIT` and `SIZE` codes through independent BIGINT sequences and generated defaults. Codes retain at least six digits, expand without truncation, and remain text across Prisma/JSON. Database NOT NULL, unique/canonical constraints and UPDATE guards protect them. Sequence exhaustion is translated locally in the catalog adapter from structured SQLSTATE `2200H` to the existing safe `409 CONFLICT` envelope; no shared error registry or audit mechanism is replaced.

Catalog identity records own their immutable codes. An item keeps its code across every revision and status change. Reads project category/unit/size codes using the UUIDs of the selected revision through bounded Prisma relation queries, while retaining historical names and unit precision from the snapshot. No per-item lookup loop is introduced. Repositories return generated codes to application services before audit/confirmation recording, within the same protected transaction.

New read DTOs contain codes; wire response types permit their absence only for exact pre-migration confirmation replays. Existing stored response/audit JSON and payload digests are not rewritten. Retried success returns the original response, including the same code when originally present. Creation failures roll back identities, revisions, audit and confirmation; consumed sequence numbers intentionally remain gaps. The in-memory adapter models that allocation behavior without claiming PostgreSQL guarantees from a fake.

The revision route accepts only `[1-9][0-9]*` within the supported positive signed 32-bit range. `/01`, `/001`, zero, signs, decimals, exponent forms, whitespace and oversized values now return `404 RESOURCE_NOT_FOUND`; valid revision 1 and missing-revision behavior are covered.

The original independent `count`/`findMany` pagination queries remain in place. `totalPages` still derives from `totalItems` and `pageSize`; the contract documents best-effort consistency. Authorization, operation claiming, audit order, transaction composition, Quantity and frontend code remain unchanged.

## Migration and preservation proof

The new [migration](../../prisma/migrations/20261026191500_add_stock_catalog_codes/migration.sql) uses one explicit transaction and fixed-order exclusive locks. It adds nullable code columns without defaults, backfills all identities by `(created_at, id)`, initializes each sequence once, and installs defaults, constraints and guards before commit. Existing migration files are unchanged.

The [migration integration suite](../../test/server/stock-catalog-codes-migration.integration.test.ts) creates databases at the old migration boundary using a temporary copy of that history, seeds populated legacy tables, then runs the real complete `migrate deploy` path. It proves:

- Existing active/inactive categories are numbered deterministically by date and UUID, independently of insertion order.
- Existing item UUIDs, versions and timestamps, multiple revision rows, referenced IDs, historical names and unit precision are unchanged.
- A legacy confirmation without codes replays its exact original body despite later revisions and retired references; existing audit/confirmation rows and JSON values remain unchanged.
- Historical GET projects the codes for the original references, while the current GET projects the newer references, with one stable item code.
- A writer omitting the new column receives a database default, representing old-binary INSERT compatibility.
- Repeated successful deploy preserves codes and continues sequence allocation above the backfill and intervening inserts.
- A deliberate conflicting sequence makes the migration fail after earlier tables have been processed. The transaction rolls back code columns/backfill. Controlled `migrate resolve --rolled-back` and redeployment recover without changing legacy identity data.

The [code integration suite](../../test/server/stock-catalog-codes.integration.test.ts) separately proves empty installation, all four prefixes, independent allocation, database constraints, rejected client-selected codes, status preservation, revision integrity, concurrent legitimate creates, concurrent idempotent retries, conflicting payloads, suffix growth, values beyond JavaScript's safe integer range, maximum BIGINT allocation, explicit exhaustion, replay after exhaustion, and safe retry after audit/confirmation failure.

Deployment still requires the preflight/maintenance procedure in the contract, including writer draining, privilege and backup assessment, migration-before-new-binary ordering and retention of the additive schema during application rollback. Production row counts and lock duration were not inspected or assumed. No production data was accessed.

## Actual RED / GREEN cycles

| Slice | Observed RED | Observed GREEN |
| --- | --- | --- |
| m1 HTTP regression | `/revisions/01` returned 200 instead of 404. | Canonical revision 1 succeeds; the malformed/missing forms in the regression return the correct 404 Problem Details. |
| B1 HTTP creation | Category response omitted `CAT-000001`. | Independent codes appear on all four resources, nested references and audit snapshots. |
| B1 PostgreSQL API | A real migrated database/API returned a category without a code. | Generated defaults produce codes that survive API retrieval/listing. |
| B1 populated upgrade | After deploy, the expected code column was absent. | Real additive migration/backfill, repeated deploy, legacy replay and historical preservation pass. |
| B1 database integrity | The test's generated-code precondition failed because codes were absent. | All four resources reject duplicate codes and code mutation; malformed/out-of-capacity direct inserts are rejected. |
| B1 sequence exhaustion | API returned 500 instead of the specified 409. | All four resources return safe 409 CONFLICT at exhaustion; successful stored responses still replay. |

Additional regression proof exercises the reused transactional mechanism rather than claiming a new RED failure for behavior it already implemented. Existing HTTP, domain and native Node runtime regression tests remain passing. No artificial behavior tests were added for the documentation-only dispositions of m3/m4.

## Executed verification

Environment observed: **Node.js 24.20.0**, **npm 11.19.0**, **PostgreSQL 17.10** in a task-specific disposable container bound to loopback. Test suites created/migrated/dropped their own isolated databases. Credentials and connection URLs are intentionally omitted here.

| Command / check | Actual result |
| --- | --- |
| Focused Vitest runs during RED/GREEN | Expected failures above were observed before their corrections; focused suites subsequently passed. |
| `npm test` | **166 passed across 18 files**, including client tests brought in by develop and native Node runtime coverage. |
| `npm run test:integration` with explicit isolated `TEST_DATABASE_URL` | **24 passed across 4 files**, including existing access/project tests and both new code/migration suites. |
| `npm run typecheck` | Passed. |
| `npm run lint` | Passed with no lint warnings. |
| `npm run build` | Prisma generation, server compilation and client production build passed. |
| `npm run db:migrate` against the disposable control database | All five versioned migrations applied successfully. |
| Prisma `migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` against that database | Exit 0, **No difference detected**. |
| Diff review | No changes to existing migrations, shared access/audit/idempotency implementations, client source, manifest or lockfile. |
| Documentation and whitespace | 39 local paths/anchors validated; `git diff --check` and whitespace checks for every new file passed. |

The integration run emitted `pg` driver deprecation warnings about concurrent `client.query()` usage; all assertions passed. No dependency upgrade or pagination/isolation refactor was performed to silence them. This is recorded as a non-failing diagnostic, not hidden as a clean stderr claim.

## Milestone 3 continuation and external acceptance

After refreshing Git references, the local and published feature HEAD remained `9ec9ee38eb8dffa893901ed8e3bb18aae43732e5`; `origin/develop` remained `70b6417133080dbbbc37c42f146ff1131c66ebfe` and is an ancestor of HEAD. `git merge-tree --write-tree HEAD origin/develop` exited 0, producing tree `3f246eaef9cd86efb3d8264a6d5eded16a56a6bb`. **That simulation covers those committed refs only, not this uncommitted implementation.** Refresh and record the final committed pair when updating PR evidence.

The previously inspected [Quality run 18](https://github.com/luz-da-esperanca/ERP/actions/runs/40375382288) is green for published HEAD `9ec9ee3`; it does not validate these local changes. New final PR commits require their own CI evidence after an explicitly authorized commit/push. Local verification does not require either action.

TG-01-05 integration/demonstration and Felipe's review remain pending. This implementation neither adds Paulo's interface nor closes G-01 on its own. The team-lead audit interpretation remains recorded separately from Felipe's acknowledgment. There is no identified institutional-policy conflict or need to expand the task into stock movements, balances, origins or conversions.

Suggested commit separation: readable-code implementation/migration/tests; m1 route/regression; contract/evidence documentation. No commit is created automatically.
