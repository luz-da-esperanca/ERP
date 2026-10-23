---
status: proposed
---

# 0003. RFC 9457 Problem Details Error Contract and Infrastructure Boundary Translation

All HTTP API error responses use RFC 9457 Problem Details (`Content-Type: application/problem+json`) with stable English `UPPER_SNAKE_CASE` machine codes, an opaque server-generated `traceId`, and safe Brazilian Portuguese user messages (`IU-01`, `IU-06`), translating all validation, authorization, conflict, and Prisma/PostgreSQL persistence failures at the infrastructure boundary (`docs/contracts/common-errors.md`).

## Context and Trade-offs

Operators need actionable Portuguese messages that preserve valid form data and explain what to do next (`IU-06`), while security and privacy constraints (`RNF-SEG-04`, `RF-ACS-01`, `OP-09`) strictly forbid leaking stack traces, SQL/Prisma constraint names, account existence on login failure, or restricted personal/family data (such as another person's CPF on uniqueness conflicts).

## Considered Options

- **RFC 9457 Problem Details with central error code registry and boundary translation (chosen):** Standard extensible JSON envelope (`type`, `title`, `status`, `code`, `traceId`, optional `detail`, `instance`, `errors[]`) where rejected field values are omitted by default.
- **Framework-default Fastify/Prisma error payloads:** Rejected because default exceptions leak internal schema/constraint details and lack stable domain error codes.
- **Echoing rejected input values in validation/conflict errors:** Rejected because echoing a rejected CPF or restricted field risks exposing sensitive personal data in logs, shared screens, or error payloads (`RNF-SEG-04`).

## Consequences

- Persistence adapters must catch and translate database constraint violations (`409 DUPLICATE_RESOURCE`, `422 REFERENCE_NOT_FOUND`, `409 STALE_VERSION`, `503 SERVICE_UNAVAILABLE`) before errors reach transport handlers.
- Unknown account and wrong password both return `401 INVALID_CREDENTIALS`; unauthorized access to restricted resources whose existence must not be disclosed returns `404 RESOURCE_NOT_FOUND`.
- Pending ratification by Fabricio (`@Fabricio-Fontenele`) and Gabriel (lead) (`@Gabriel-afk-9`) under `C-01`.

