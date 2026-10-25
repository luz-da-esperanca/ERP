# Stock Origins Contract (`G-02` / `RF-EST-02` / `TG-01-04`)

- **Status:** Implementation candidate — review pending
- **Version:** 0.1.0
- **Owner:** Samuel (`@Zidan-09`)
- **Reviewers:** Paulo (`@PaulEvezely`)
- **Source:** `G-02`, `C-07`, `TG-01-04`, `RF-EST-02`, `RF-EST-03`, `RF-BAZ-04`, `C-02`, `C-03`
- **Dependencies:** [Common Identifiers](./common-identifiers.md), [Common Errors](./common-errors.md), [Common API Contracts](./common-api-contracts.md), [Access and Session Contract](./access-and-session.md), [Institutes and Projects](./institutes-and-projects.md)
- **Pending institutional decisions:** `LAC-08`, `LAC-09`, `LAC-11` — none of them is resolved by this contract.

## 1. Purpose

Define the server contract for the Stock Origin catalog: the registry that identifies where items entering Social Stock came from. The catalog registers an item donor or campaign without creating financial CRM data, without monetary values, and without treating an internal Bazar transfer as a new external donation.

## 2. Scope and non-goals

**In scope**

- The origin catalog with `id`, `kind`, `name`, and `createdAt`.
- Reading the catalog and creating the three named donation origins.
- Explicit unknown origin and Bazar classification as system-managed records.
- Server-side authorization, authorship, audit, and idempotent creation.

**Out of scope**

- Financial CRM: donor CPF/CNPJ, addresses, contacts, phones, e-mails, giving history.
- Monetary values, estimated values, campaign goals, fundraising totals, cash or commercial inventory (`LAC-09`, `G-R02`).
- Item, lot, receipt, triage, movement, or balance management (`G-01`, `G-06`, `G-07`).
- Bazar transfer recording, unique transfer reference, or quantity reconciliation (`G-09`, `LAC-07`).
- Editing, renaming, deactivating, or deleting origins.
- Bússola import or any fabricated export schema (`C-08`, `LAC-11`).

## 3. Model

### 3.1 Kinds

| `kind` | Meaning | External donation | System-managed | Creatable via API |
| --- | --- | --- | --- | --- |
| `INDIVIDUAL_DONOR` | Donor is an individual person (`doador pessoa física`) | Yes | No | Yes |
| `COMPANY_DONOR` | Donor is a company (`doador empresa`) | Yes | No | Yes |
| `CAMPAIGN` | Items came from a campaign (`campanha`) | Yes | No | Yes |
| `UNKNOWN` | Origin explicitly unknown (`origem desconhecida`) | Yes | Yes | No |
| `BAZAR_TRANSFER` | Internal transfer from the commercial Bazar | **No** | Yes | No |

Derived fields:

- `isExternalDonation`: `true` for every kind except `BAZAR_TRANSFER`.
- `isSystemManaged`: `true` for `UNKNOWN` and `BAZAR_TRANSFER`.

A Bazar transfer is an internal transfer, never a new external donation (`RF-BAZ-04`, `RN-07`, `RN-17`). An unknown origin remains an external donation whose donor was not identified; it is never assigned a presumed value.

### 3.2 System-managed records

Two records exist in every migrated database and in the in-memory test persistence. The API cannot create, update, or delete them.

| Fixed `id` | `kind` | `name` (UI pt-BR) |
| --- | --- | --- |
| `01963000-0000-7000-8000-000000000701` | `UNKNOWN` | `Origem desconhecida` |
| `01963000-0000-7000-8000-000000000702` | `BAZAR_TRANSFER` | `Transferência do Bazar` |

### 3.3 Fields

| Field | Type | Rules |
| --- | --- | --- |
| `id` | UUID | Server-generated UUIDv7 for created records; fixed UUIDs for system records (`VAL`/common identifiers). |
| `kind` | string | One of the five kinds above. |
| `name` | string | Mandatory, trimmed, `1..150` characters. No uniqueness: equal names may represent homonyms or different campaigns (`A-02`, `LAC-09`). |
| `createdAt` | ISO 8601 UTC | Server-assigned creation instant. |

There is no `version`, `updatedAt`, `active`, `value`, `estimatedValue`, `cpf`, `cnpj`, `email`, `phone`, `address`, or `campaignGoal` field. Any request containing them is rejected as an unknown field (`400`).

### 3.4 Response view

```json
{
  "id": "01963000-0000-7000-8000-000000000701",
  "kind": "UNKNOWN",
  "name": "Origem desconhecida",
  "isExternalDonation": true,
  "isSystemManaged": true,
  "createdAt": "2026-10-25T12:00:00.000Z"
}
```

List responses use the shared pagination shape `{ items, page, pageSize, totalItems, totalPages }`.

## 4. Authorization matrix (`RF-ACS-03`, `OP-09`) — provisional while `LAC-08` is pending

| Operation | Allowed profiles |
| --- | --- |
| `GET /api/v1/stock-origins`, `GET /api/v1/stock-origins/:id` | `COORDINATOR`, `SOCIAL_ASSISTANCE`, `STOCK_DISTRIBUTION` |
| `POST /api/v1/stock-origins` | `COORDINATOR`, `STOCK_DISTRIBUTION` |

- Authorization is enforced on the server on every request; interface visibility is not a security boundary (`RF-ACS-03`, `RNF-SEG-04`).
- A user with only `ADMIN`, `BAZAR`, `PERIODIC_ACTIVITY`, or `POINT_IN_TIME_SERVICE` receives `403 FORBIDDEN`. Creating an account never grants implicit social access (`RF-ACS-02`).
- This matrix is a conservative technical restriction recorded while `LAC-08` (LGPD profiles and field-level access matrix) remains `PENDING`. It is not an institutional approval and may not be widened without a recorded decision.

## 5. Endpoints

### 5.1 `GET /api/v1/stock-origins`

Lists origins, including system-managed records.

- **Query parameters:** `kind` (one of the five kinds), `search` (string, at most `150` characters, matched against `name` case-insensitively), `page` (positive integer, default `1`), `pageSize` (`1..100`, default `20`). Unknown or malformed parameters return `400 INVALID_REQUEST`.
- **Ordering:** name, then `id`.
- **Response `200 OK`:**

```json
{
  "items": [],
  "page": 1,
  "pageSize": 20,
  "totalItems": 0,
  "totalPages": 0
}
```

### 5.2 `GET /api/v1/stock-origins/:id`

Fetches one origin by internal ID.

- **Response `200 OK`:** a single `StockOriginView`.
- **Response `404 RESOURCE_NOT_FOUND`:** unknown ID or a non-UUID identifier.

### 5.3 `POST /api/v1/stock-origins`

Creates one donation origin.

- **Headers:** `Idempotency-Key: <UUIDv4|UUIDv7>` (required; `400` when missing or malformed).
- **Request body:**

```json
{
  "kind": "INDIVIDUAL_DONOR",
  "name": "Doador Pessoa Física 001"
}
```

- **Validation (`422 VALIDATION_FAILED`):**
  - `kind` must be `INDIVIDUAL_DONOR`, `COMPANY_DONOR`, or `CAMPAIGN`. `UNKNOWN` and `BAZAR_TRANSFER` are rejected as system-managed; any other value is an invalid enum.
  - `name` must be a string that, after trimming, has `1..150` characters.
- **Response `201 Created`:** the created `StockOriginView`.
- **Unknown or extra body fields return `400 INVALID_REQUEST`**; the server never silently discards them.

## 6. Idempotency, audit, and transaction guarantees (`C-02`, `C-03`, `OP-01`, `OP-02`)

- The creation operation is scoped as `CREATE_STOCK_ORIGIN`, keyed by authenticated actor and `Idempotency-Key`, with the payload `{ kind, name }` normalized before hashing.
- Same key + same normalized content returns the previous result without creating a second record.
- Same key + different content returns `409 IDEMPOTENCY_CONFLICT`.
- The created record, its audit entry, and its operation confirmation are written in one transaction created at the composition boundary. A failure leaves no partial record or history.
- The audit entry uses `entityType: STOCK_ORIGIN`, `action: CREATE`, the authenticated `actorId`, `before: null`, the created `after` snapshot, and the operation ID. The `factDate` defaults to the business date at the server clock; no client-supplied retroactive date is accepted for catalog creation.
- System-managed records are seeded by the migration (or by the in-memory repository) and carry no audit entry, because no authenticated actor creates them.
- Concurrent repeats of one actor/operation/key return exactly one record, one audit entry, and one confirmation.

## 7. Error summary

| Status | Code | Situation |
| --- | --- | --- |
| `400` | `INVALID_REQUEST` | Malformed query, unknown query/body field, missing or malformed `Idempotency-Key`. |
| `401` | `AUTH_REQUIRED` | No valid session token. |
| `403` | `FORBIDDEN` | Authenticated but no allowed profile. |
| `404` | `RESOURCE_NOT_FOUND` | Unknown or non-UUID origin ID. |
| `409` | `IDEMPOTENCY_CONFLICT` | Same key with different payload. |
| `422` | `VALIDATION_FAILED` | Invalid `kind`, system-managed `kind`, or invalid `name`. |

Public responses follow [Common Errors](./common-errors.md): no stack traces, no internal details.

## 8. Explicit prohibitions

- No CRM or financial data of any kind; identifying an item donor must never create financial donor records (`RF-EST-02`, PRD scope).
- No monetary or estimated value is stored or presumed; valuation and per-donor consolidation remain `G-R02` under `LAC-09`.
- No CPF, CNPJ, phone, e-mail, address, contact, or campaign goal field exists in the model, request, response, or audit snapshot.
- No Bazar transfer flow, reference, or quantity is implemented here; only the classification exists (`G-09`, `LAC-07`).
- No edit, delete, or deactivation endpoints.
- No Bússola schema, file format, or migration may be invented while `LAC-11` remains pending (`C-07`, `C-08`).

## 9. Relationship to other artifacts

| Artifact | Relationship |
| --- | --- |
| `G-02` (Gabriel backlog) | This contract implements the origin registration requirement. |
| `G-06` | Future stock entry selects an origin; the ad-hoc unknown option belongs to that flow, not to a new catalog row. |
| `G-09` | Owns the Bazar transfer flow; this contract only reserves the `BAZAR_TRANSFER` classification. |
| `G-R02` | Per-donor consolidation with estimated value stays out of scope and off the deadline. |
| `C-07` / `LAC-11` | Origin and export mapping for the recorte; see [C-07 mapping](../team-docs/gabriel/c-07-bussola-export-mapping.md). |
| `LAC-08` / `LAC-09` | Profile matrix and donor/valuation governance remain pending; nothing here resolves them. |

## 10. References

- [TG-01-04 issue](../team-docs/gabriel/issues/tg-01-04.md)
- [ERS](../ERS%20%E2%80%94%20ERP%20Social%20Luz%20da%20Esperan%C3%A7a.md) — `RF-EST-02`, `RF-EST-03`, `RF-EST-11`, `RF-BAZ-04`
- [PRD](../PRD-ERP-Luz-da-Esperanca-v1.1.md)
- [Glossary](../../GLOSSARY.md) — Stock Origin, Donation Origin, Bazar Transfer
- [Pending institutional decisions](./pending-institutional-decisions.md) — `LAC-08`, `LAC-09`, `LAC-11`
- [ADR-0002](../adr/0002-common-identifiers-and-idempotency-keys.md), [ADR-0005](../adr/0005-sensitive-data-protection-and-server-side-authorization.md)
