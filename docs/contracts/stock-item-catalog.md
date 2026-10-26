# Stock Item Catalog (`TG-01-02` / `G-01`)

- **Status:** Implementation candidate; Felipe's review and integrated UI acceptance pending.
- **Owner:** Erick (`@Erick-VP`). **Reviewer:** Felipe (`@FelipeeMartinns`).
- **Version:** 0.2.0 implementation candidate; Felipe's review remains pending.
- **Milestone amendments (2026-10-26):** Milestone 1 specified the readable-code proposal; Milestone 2 implements the code fields, sequences and additive migration below. The convention remains a technical proposal submitted for review, not prior institutional approval. Pagination documents preserved behavior. The audit interpretation records project direction supplied by Erick, separately from Felipe's pending acknowledgment.
- **Requirements:** RF-EST-01, RF-EST-08, VAL-05, VAL-06, OP-01, OP-02, OP-03, OP-05, AC-40, AC-50, AC-52.
- **Dependencies:** [common API](common-api-contracts.md), [identifiers](common-identifiers.md), [errors](common-errors.md), [access](access-and-session.md), and C-03's shared transaction/audit/idempotency ports.

## Boundaries and authorization

This API owns items, categories, units, and size/numbering options. It does not create donation origins, receipts, lots, stock movements, conversions, deliveries, financial records, or frontend screens. No donor or campaign is required to create an item. G-06 later combines items and origins for receipts; TG-01-05 consumes this API for the catalog interface.

See the [Milestone 1 review alignment](stock-item-catalog-review-alignment.md) for the evidence matrix, decision rationale, implementation gates and reviewer-facing summary for [issue #7](https://github.com/luz-da-esperanca/ERP/issues/7) and [PR #17](https://github.com/luz-da-esperanca/ERP/pull/17).

All endpoints require a current authenticated session and either `STOCK_DISTRIBUTION` or `COORDINATOR`, following the operational scope in C-02. `ADMIN` alone grants no catalog access. Other profiles receive `403 FORBIDDEN`; missing/invalid sessions receive `401 AUTH_REQUIRED`. Reading historical revisions is protected by the same guard. These restrictions do not approve the pending institutional field-level matrix in LAC-08.

Every POST and PATCH requires `Idempotency-Key: <UUIDv4|UUIDv7>`. The server takes authorship from the authenticated session, never from the body. Clients cannot set IDs, timestamps, audit authors, or initial versions. Unknown body/query fields are rejected, not silently ignored.

## Categories, units, and size/numbering options

| Resource | Meaning |
| --- | --- |
| `/api/v1/stock-categories` | Item categories |
| `/api/v1/stock-units` | Units with explicit decimal precision |
| `/api/v1/stock-sizes` | Size or numbering labels, including their standard when needed (for example, synthetic `BR 39`) |

Each resource supports:

- `POST /`: `{ "name": "Synthetic category" }`; units additionally **require** `"precision": 0` (or another supported precision).
- `GET /`: paginated options, ordered by name then ID, including inactive options.
- `GET /:id`: one option, or `404 RESOURCE_NOT_FOUND`.
- `PATCH /:id`: `{ "version": 1, "isActive": false, "reason": "Retire obsolete option." }` to deactivate; `true` reactivates it.

Responses contain `id`, `code`, `name`, `precision`, `isActive`, `version`, `createdAt`, and `updatedAt`, with the legacy-confirmation exception described below. `precision` is an integer for units and `null` for categories/sizes. Names are trimmed, non-empty strings with at most 150 characters. Equal names do not imply equal identities; no unapproved uniqueness rule is imposed on names. Codes are unique within each resource.

Names and unit precision cannot be edited through this API. Create a new option when its meaning changes, update the item to use it, and retire the old option if appropriate. Existing IDs and historical meanings remain stable. There is no delete endpoint.

Precision `0` means indivisible. Precisions `1..18` support fractions. The upper bound is a technical representation limit, **not** an approved precision for any institutional unit. No default units, precision settings, size standards, conversion factors, or categories are seeded. LAC-06 remains pending; demonstrations and automated tests use synthetic options only.

## Items and immutable revisions

### Create and read

`POST /api/v1/stock-items`:

```json
{
  "name": "Synthetic shoe",
  "categoryId": "01963000-0000-7000-8000-000000000301",
  "unitId": "01963000-0000-7000-8000-000000000302",
  "sizeId": "01963000-0000-7000-8000-000000000303"
}
```

`name`, `categoryId`, and `unitId` are required. `sizeId` is optional; omitted or `null` means not informed/not applicable, never size zero. When supplied, each reference must identify an existing active option of the correct kind. The item name follows the same text bounds as option names.

`201 Created` returns:

```json
{
  "id": "01963000-0000-7000-8000-000000000304",
  "code": "ITEM-000001",
  "revisionId": "01963000-0000-7000-8000-000000000305",
  "version": 1,
  "name": "Synthetic shoe",
  "category": { "id": "01963000-0000-7000-8000-000000000301", "code": "CAT-000001", "name": "Synthetic footwear" },
  "unit": { "id": "01963000-0000-7000-8000-000000000302", "code": "UNIT-000001", "name": "Synthetic pair", "precision": 0 },
  "size": { "id": "01963000-0000-7000-8000-000000000303", "code": "SIZE-000001", "name": "Synthetic BR 39" },
  "isActive": true,
  "createdAt": "2026-10-25T15:00:00.000Z",
  "updatedAt": "2026-10-25T15:00:00.000Z"
}
```

- `GET /api/v1/stock-items`: current item representations, ordered by item ID, including inactive items.
- `GET /api/v1/stock-items/:id`: current representation.
- `GET /api/v1/stock-items/:id/revisions/:version`: the preserved historical business representation, including its original revision ID, names, unit, precision, and size, enriched with immutable identity codes. Missing/malformed resource or revision identifiers return `404`. The revision segment must match `[1-9][0-9]*` and fit the positive signed 32-bit persistence range; leading zeros, signs, whitespace, decimal/exponent forms and out-of-range values return `404 RESOURCE_NOT_FOUND` without coercion to another revision.

All list endpoints accept only `page` and `pageSize`, using the shared defaults `1`/`20` and maximum `100`. Responses are `{ items, page, pageSize, totalItems, totalPages }`; persistence applies the bounds. Unsupported, repeated, or malformed query parameters return `400 INVALID_REQUEST`. Offsets above the supported signed 32-bit integer capacity are also rejected before persistence; out-of-capacity revision numbers return `404`.

### Pagination consistency (m3)

**Proposed documented contract for the existing implementation; Felipe's review remains pending.** The catalog retains its current independent `findMany` and `count` queries. It does not guarantee one shared database snapshot for a list response. Under concurrent committed writes, `items` and `totalItems` can reflect different committed states.

`totalPages = Math.ceil(totalItems / pageSize)` is calculated from the returned count; it is **not** independently sampled. Consequently, `totalItems` and its derived `totalPages` can describe a different observed dataset from `items`. A page can be empty or differ from what the totals suggest. Separate page requests also do not guarantee a stable dataset: concurrent inserts can shift offsets, causing entries to repeat or be skipped across pages, while corrections can change the returned item contents between reads. A client may reload; no subsequent read is guaranteed to match an earlier total while writes continue.

This is best-effort pagination, not eventual consistency between independently authoritative databases. PostgreSQL remains the source of truth. It does not weaken authorization, bounded queries, historical revisions or atomic writes. [Common API §6.4](common-api-contracts.md#64-pagination) requires pagination but no shared snapshot. No stronger isolation or additional read transaction is proposed for m3.

### Update

`PATCH /api/v1/stock-items/:id` accepts `version`, `reason`, and at least one of `name`, `categoryId`, `unitId`, `sizeId`, or `isActive`. Omitted fields retain their values; explicit `sizeId: null` clears the current size. Other required fields cannot be cleared with `null`.

`version` must be the positive integer returned by the previous read. `reason` is a trimmed, non-empty string with at most 1000 characters. Success returns `200`, increments the version, and creates a new server-generated `revisionId`. Concurrent stale edits return `409 STALE_VERSION` without partial history. A retirement-only patch (`isActive: false`, no other editable fields) can preserve existing references even if they were retired; other updates must use active references.

Revisions are append-only through the application contract. They retain category/unit/size names and unit precision as historical snapshots, independently of the current catalog. Foreign keys prevent deletion of used references. There is no endpoint to overwrite or delete a historical revision.

**Future movement integration:** persist the item's `revisionId` (or the stable item ID plus exact version) when recording a fact. Resolve its unit, precision and size from that revision, never by substituting the current item representation. This task provides the reference and retrieval contract; it does not implement or claim to validate a real stock movement workflow.

## Exact quantity contract for future stock operations

The public domain capability is `Quantity.parse(value, unit, canBeZero?)`, `quantity.add(other)`, and `quantity.toString()` in `src/modules/social-stock/domain/quantity.ts`. The caller supplies a unit `{ id, precision }` obtained from the applicable catalog revision.

- Input is a decimal **string**, such as `"0.1"`; JSON numbers, negative values, whitespace, comma separators, exponent notation, leading-zero integer forms and non-finite values are rejected.
- Positive quantities are the default. Zero is accepted only when the consuming operation explicitly passes `canBeZero: true`, for cases such as physical counts or triage portions (VAL-05).
- Fraction digits cannot exceed the unit precision, including for indivisible units. Excess precision is rejected, never rounded or truncated.
- Arithmetic uses scaled `bigint` values, not floating-point numbers. `"0.1" + "0.2"` at precision 3 produces `"0.300"`. Output always retains the configured scale.
- At most 38 digits are supported in the scaled integer; addition beyond that capacity is rejected. Future quantity persistence must preserve that exact representation and validate capacity before writing to a database decimal column.
- Addition requires the same unit ID and precision. Equal precision or similar labels do not establish compatibility. Cross-unit addition/conversion is rejected; no conversion engine or unapproved factors are implemented.

Item creation deliberately accepts no quantity or balance. Quantities belong to receipts, lots and movements in their owning tasks.

## Audit, transactions, and errors

The existing C-03 mechanism owns audit and idempotency. This module consumes it through transaction-bound repository, audit, and confirmation ports from server composition; it defines no parallel mechanism.

- Operation types: `CREATE_STOCK_CATEGORY`, `CREATE_STOCK_UNIT`, `CREATE_STOCK_SIZE`, `CREATE_STOCK_ITEM`, and corresponding `UPDATE_STOCK_*` types.
- Confirmations are scoped by actor, operation type and key. Repeating the same normalized payload returns the original status/body; changed content returns `409 IDEMPOTENCY_CONFLICT`. Names/reasons are trimmed; item reference input is otherwise compared as supplied. Use IDs exactly as returned by the API.
- An option/item change, its audit entry, and confirmation commit together. Reference validity is checked inside the transaction; shared row locks prevent an option from being retired between validation and commit.
- Audit entity types are `STOCK_CATEGORY`, `STOCK_UNIT`, `STOCK_SIZE`, and `STOCK_ITEM`. Create uses `CREATE`; update uses `UPDATE` with before/after and reason. The common audit mechanism supplies fact date and registration timestamp from the server clock. Catalog requests accept no client `factDate`.
- Failure of audit or confirmation rolls back the business change. A retry can safely use the same operation key.

### Atomic audit interpretation (m4)

The team lead confirmed, **as reported in Erick's Milestone 1 instructions on 2026-10-26**, that “before persisting” in TG-01-02 means protection of the atomic commit, not a literal requirement that an audit INSERT precede a business INSERT. This is the confirmed project direction supplied for implementation. The retrieved PR discussion contains Felipe's question, not his subsequent acknowledgment; no independent public confirmation link was supplied or found in the inspected PR/issue discussion. Felipe's reviewer acknowledgment remains pending and is not a prerequisite to implementing this technical proposal.

- Authenticate and authorize before protected effects; obtain the actor from the session.
- Claim the scoped operation identity before effects. The existing C-03 advisory transaction lock serializes actor/operation/key before replay lookup and the business callback; the final confirmation row is written after a successful callback.
- Business changes, audit and operation confirmation use the same transaction-bound adapters and commit together. An error in any part rolls all of these database effects back.
- Audit before/after values describe the business state around a change. They do not prescribe SQL statement order. A business INSERT followed by audit and confirmation INSERTs, **before their common commit**, satisfies this interpretation.

This aligns with [AGENTS.md — PostgreSQL and Prisma](../../AGENTS.md#postgresql-and-prisma), [common API §6.2](common-api-contracts.md#62-idempotency), ERS RF-ACS-04 and OP-01 in the [ERS](<../ERS — ERP Social Luz da Esperança.md>), and [ADR-0005](../adr/0005-sensitive-data-protection-and-server-side-authorization.md). [Issue #7](https://github.com/luz-da-esperanca/ERP/issues/7) retains its original wording. Its owner may clarify that wording editorially; this amendment changes no ownership document or common audit implementation. Existing rollback tests cover failure at audit and confirmation stages; Milestone 1 inspected that evidence without rerunning application tests.

## Proposed readable-code extension (B1 / 0.2.0)

**Status: implemented as a Milestone 2 candidate, subject to Felipe's subsequent review.** The following choices close the TG-01-02 design gap assigned by [common identifiers §§2 and 6](common-identifiers.md#6-human-readable-codes). This is a technical catalog convention, not an institutional unit, eligibility, donor or conversion policy. No deferral of B1 implementation is proposed. See [Milestone 2 evidence](stock-item-catalog-milestone-2-evidence.md) for executed checks and remaining external acceptance.

### Canonical form and capacity

| Resource | Canonical example | Identity table | Dedicated sequence | Minimum / maximum ASCII characters |
| --- | --- | --- | --- | --- |
| Item | `ITEM-000001` | `stock_items` | `stock_item_code_seq` | 11 / 24 |
| Category | `CAT-000001` | `stock_categories` | `stock_category_code_seq` | 10 / 23 |
| Unit of Measure | `UNIT-000001` | `stock_units` | `stock_unit_code_seq` | 11 / 24 |
| Size Option | `SIZE-000001` | `stock_sizes` | `stock_size_code_seq` | 11 / 24 |

The form is the table's exact uppercase ASCII prefix, one ASCII hyphen (`-`), and a positive base-10 suffix. Each suffix is derived from its allocated integer with **minimum six-digit** zero padding. Values 1, 999999 and 1000000 render as `000001`, `999999` and `1000000`. Longer values are never truncated or padded to a new fixed width. No spaces, signs, decimal points, alternate separators, lowercase letters or non-ASCII digits are canonical.

For prefix `P`, the canonical value is `P + '-' + decimal(n).padStart(6, '0')`, for `1 <= n <= 9223372036854775807`. This notation defines the rendering, not a JavaScript numeric conversion. The maximum code is, for example, `ITEM-9223372036854775807`. Reject suffix zero, suffixes outside that range, overlong codes and unnecessary leading zeros beyond the six-digit minimum. A shape check alone is insufficient: range and canonical padding must also hold. The range is a technical PostgreSQL BIGINT capacity, not an institutional volume threshold.

Each resource uses its own logged PostgreSQL `BIGINT` sequence, `START 1 INCREMENT 1 MINVALUE 1 MAXVALUE 9223372036854775807 NO CYCLE CACHE 1`. The default/start is 1 for an empty resource; populated resources use the backfill initialization below. Allocation is concurrent-safe `nextval`, not `MAX(code) + 1`, application process memory, or a client counter. Codes are unique per resource table across **all** active and inactive identities; each table receives `NOT NULL` and a database unique constraint on `code`. Different prefixes also distinguish resources without introducing a cross-table identity or global sequence.

Gaps are explicitly permitted after failed transactions, conflicts, abandoned allocations or operational failures. PostgreSQL sequence consumption is not rolled back with the business transaction. Codes therefore promise neither gapless/consecutive numbering of persisted rows nor ordering of committed facts. Do not decrement, reset, cycle, recycle or reclaim an allocated number. Deactivation/reactivation keeps the code. No delete/reuse feature is added.

At exhaustion, creation fails without persisting a resource, audit or confirmation. Translate allocation SQLSTATE `2200H` at the catalog infrastructure boundary to the **existing** `409 CONFLICT` Problem Details code, with safe detail `A numeração deste catálogo atingiu a capacidade suportada. Contate a coordenação.` No SQL/sequence name is exposed. The failure is not transient; do not automatically cycle, truncate or retry with another sequence. Existing reads, edits and successful idempotent replays remain available. Expanding the representation requires a separately reviewed migration.

Allocation and formatting stay in PostgreSQL. Store codes as strings: `VARCHAR(24)` for item/unit/size and `VARCHAR(23)` for category, with exact prefix/canonical-range checks. A small catalog-scoped database formatter must consume `nextval` **once** per new identity, convert its BIGINT to decimal text and add only the required padding. A fixed-width formatter that truncates after six digits is prohibited. Database defaults call that formatter with a fixed resource prefix and sequence. Prisma exposes `code` as a string with a database-generated default; no BIGINT becomes a JavaScript `number` or JSON number.

The server omits `code` on INSERT, receives the generated code through the repository's persisted result, and uses that result for audit and confirmation. Generation is thus backend-controlled while the database default also covers old application binaries that omit the new column. Runtime database privileges allow the necessary sequence `USAGE`, not administrative restart/rewind privileges. Migration ownership and permissions are assessed before deployment; no role name is presumed.

### Identity, immutability and history

- Add exactly one immutable `code` field to `StockItem`, `StockCategory`, `StockUnit` and `StockSize`. Do not store a second numeric counter column or duplicate codes in `StockItemRevision`.
- UUIDs remain the primary keys and the sole relationship, audit-identity, operation-scope and routing keys. Codes are display metadata; they convey no unit conversion, size equivalence, authorization, priority or chronology.
- Reject client-supplied `code` or alternate code-selection fields on POST/PATCH with the existing `400 INVALID_REQUEST` unknown-field policy, even when the supplied value is canonical. Do not trim, uppercase or otherwise normalize an unauthorized supplied code; reject it. No code search/filter/lookup endpoint is added by this extension.
- Codes are immutable from creation, including before first operational use. Enforce that at transport and application boundaries and with a database `BEFORE UPDATE` guard on each identity table rejecting `NEW.code IS DISTINCT FROM OLD.code`. Install the guards after backfill. Migration/backfill and sequence administration are not runtime application capabilities.
- Item corrections, deactivation and reactivation create no replacement item code. A new revision has its existing item code and a new revision UUID/version. Reclassifying to a different category/unit/size exposes that referenced identity's code in the new revision only.
- A historical response obtains the item code from its identity and category/unit/size codes via the UUIDs stored on **that revision**, never through the latest item's references. Retain historical names and unit precision from the existing revision snapshot. Missing size remains `null`.
- Do not update existing revision rows, business timestamps, versions, audit JSON or confirmation JSON solely to add codes. For pre-migration revisions, a code returned later is newly assigned identity metadata, not a claim that the code existed on the fact date. Historical business meaning remains unchanged; the enriched JSON representation gains additive fields.
- Extend bounded repository queries using joins or Prisma relation includes/selects for code fields, including the nullable size relation. Do not loop over page rows calling `findOption` or issue one lookup per revision/reference. Historical representations keep the same authorization as current ones.

### Proposed API representation and replay compatibility

Keep the existing `/api/v1/` routes, request bodies, UUID parameters, list envelope, operation types, normalized payloads and authorization profiles. Add a read-only `code` to option representations, item representations, and their category/unit/non-null size references. For example, these are the **new fields' locations**, not a replacement for the complete existing DTO:

```json
{
  "id": "01963000-0000-7000-8000-000000000304",
  "code": "ITEM-000001",
  "revisionId": "01963000-0000-7000-8000-000000000305",
  "version": 1,
  "category": { "id": "01963000-0000-7000-8000-000000000301", "code": "CAT-000001", "name": "Synthetic footwear" },
  "unit": { "id": "01963000-0000-7000-8000-000000000302", "code": "UNIT-000001", "name": "Synthetic pair", "precision": 0 },
  "size": { "id": "01963000-0000-7000-8000-000000000303", "code": "SIZE-000001", "name": "Synthetic BR 39" }
}
```

Successful fresh creates, fresh updates, GETs and lists produced by the new implementation include string codes at these locations. Option GET/list/create/update DTOs similarly add their own `code`. Category/size `precision: null` and all other documented fields retain their existing semantics. `code` is not required from clients and is not used in URLs or foreign keys.

On the wire, added code properties must be treated as optional during compatibility/replay handling: **pre-migration operation confirmations replay their exact original status/body, which can omit codes**. Do not rewrite stored confirmations, change payload digests, re-execute successful operations, or enrich old replay bodies in the shared C-03 implementation. Clients that need missing display codes fetch the authorized resource GET after a legacy replay. Current persistence records have non-null codes after migration; this wire exception does not permit a null database code.

New codes are allocated only in the real creation callback **after** the existing scoped identity claim and replay check. A successful retry returns the originally confirmed code without allocating or persisting another identity. Failed writes may consume a sequence value, but resource, revision, audit and confirmation still roll back together. New audit snapshots and confirmations include the code returned by persistence; existing snapshots keep their original content. Allocation of an item revision consumes no item sequence value. This adds no parallel audit or idempotency mechanism.

### Additive migration and deployment plan

The new versioned migration is [`20261026191500_add_stock_catalog_codes`](../../prisma/migrations/20261026191500_add_stock_catalog_codes/migration.sql), ordered after the existing history. `20261025162509_add_stock_item_catalog` and other committed migrations remain unchanged. Milestone 2 executes migrations only in isolated synthetic test databases; no production access or deployment is authorized.

1. **Preflight and maintenance:** In the authorized target environment, assess row counts, disk/index space, backup/restore readiness, active readers/writers, long-running transactions, available migration privileges, Prisma migration status and acceptable lock duration. Rehearse with synthetic populated databases. Production access/volumes are unavailable to this milestone, so do not assume empty tables or claim zero-downtime deployment. Set deployment lock/statement timeouts to the assessed maintenance budget; abort/replan if a bounded maintenance window cannot support the operation. This assessment is an operational prerequisite, not a blocker to the technical specification.
2. **Quiesce catalog writers:** Stop/drain every application instance or job capable of writing catalog identities/revisions before running this migration. Serialize deployment/migration execution. Use an explicit PostgreSQL transaction and acquire `ACCESS EXCLUSIVE` locks on the four identity tables in fixed order: `stock_categories`, `stock_items`, `stock_sizes`, `stock_units`. Hold them through commit. These locks may block readers as well. A writer racing the lock must not observe a partially backfilled schema; writes resume only after deployment verification.
3. **Expand and backfill:** Add nullable `code` columns **without defaults**, then create the four new sequences with their fixed parameters. For each table independently, order all existing rows by `(created_at ASC, id ASC)` and assign `row_number()` as the positive suffix, rendering it canonically. Do not use unordered updates calling `nextval` to define historical numbering. Include inactive rows. This deterministic ordering is technical backfill order, not a claim about original business-event chronology. Abort the transaction on a capacity/integrity failure; do not partially assign codes or silently replace pre-existing unexpected schema objects.
4. **Initialize once:** For a non-empty table with `N` backfilled rows, initialize its dedicated sequence using `setval(sequence, N, true)`, so the next allocation is `N + 1`. For an empty table use `setval(sequence, 1, false)`, so the first allocation is 1. If `N` equals BIGINT maximum, backfill remains valid and later creation reports exhaustion. Initialization is restricted to this new migration; never recompute/reset a live allocator from row counts or `MAX(code)` on startup or repeated deploy.
5. **Constrain and default:** Verify mapping/cardinality, prefix, capacity and absence of duplicates/nulls; add NOT NULL, UNIQUE and canonical-format/range checks; install generated defaults, sequence ownership and code-update guards. Preserve every pre-existing UUID, revision row, name, unit precision, timestamp, version and foreign-key reference. Record technical change evidence in migration history/deployment logs, without fabricating an operator or rewriting historical audit entries for the backfill. Commit the schema and mapping together.
6. **Deploy and verify:** Generate/use the Prisma client for the new schema, run the full versioned migration history using `npm run db:migrate`, then start the new application and resume writers after checks pass. The generated defaults keep old binaries that omit `code` able to insert during application rollback; that is compatibility, not permission to skip maintenance or migration-first ordering. New binaries must not run against the old schema. Reverting the application retains columns, codes, sequences and guards. Any data/schema reversal needs a separately reviewed forward migration; do not drop the new structures or reset codes automatically.
7. **Repeat and recovery:** Prisma's migration ledger makes a subsequent successful `migrate deploy` skip this migration, preserving assigned codes and allocator state. Do not make normal deployment rerun the backfill or initialization. A failed migration must be inspected and recovered through Prisma's controlled failed-migration procedure; do not rerun its SQL blindly or add `IF NOT EXISTS` to conceal an unexpected partial state. Sequence `setval` is not generally transactional; this plan initializes only newly created, unpublished sequences while all affected tables are locked. Confirm rollback and retry of the complete migration in isolated PostgreSQL before deployment.

Migration acceptance in Milestone 2 must cover empty installation, deterministic populated backfill (including inactive records and multiple revisions), repeated successful deploy, migration failure/recovery, concurrent creates, generated values above six digits and above JavaScript's safe integer range, BIGINT exhaustion, direct uniqueness/immutability violations, legacy replay, and rollback after audit/confirmation failure. No real production data is required or authorized for these tests.

### C-01 compatibility and design rationale

| Choice | Compatibility / reason |
| --- | --- |
| Separate readable string codes and unchanged UUID keys | Fulfills common identifiers §6 without replacing any of its internal, operation or external identity families; consistent with ADR-0002. |
| Fixed resource prefixes and minimum six digits that expand | Distinguishes the four catalogs, keeps small values readable, and avoids an arbitrary six-digit exhaustion point. The starting proposal is retained. |
| One native BIGINT sequence per identity resource | Avoids process-local races and cross-resource contention; no library or generic numbering subsystem is needed. |
| Gaps allowed; NO CYCLE; no reset/reuse | Preserves identity stability under concurrency and rollback without expensive gapless counter locking. Codes carry no chronological guarantee. |
| Database default, unique/range constraints and update guards | Centralizes integrity for concurrent writers, keeps omitted-column old inserts compatible, and enforces the stronger immutable-from-creation rule. |
| Identity-only storage and relation projection | Keeps one item code across revisions, preserves historical snapshot fields, and avoids duplicating immutable values or adding N+1 queries. |
| Exact legacy replay with optional added wire fields | Respects OP-02 and common API's additive-change rules without mutating stored outcomes or forcing a new API major version. |
| Transactional maintenance migration with deterministic backfill | Handles existing data without guessing production volumes or changing already versioned migrations; preserves UUIDs/history and prevents allocation/backfill collisions. |
| Existing `409 CONFLICT` for exhaustion | Uses the common error registry instead of creating an unregistered public error scheme. No permissions or institutional policies are widened. |

Technical references: PostgreSQL 17 documents [atomic sequence allocation, `setval` and non-transactional consumption](https://www.postgresql.org/docs/17/functions-sequence.html), [BIGINT bounds, NO CYCLE and cache behavior](https://www.postgresql.org/docs/17/sql-createsequence.html), [SQLSTATE `2200H`](https://www.postgresql.org/docs/17/errcodes-appendix.html), and [ALTER TABLE locking](https://www.postgresql.org/docs/17/sql-altertable.html). These explain technical mechanics, not institutional approval. Follow the existing [Git Flow and migration contract](git-flow-and-migrations.md) for delivery and any required migration-impact review.

## Error envelope and statuses

All errors use the shared RFC 9457 `application/problem+json` envelope with `code`, `traceId`, and safe Portuguese messages.

| Status | Code | Cause |
| --- | --- | --- |
| 400 | `INVALID_REQUEST` | Unknown field, malformed JSON/query or missing/invalid idempotency key |
| 401 / 403 | `AUTH_REQUIRED` / `FORBIDDEN` | Missing session / disallowed profile |
| 404 | `RESOURCE_NOT_FOUND` | Missing resource or historical revision |
| 409 | `STALE_VERSION` / `IDEMPOTENCY_CONFLICT` / `CONFLICT` | Concurrent edit / reused key with different content / readable-code sequence exhaustion |
| 422 | `VALIDATION_FAILED` | Invalid name/precision/version/reason/quantity, missing or inactive reference |
| 503 | `SERVICE_UNAVAILABLE` | Translated persistence unavailability |

Field validation codes include `INVALID_LENGTH`, `INVALID_UNIT_PRECISION`, `REFERENCE_NOT_FOUND`, `INVALID_VERSION`, `INVALID_FORMAT`, `CHANGE_REQUIRED`, `INVALID_QUANTITY`, `EXCESS_PRECISION`, `UNIT_MISMATCH`, and `QUANTITY_OVERFLOW`. Existing shared reason-validation codes remain unchanged.

## Verification and remaining acceptance

- Vitest quantity tests exercise exact decimal addition, precision/indivisibility, supported capacity, zero rules and incompatible units.
- HTTP tests exercise catalog/item creation and retrieval, historical corrections, retired references, authorization, validation, replay and conflict responses.
- A native Node TypeScript subprocess verifies catalog loading, protected HTTP access and exact arithmetic outside Vitest's TypeScript transform.
- PostgreSQL integration tests apply the complete migration history to a disposable database and exercise persistence across app instances, constraints, rollback, concurrent retries and stale edits.
- The migration only adds catalog/item/revision tables and constraints. It modifies no existing business table, user profile or audit mechanism. Keep it together with the API/adapters when reviewing the change. Older application code can run with the additional tables; do not drop them as an automatic rollback.
- TG-01-05's actual UI integration and Felipe's independent review remain required for acceptance. There is no frontend integration claim in this implementation candidate.

### Historical local verification evidence (2026-10-25 / 0.1.0)

Executed with Node.js 24.15.0 and npm 12.0.2, within the manifest's engine range. CI uses the repository's pinned Node version. PostgreSQL integration used an isolated PostgreSQL 17.10 container; each suite created, migrated and dropped its own disposable database, with no development database or real data involved.

| Command | Observed result |
| --- | --- |
| `npm test` | 97 tests passed across 10 files |
| `npm run test:integration` with an explicit isolated `TEST_DATABASE_URL` | 14 tests passed across 2 files |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed with no warnings |
| `npm run build` | Prisma generation, server compilation and client build passed |

RED/GREEN cycles were executed for exact quantities, HTTP creation, invalid inputs, historical correction, reference retirement, PostgreSQL persistence/constraints, item retirement, runtime compatibility and numeric transport bounds. Real rollback/concurrency tests additionally verified the reused transactional mechanism. These local results are evidence for review, not an assertion that GitHub CI or the frontend acceptance has run.

The counts above describe the original 0.1.0 tree. They are not claims for the merged branch or the readable-code implementation. Current results belong to the [Milestone 2 evidence](stock-item-catalog-milestone-2-evidence.md).
