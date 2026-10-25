# Stock Item Catalog (`TG-01-02` / `G-01`)

- **Status:** Implementation candidate; Felipe's review and integrated UI acceptance pending.
- **Owner:** Erick (`@Erick-VP`). **Reviewer:** Felipe (`@FelipeeMartinns`).
- **Version:** 0.1.0.
- **Requirements:** RF-EST-01, RF-EST-08, VAL-05, VAL-06, OP-01, OP-02, OP-03, OP-05, AC-40, AC-50, AC-52.
- **Dependencies:** [common API](common-api-contracts.md), [identifiers](common-identifiers.md), [errors](common-errors.md), [access](access-and-session.md), and C-03's shared transaction/audit/idempotency ports.

## Boundaries and authorization

This API owns items, categories, units, and size/numbering options. It does not create donation origins, receipts, lots, stock movements, conversions, deliveries, financial records, or frontend screens. No donor or campaign is required to create an item. G-06 later combines items and origins for receipts; TG-01-05 consumes this API for the catalog interface.

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

Responses contain `id`, `name`, `precision`, `isActive`, `version`, `createdAt`, and `updatedAt`. `precision` is an integer for units and `null` for categories/sizes. Names are trimmed, non-empty strings with at most 150 characters. Equal names do not imply equal identities; no unapproved uniqueness rule is imposed.

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
  "revisionId": "01963000-0000-7000-8000-000000000305",
  "version": 1,
  "name": "Synthetic shoe",
  "category": { "id": "01963000-0000-7000-8000-000000000301", "name": "Synthetic footwear" },
  "unit": { "id": "01963000-0000-7000-8000-000000000302", "name": "Synthetic pair", "precision": 0 },
  "size": { "id": "01963000-0000-7000-8000-000000000303", "name": "Synthetic BR 39" },
  "isActive": true,
  "createdAt": "2026-10-25T15:00:00.000Z",
  "updatedAt": "2026-10-25T15:00:00.000Z"
}
```

- `GET /api/v1/stock-items`: current item representations, ordered by item ID, including inactive items.
- `GET /api/v1/stock-items/:id`: current representation.
- `GET /api/v1/stock-items/:id/revisions/:version`: the exact historical representation, including its original revision ID, names, unit, precision, and size. Missing/malformed resource or revision identifiers return `404`.

All list endpoints accept only `page` and `pageSize`, using the shared defaults `1`/`20` and maximum `100`. Responses are `{ items, page, pageSize, totalItems, totalPages }`; persistence applies the bounds. Unsupported, repeated, or malformed query parameters return `400 INVALID_REQUEST`. Offsets above the supported signed 32-bit integer capacity are also rejected before persistence; out-of-capacity revision numbers return `404`.

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

All errors use the shared RFC 9457 `application/problem+json` envelope with `code`, `traceId`, and safe Portuguese messages.

| Status | Code | Cause |
| --- | --- | --- |
| 400 | `INVALID_REQUEST` | Unknown field, malformed JSON/query or missing/invalid idempotency key |
| 401 / 403 | `AUTH_REQUIRED` / `FORBIDDEN` | Missing session / disallowed profile |
| 404 | `RESOURCE_NOT_FOUND` | Missing resource or historical revision |
| 409 | `STALE_VERSION` / `IDEMPOTENCY_CONFLICT` | Concurrent edit / reused key with different content |
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

### Local verification evidence (2026-10-25)

Executed with Node.js 24.15.0 and npm 12.0.2, within the manifest's engine range. CI uses the repository's pinned Node version. PostgreSQL integration used an isolated PostgreSQL 17.10 container; each suite created, migrated and dropped its own disposable database, with no development database or real data involved.

| Command | Observed result |
| --- | --- |
| `npm test` | 97 tests passed across 10 files |
| `npm run test:integration` with an explicit isolated `TEST_DATABASE_URL` | 14 tests passed across 2 files |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed with no warnings |
| `npm run build` | Prisma generation, server compilation and client build passed |

RED/GREEN cycles were executed for exact quantities, HTTP creation, invalid inputs, historical correction, reference retirement, PostgreSQL persistence/constraints, item retirement, runtime compatibility and numeric transport bounds. Real rollback/concurrency tests additionally verified the reused transactional mechanism. These local results are evidence for review, not an assertion that GitHub CI or the frontend acceptance has run.
