# Common Error Contract

- **Status:** Review candidate — pending approval; decisions are proposals
- **Version:** 1.0-rc.1
- **Owner:** Felipe (@FelipeeMartinns) — proposed; the item 4 owner matrix is still pending
- **Reviewers:** Fabricio (@Fabricio-Fontenele), Gabriel (lead) (@Gabriel-afk-9), and Alan (@alanrcastro100) for cross-team alignment
- **Source:** C-01 acceptance criterion 2
**Related requirements:** IU-06, VAL-07, VAL-12, OP-01, OP-02, OP-03, OP-09, RF-ACS-01, RF-MIG-03, RNF-SEG-04

## 1. Purpose

Define one public error format and one translation policy for validation, authentication, authorization, conflict, and persistence failures. Every module must use this contract instead of returning framework, database, or infrastructure errors directly.

The contract protects three concerns:

1. **Interoperability** — clients can handle failures through stable machine-readable codes.
2. **Safety** — public responses never expose stack traces, credentials, restricted data, or internal implementation details.
3. **Actionability** — users and client applications can identify the affected field or operation and the next possible action (IU-06).

## 2. Scope and non-goals

This contract defines the public error envelope, error categories, stable codes, safe message rules, traceability, and the translation of known failures.

The following concerns remain owned by other contracts:

- The transport binding, endpoint shapes, headers, and API versioning remain in C-01 item 3.
- Identifier formats and idempotency scope remain in the common identifiers contract.
- Authentication and authorization rules remain in C-02 and the access-control requirements.
- Audit event content remains in C-03.
- Institutional policy thresholds, including rate-limit values, remain pending under the applicable LAC items. This contract does not invent them.
- Framework-specific serialization and database error classification are implementation details. They must satisfy this contract but are not defined here.

## 3. Public envelope

The proposed public error representation is **RFC 9457 Problem Details** with `Content-Type: application/problem+json`.

```json
{
  "type": "urn:erp:problem:validation",
  "title": "Falha de validação",
  "status": 422,
  "detail": "Um ou mais campos são inválidos.",
  "instance": "/api/v1/example",
  "code": "VALIDATION_FAILED",
  "traceId": "0192f5b6-7c8a-7def-8123-456789abcdef",
  "errors": [
    {
      "field": "cpf",
      "code": "FIELD_INVALID",
      "message": "CPF inválido."
    }
  ]
}
```

### 3.1 Required members

| Member | Type | Rule |
| --- | --- | --- |
| `type` | string | Stable URI reference identifying the problem category |
| `title` | string | Short, stable, human-readable summary in Brazilian Portuguese |
| `status` | integer | HTTP status code, repeated for client convenience |
| `code` | string | Stable machine-readable code in `UPPER_SNAKE_CASE` |
| `traceId` | string | Opaque server-generated correlation identifier |

### 3.2 Optional members

| Member | Type | Rule |
| --- | --- | --- |
| `detail` | string | Safe explanation for the user; no restricted or internal data |
| `instance` | string | Request path without query string; never include credentials or personal data |
| `errors` | array | Field-level failures, used only when applicable |

### 3.3 Field-level failures

Each entry in `errors` contains:

- `field`: path using the public API field name, not a database column;
- `code`: stable machine-readable code for that failure;
- `message`: safe Brazilian Portuguese message with a possible action.

The contract never requires echoing the rejected value. Values are omitted by default to avoid exposing CPF, health data, credentials, or other restricted content. The client preserves valid form data and uses the field path to highlight the problem (IU-06).

### 3.4 Forbidden content

Public responses must never include:

- stack traces, exception class names, or source paths;
- SQL, Prisma, Fastify, or database error text;
- credentials, tokens, cookies, or session identifiers;
- CPF or other restricted personal data not required for the response;
- internal hostnames, connection strings, or environment values;
- unrestricted records, totals, or existence details (RNF-SEG-04).

## 4. Error categories and HTTP mapping

| Category | HTTP status | Top-level code | Use |
| --- | --- | --- | --- |
| Malformed request | 400 | `INVALID_REQUEST` | Invalid JSON, unsupported media type, invalid query syntax |
| Validation failure | 422 | `VALIDATION_FAILED` | Syntactically valid input that violates a field or business invariant |
| Not authenticated | 401 | `AUTH_REQUIRED` | Missing, expired, or invalid session |
| Not authorized | 403 | `FORBIDDEN` | Authenticated actor lacks permission |
| Not found | 404 | `RESOURCE_NOT_FOUND` | Resource does not exist or must not be disclosed |
| Conflict | 409 | `CONFLICT` | Stale version, duplicate, idempotency mismatch, insufficient stock |
| Rate limited | 429 | `RATE_LIMITED` | Configured request limit exceeded |
| Internal failure | 500 | `INTERNAL_ERROR` | Unexpected server failure |
| Unavailable | 503 | `SERVICE_UNAVAILABLE` | Required dependency or maintenance unavailability |

The 400 versus 422 split is provisional. If reviewers choose a single status for validation, the envelope and codes remain unchanged.

## 5. Stable error codes

Codes are ASCII, uppercase, and use `_` as the separator. They are part of the public contract and must not change silently. User-facing messages may be reworded without changing a code.

Proposed baseline codes:

| Code | Category | Meaning |
| --- | --- | --- |
| `INVALID_REQUEST` | 400 | The request cannot be parsed or uses an unsupported form |
| `VALIDATION_FAILED` | 422 | One or more fields or invariants are invalid |
| `FIELD_REQUIRED` | 422 | A required field is absent |
| `FIELD_INVALID` | 422 | A field has an invalid type, format, or value |
| `REFERENCE_NOT_FOUND` | 422 | A referenced record does not exist or is not available |
| `AUTH_REQUIRED` | 401 | A valid authenticated session is required |
| `INVALID_CREDENTIALS` | 401 | Login failed; the same response is used for unknown account and wrong password |
| `FORBIDDEN` | 403 | The actor is not allowed to perform the operation |
| `RESOURCE_NOT_FOUND` | 404 | The resource is absent or must not be disclosed |
| `CONFLICT` | 409 | A generic conflict requiring review |
| `STALE_VERSION` | 409 | The submitted version is no longer current |
| `IDEMPOTENCY_CONFLICT` | 409 | The operation identifier was reused with different content |
| `DUPLICATE_RESOURCE` | 409 | A uniqueness rule was violated |
| `INSUFFICIENT_STOCK` | 409 | The requested quantity exceeds the available stock |
| `RATE_LIMITED` | 429 | The request limit was exceeded |
| `INTERNAL_ERROR` | 500 | An unexpected failure occurred |
| `SERVICE_UNAVAILABLE` | 503 | A required dependency is unavailable |

Item 3 may add endpoint-specific codes, but it must reuse this envelope and naming rule. A central registry must prevent duplicated or conflicting codes.

The S1 access/project field-code registry additionally contains `REQUIRED_FIELD`, `INVALID_FORMAT`, `INVALID_LENGTH`, `INVALID_ENUM`, `DUPLICATE_VALUE`, `INVALID_PERIOD`, and `PROJECT_CLOSED`, all under `422 VALIDATION_FAILED`. They describe field-level failures; they do not replace the top-level error code. `REFERENCE_NOT_FOUND` is reused for unavailable institute references. Public field paths use `loginIdentifier`, even though persistence uses a `login` column.

## 6. Validation failures

- Validation is mandatory on the server and in persistence, not only in the interface (OP-01, VAL-12).
- Multiple independent field failures may be returned in one response.
- The response identifies the affected field and a possible correction without exposing restricted values.
- Invalid optional fields are rejected or explicitly removable; they are never replaced with zero, false, an empty string, or a fictitious value.
- Missing required references are validation failures, not zero identifiers or orphan records.
- Field paths use the public API names. Renaming a database column must not change the public path.
- The order of `errors` is not semantically significant; clients must not depend on it.

## 7. Authentication and authorization failures

- An authentication failure does not reveal whether an account exists (RF-ACS-01).
- Unknown account and wrong password produce the same public response and code.
- A missing or expired session produces `AUTH_REQUIRED`; invalid credentials produce `INVALID_CREDENTIALS`.
- An authenticated actor without permission produces `FORBIDDEN`.
- When confirming existence would disclose a restricted record, the server returns `RESOURCE_NOT_FOUND` instead of revealing the record.
- Error messages and field-level details must not include restricted records, totals, or personal data (RNF-SEG-04).
- Permission is verified again for retries, errors, history, exports, and aggregations (OP-09).

## 8. Conflict and idempotency failures

- Reusing an operation identifier with the same authorized scope and the same normalized content returns the previously stored result; it is not an error.
- Reusing the same identifier with different normalized content returns `409 IDEMPOTENCY_CONFLICT` without overwriting or partially applying the operation.
- Concurrent updates based on an outdated version return `409 STALE_VERSION`; the client may reload and retry.
- Uniqueness violations return `409 DUPLICATE_RESOURCE`. The message must not disclose another person's restricted data.
- Insufficient stock or unavailable lots return `409 INSUFFICIENT_STOCK`. The response must not expose stock from unauthorized scopes.
- A failed composite operation leaves no partial effects (OP-01). Retries use the same operation identifier.

## 9. Persistence failure translation

Persistence exceptions are translated at the infrastructure boundary. Public responses never expose the original exception.

| Persistence condition | Public result |
| --- | --- |
| Unique constraint violation | `409 DUPLICATE_RESOURCE` |
| Missing or unavailable referenced record | `422 REFERENCE_NOT_FOUND` |
| Check constraint or invariant violation | `422 VALIDATION_FAILED` with field details when safe |
| Stale version or optimistic-lock conflict | `409 STALE_VERSION` |
| Serialization failure or deadlock | Bounded retry when the operation is safe and idempotent; otherwise `409 CONFLICT` |
| Connection failure or timeout | `503 SERVICE_UNAVAILABLE` |
| Unexpected persistence failure | `500 INTERNAL_ERROR` |

Rules:

- Do not retry a non-idempotent operation without an operation identifier that makes the retry safe.
- Do not convert a concurrency conflict into a silent last-write-wins update.
- Do not convert a missing reference into a zero, empty, or fictitious record.
- Do not return database-provided messages, constraint names, or query fragments.

## 10. Safe messages and localization

- `title`, `detail`, and `message` are written in Brazilian Portuguese (IU-01).
- `type` and `code` are stable English technical identifiers.
- Clients use `code` for behavior and may display `message`; they must not parse message text.
- Messages identify the field or operation and a possible action (IU-06).
- A communication failure is never presented as a successful confirmation and must not encourage creating a second operation.
- Message text must not include CPF, credentials, restricted health or religion data, or other personal content not needed for the response.

## 11. Traceability and logging

- The server generates `traceId` for every error response.
- `traceId` is opaque and safe to display to support staff.
- Server logs preserve the technical cause with the same `traceId`, including stack traces where appropriate.
- Logs must redact credentials, tokens, CPF, and restricted personal data.
- The public response includes only the safe summary and the correlation identifier, never the internal cause.
- Audit events remain distinct from technical logs and follow C-03.

## 12. Client behavior

- On `401`, require re-authentication.
- On `403`, do not retry automatically.
- On `409 STALE_VERSION`, offer reload and explicit reapplication.
- On `409 IDEMPOTENCY_CONFLICT`, require a new logical operation; never reuse the identifier with different content.
- On `429`, honor `Retry-After` when provided.
- On `503`, retry with bounded backoff only when the operation is safe.
- On network failure after sending a confirmation, retry with the same operation identifier and do not create a second operation.
- Preserve valid form data after validation or conflict failures (IU-06).

## 13. Decisions proposed for review

| ID | Decision | Status | Rationale |
| --- | --- | --- | --- |
| E1 | Use RFC 9457 Problem Details | Proposed — pending approval | Standard envelope with extensible members |
| E2 | Use `urn:erp:problem:*` for `type` | Proposed — pending approval | Stable category identifier without inventing a public URL |
| E3 | Use 422 for semantic validation and 400 for malformed requests | Proposed — pending approval | Separates syntax failures from invariant failures |
| E4 | Use stable `UPPER_SNAKE_CASE` codes | Proposed — pending approval | Machine-readable and language-independent |
| E5 | Omit rejected values from public errors | Proposed — pending approval | Avoids exposing restricted data |
| E6 | Return a server-generated `traceId` | Proposed — pending approval | Correlates the public error with protected logs |
| E7 | Translate known persistence failures at the infrastructure boundary | Required | Prevents leaking framework and database details |
| E8 | Keep messages in pt-BR and codes in English | Required | IU-01 and the repository language rule |

These are review proposals, not approvals. They must not be cited as reviewer agreement.

## 14. Pending approvals

| Approver | Pending item | Evidence required |
| --- | --- | --- |
| Alan | Cross-team alignment of the envelope and code registry | Written confirmation or review comment |
| Fabricio | Technical review of the contract | Recorded review |
| Gabriel (lead) | Technical review and owner confirmation | Recorded review |

This section records the absence of approval. Drafting may continue, but C-01 cannot be declared closed until the reviews are recorded.

## 15. Open points requiring agreement

Recommended positions for the C-01 base review:

1. **Envelope choice.** Recommend RFC 9457 Problem Details. Alternative: smaller custom envelope if reviewers prefer less indirection. Owner: Alan and the reviewers.
2. **Validation status.** Recommend 422 for semantic validation, 400 for malformed requests. Owner: Alan and the reviewers.
3. **Operation identifier transport.** Recommend defining in C-01 item 3; prefer `Idempotency-Key` if no existing convention blocks it. Owner: Felipe, with Alan and reviewers.
4. **Code registry location.** Recommend a single source of truth: a documented central list (this contract + an exported registry when implementation starts), not duplicated per endpoint. Owner: Alan and reviewers.
5. **Rate-limit policy.** Values and windows remain pending under LAC-10; only error behavior is defined here. Owner: Alan, with LAC-10.
6. **Retry policy.** Recommend bounded retry only for safe, idempotent operations; never auto-retry non-idempotent operations without an operation identifier. Owner: Alan and reviewers.
7. **Disclosure policy.** Recommend returning 404 when existence would disclose a restricted resource; use 403 when existence is known and permission is denied. Owner: Alan and reviewers.
8. **Validation replay.** Recommend replaying only persisted outcomes; re-evaluate pre-persistence validation. Owner: Alan and reviewers.
9. **Trace format.** Recommend opaque UUIDv7 for `traceId`; align with logging/observability. Owner: Alan and reviewers.
10. **Owner matrix.** Recommend approving the item 4 owner matrix in the identifiers contract.

## 16. Acceptance checklist for item 2

- [ ] The envelope is published in the repository with an identifiable location.
- [ ] Validation, authentication, authorization, conflict, and persistence failures are covered.
- [ ] No public response exposes stack traces, credentials, or internal details.
- [ ] Public codes are stable, documented, and centrally registered.
- [ ] Messages identify the field or operation and a possible action (IU-06).
- [ ] Error content respects authorization and restricted data rules (RNF-SEG-04).
- [ ] Persistence failures are translated at the infrastructure boundary.
- [ ] The contract is aligned with C-01 item 3 and the identifiers contract.
- [ ] Reviewed by Fabricio and Gabriel (lead).
- [ ] Cross-team alignment recorded with Alan.

## 17. Change control

- This document is versioned with the repository.
- Editorial changes may be made through the normal review flow.
- Removing or renaming a published code requires a compatibility review and an ADR when clients depend on it.
- The contract does not approve institutional decisions. Pending LAC items remain pending.

## 18. References

- `docs/team-docs/gabriel/issues/c-01.md`
- `docs/contracts/common-identifiers.md`
- `docs/ERS — ERP Social Luz da Esperança.md`: sections 3.4.1 and 3.4.2; IU-06, VAL-07, VAL-12, OP-01, OP-02, OP-03, OP-09, RF-ACS-01, RF-MIG-03, RNF-SEG-04
- `docs/agents/domain.md`
- `AGENTS.md`
