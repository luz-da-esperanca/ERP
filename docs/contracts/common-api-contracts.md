# Common API Contracts

- **Status:** Review candidate — pending approval; decisions are proposals
- **Version:** 1.0-rc.1
- **Owner:** Felipe (@FelipeeMartinns) — proposed; part of item 4 owner matrix
- **Reviewers:** Fabricio (@Fabricio-Fontenele), Gabriel (lead) (@Gabriel-afk-9), and Alan (@alanrcastro100) for cross-team alignment
- **Source:** C-01 acceptance criterion 3
- **Related requirements:** IU-01, IU-06, OP-01, OP-02, OP-03, OP-09, RF-ACS-01, VAL-12
- **Dependencies:** [Common Identifiers](./common-identifiers.md), [Common Errors](./common-errors.md)

## 1. Purpose

Define common API conventions for all modules: versioning, transport, authentication/authorization, inputs/outputs, error handling, idempotency, concurrency, pagination, filtering, and observability. All services must follow these conventions.

## 2. Scope and non-goals

Covers common technical contracts. Does not define endpoint-specific schemas, business rules, or UI-specific details. Those belong in module-specific contracts.

## 3. General conventions

- **Protocol:** HTTP/1.1 or HTTP/2 over TLS in all environments
- **Format:** JSON only (`Content-Type: application/json`; accept `application/json`)
- **Encoding:** UTF-8
- **Language/locale:** API errors in pt-BR as per [Common Errors](./common-errors.md); field names in English
- **Dates/times:** ISO 8601 in UTC (`YYYY-MM-DDTHH:mm:ss.sssZ`) for instants; `YYYY-MM-DD` for calendar dates
- **Numbers:** JSON numbers; integers for counts, decimals as strings when precision matters or standard JSON numbers with documented precision
- **IDs:** Use internal entity IDs as per [Common Identifiers](./common-identifiers.md)
- **Nulls:** Omit optional fields when absent; never use `null` to mean "unknown" unless explicitly documented

## 4. Versioning

- **Versioning strategy:** URI versioning
- **Base path:** `/api/v1/`
- **Breaking changes:** Require new major version (`/api/v2/`)
- **Deprecation:** Deprecated endpoints must be documented with sunset date and migration path
- **Non-breaking:** Additive changes (new optional fields, new endpoints) allowed in same version

## 5. Authentication and authorization

- **Authentication:** Session-based or token-based as defined by C-02. All protected endpoints require authentication.
- **Authorization:** Enforced server-side on every request (OP-09). Interface visibility is not a security boundary.
- **Sessions:** Follow C-02 rules; session expiration and logout apply to all protected endpoints
- **Anti-enumeration:** Error responses must not reveal account existence or resource existence when restricted (see [Common Errors](./common-errors.md))
- **Audit:** Sensitive operations logged per C-03

## 6. Request/response patterns

### 6.1 Standard headers
| Header | Required | Notes |
| --- | --- | --- |
| `Authorization` / session cookie | Per C-02 | For protected endpoints |
| `Idempotency-Key` | For non-idempotent operations creating facts/movements | As per [Common Identifiers](./common-identifiers.md) operation ID rules; transport binding defined here provisionally |
| `If-Match` / version header | For updates with optimistic concurrency | When applicable |

### 6.2 Idempotency
- Operations that create facts or movements must support idempotency via `Idempotency-Key` (UUID as per common identifiers)
- Same key + same scope + same normalized content → return previous result
- Same key + different content → `409 IDEMPOTENCY_CONFLICT`
- Keys are scoped to authenticated actor and operation type
- Transport binding (header vs body) is provisional; header `Idempotency-Key` recommended

### 6.3 Optimistic concurrency
- Resources with mutable state and concurrent updates must support versioning (e.g., `version` field or `ETag`/`If-Match`)
- Stale version → `409 STALE_VERSION` with option to reload
- Server assigns versions; clients must send known version on updates

### 6.4 Pagination
- List endpoints must support pagination
- Recommended: cursor-based or offset-based; if offset, must include total only when cheap/safe
- Standard params: `limit` (default/max defined), `cursor` or `offset`
- Response includes pagination metadata (e.g., `hasMore`, `nextCursor`, `total` when provided)

### 6.5 Filtering and sorting
- Filtering by explicit allowed fields only
- Sorting by explicit allowed fields only
- All filters respect authorization (no leakage across scopes)

## 7. Error handling

All errors follow [Common Errors](./common-errors.md). Use appropriate status codes and stable error codes. Never expose stack traces or internal details.

## 8. Representative endpoints (common patterns)

These are patterns, not exhaustive. Module contracts define specific endpoints.

| Pattern | Method | Path | Notes |
| --- | --- | --- | --- |
| Health check | GET | `/api/v1/health` | Unauthenticated or minimally protected; returns service status |
| Resource list | GET | `/api/v1/{resource}` | Paginated, filterable, sorted |
| Resource get | GET | `/api/v1/{resource}/{id}` | By internal ID |
| Resource create | POST | `/api/v1/{resource}` | Requires idempotency if creates facts/movements |
| Resource update | PUT/PATCH | `/api/v1/{resource}/{id}` | Optimistic concurrency recommended |
| Resource delete/cancel | DELETE/POST | `/api/v1/{resource}/{id}/cancel` | Prefer soft delete/cancel with reason; follow business rules |

## 9. Decisions proposed for review

| ID | Decision | Status | Rationale |
| --- | --- | --- | --- |
| A1 | URI versioning with `/api/v1/` | Proposed — pending approval | Simple, cacheable, explicit |
| A2 | JSON over HTTP(S) with UTC ISO 8601 | Proposed — pending approval | Standard and unambiguous |
| A3 | `Idempotency-Key` header for operations creating facts/movements | Proposed — pending approval | Aligns with common identifiers |
| A4 | Optimistic concurrency for mutable resources | Proposed — pending approval | Prevents lost updates |
| A5 | Cursor/offset pagination with allowlists for filters/sorts | Proposed — pending approval | Prevents abuse and over-fetching |
| A6 | Reuse common errors and identifiers | Required | Consistency across modules |

These are review proposals, not approvals.

## 10. Pending approvals

| Approver | Pending item | Evidence required |
| --- | --- | --- |
| Alan | Cross-team alignment of conventions | Written confirmation or review comment |
| Fabricio | Technical review of the contract | Recorded review |
| Gabriel (lead) | Technical review and owner confirmation | Recorded review |

## 11. Open points requiring agreement

Recommended positions for review:

1. **Versioning strategy.** Recommend URI versioning (`/api/v1/`). Alternative: header versioning. Owner: Alan and reviewers.
2. **Idempotency transport.** Recommend `Idempotency-Key` header; confirm no conflict with existing clients. Owner: Felipe, with Alan and reviewers.
3. **Pagination default/max.** Recommend sensible defaults with explicit max; values may need tuning. Owner: Alan and reviewers.
4. **OpenAPI adoption.** Recommend adopting OpenAPI 3.1 for machine-readable contracts; generate from source or maintain in sync. Owner: Alan and reviewers.
5. **Rate limiting.** Behavior defined in errors; limits pending LAC-10. Owner: Alan, with LAC-10.

## 12. Acceptance checklist for item 3

- [ ] Common API conventions published with identifiable location
- [ ] Versioning, auth, errors, ids, idempotency, concurrency defined
- [ ] Pagination/filtering/sorting conventions defined
- [ ] Representative patterns documented
- [ ] Aligned with identifiers and errors contracts
- [ ] Reviewed by Fabricio and Gabriel (lead)
- [ ] Cross-team alignment recorded with Alan

## 13. Change control

- Versioned with repository; editorial changes via normal review
- Breaking changes require major version and migration notes
- Contract does not approve institutional decisions; LAC items remain pending

## 14. References

- [C-01 Issue](../team-docs/gabriel/issues/c-01.md)
- [Common Identifiers](./common-identifiers.md)
- [Common Errors](./common-errors.md)
- [ERS](../ERS%20%E2%80%94%20ERP%20Social%20Luz%20da%20Esperan%C3%A7a.md)
- [AGENTS.md](../../AGENTS.md)
