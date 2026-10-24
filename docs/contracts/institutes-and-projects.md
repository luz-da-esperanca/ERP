# Institutes and Projects Contract (`PB-12` / `RF-ATV-01` / `RF-ATV-02` / `TF-01-04`)

- **Status:** Review candidate — pending approval
- **Version:** 1.0-rc.1
- **Owner:** Alan (`@alanrcastro100`)
- **Reviewers:** Fabricio (`@Fabricio-Fontenele`) and Kauã (`@Kaua-cel`)
- **Source:** `PB-12`, `TF-01-04`, `RF-ATV-01`, `RF-ATV-02`, `RF-ATV-08`, `LAC-04`, `AC-58`
- **Dependencies:** [Common Identifiers](./common-identifiers.md), [Common Errors](./common-errors.md), [Common API Contracts](./common-api-contracts.md), [Access and Session Contract](./access-and-session.md)

## 1. Purpose

Define the server contract for maintaining the canonical list of Institutes (`RF-ATV-01`) and managing Projects with name, description, validity period, status, historical context preservation, and optional non-exclusive Institute associations while `LAC-04` remains pending (`RF-ATV-02`, `AC-58`).

## 2. Domain Rules and `LAC-04` Pending State

### 2.1 Canonical Institutes (`RF-ATV-01`)

The system maintains the six institutional Institutes identified in the requirements:

| Code | Name (`pt-BR`) |
| --- | --- |
| `CRIANCA` | Criança |
| `JOVEM` | Jovem |
| `ESCLARECIMENTO_E_FAMILIA` | Esclarecimento e Família |
| `CARIDADE` | Caridade |
| `DIVULGACAO` | Divulgação |
| `MEDIUNIDADE` | Mediunidade |

### 2.2 Projects and Validity Periods (`RF-ATV-02`, `VAL-01`..`VAL-04`, `VAL-07`, `VAL-12`)

- **Identifier:** Server-generated UUIDv7 (`id`).
- **Name (`VAL-01`, `VAL-12`):** Mandatory, trimmed, non-empty string (`3..150` chars).
- **Description (`VAL-01`, `VAL-12`):** Optional trimmed string (`1..1000` chars); empty string is normalized to absent/omitted.
- **Validity period (`VAL-03`, `VAL-04`):**
  - `startDate` (`YYYY-MM-DD`): Mandatory valid calendar date (inclusive start).
  - `endDate` (`YYYY-MM-DD`, optional): Valid calendar date (exclusive end) strictly greater than `startDate` (`endDate > startDate`).
- **Status (`RF-ATV-02`, `RF-ATV-08`):** `PLANNED` (`Planejado`), `ACTIVE` (`Ativo`), or `CLOSED` (`Encerrado`).
- **Institute association while `LAC-04` is pending (`RF-ATV-02`, `AC-58`):**
  - `instituteIds` is an optional array of distinct Institute UUIDs (`0..N`).
  - **No Institute is required** to create or update a Project (`instituteIds: []` or omitted is valid).
  - **No exclusive single-institute constraint is imposed** (`0`, `1`, or multiple Institutes may be linked).
  - Any supplied `instituteId` must reference an existing Institute (`422 VALIDATION_FAILED` with field code `REFERENCE_NOT_FOUND` otherwise, `VAL-07`).
  - Duplicate IDs in `instituteIds` are rejected (`VAL-12`).
- **Historical preservation and concurrency (`RF-ATV-02`, `RF-ATV-08`, `OP-03`, `OP-04`, `RF-ACS-04`, `RF-ACS-05`):**
  - Updates require the known `version` (`409 STALE_VERSION` on mismatch).
  - Closing or modifying a Project never deletes the Project or alters the historical context of activities and facts already recorded under it.
  - Updating or closing a Project records an audit entry with the authenticated `actorId`, `factDate` (when provided for retroactive/effective date, validated via `VAL-03`), server `recordedAt`, `before`/`after` snapshots, and `reason` (mandatory when closing or correcting).

## 3. Authorization Matrix (`RF-ACS-03`, `OP-09`)

| Operation | Allowed Profiles |
| --- | --- |
| `GET /api/v1/institutes` | `COORDINATOR`, `SOCIAL_ASSISTANCE`, `PERIODIC_ACTIVITY`, `POINT_IN_TIME_SERVICE`, `STOCK_DISTRIBUTION` |
| `GET /api/v1/projects`, `GET /api/v1/projects/:id` | `COORDINATOR`, `SOCIAL_ASSISTANCE`, `PERIODIC_ACTIVITY`, `POINT_IN_TIME_SERVICE`, `STOCK_DISTRIBUTION` |
| `POST /api/v1/projects` | `COORDINATOR` |
| `PATCH /api/v1/projects/:id` | `COORDINATOR` |
| `POST /api/v1/projects/:id/close` | `COORDINATOR` |

Note: A user with only the `ADMIN` or `BAZAR` profile receives `403 FORBIDDEN` on institute/project endpoints (`RF-ACS-02`, `RF-ACS-03`, `AC-52`).

## 4. Endpoints

### 4.1 `GET /api/v1/institutes`

Lists the canonical Institutes.

- **Response `200 OK`:**
  ```json
  {
    "items": [
      {
        "id": "0192f5b6-0000-7000-8000-000000000001",
        "code": "CRIANCA",
        "name": "Criança"
      }
    ]
  }
  ```

### 4.2 `POST /api/v1/projects`

Creates a new Project. Requires `Idempotency-Key` (`OP-02`) and records creation in the audit trail (`RF-ACS-04`, `RF-ACS-05`).

- **Headers:** `Idempotency-Key: <UUIDv4|UUIDv7>` (required).
- **Request body:**
  ```json
  {
    "name": "Oficinas de Convivência Familiar",
    "description": "Atividades educativas e de fortalecimento de vínculos.",
    "startDate": "2026-10-01",
    "endDate": "2027-04-01",
    "status": "ACTIVE",
    "instituteIds": [],
    "factDate": "2026-10-01"
  }
  ```
- **Response `201 Created`:**
  ```json
  {
    "id": "0192f5b6-7c8a-7def-8123-456789abcdef",
    "name": "Oficinas de Convivência Familiar",
    "description": "Atividades educativas e de fortalecimento de vínculos.",
    "startDate": "2026-10-01",
    "endDate": "2027-04-01",
    "status": "ACTIVE",
    "institutes": [],
    "version": 1,
    "createdAt": "2026-10-23T14:00:00.000Z",
    "updatedAt": "2026-10-23T14:00:00.000Z",
    "closedAt": null
  }
  ```

### 4.3 `GET /api/v1/projects` and `GET /api/v1/projects/:id`

Lists or fetches Projects with optional filtering by `status` (`PLANNED`, `ACTIVE`, `CLOSED`), a valid UUID `instituteId`, and `search` (up to `150` characters). Lists accept `page` (positive integer, default `1`) and `pageSize` (`1..100`, default `20`) and return `items`, `page`, `pageSize`, `totalItems`, and `totalPages`. Persistence applies the bounds and orders by name, then ID. Unknown or malformed query parameters return `400 INVALID_REQUEST`.

### 4.4 `PATCH /api/v1/projects/:id`

Updates a Project's name, description, validity period, status, or Institute associations with optimistic concurrency (`version`) and mandatory `reason` (`VAL-10`, `RF-ACS-04`).

- **Headers:** `Idempotency-Key: <UUIDv4|UUIDv7>` (required).
- **Request body:**
  ```json
  {
    "name": "Oficinas de Convivência e Cidadania",
    "endDate": "2027-07-01",
    "instituteIds": ["0192f5b6-0000-7000-8000-000000000003"],
    "reason": "Vinculação ao Instituto Esclarecimento e Família e prorrogação de vigência",
    "factDate": "2026-10-23",
    "version": 1
  }
  ```
- **Response `200 OK`:** Updated Project with `version: 2`.

### 4.5 `POST /api/v1/projects/:id/close`

Closes a Project while preserving its record and historical context (`RF-ATV-08`).

- **Headers:** `Idempotency-Key: <UUIDv4|UUIDv7>` (required).
- **Request body:**
  ```json
  {
    "endDate": "2026-10-23",
    "reason": "Encerramento do ciclo semestral do projeto",
    "factDate": "2026-10-23",
    "version": 2
  }
  ```
- **Response `200 OK`:** Updated Project with `status: "CLOSED"` and `version: 3`.


## 5. Input and transaction guarantees

- The `3..150` project-name and `1000` description bounds match validation and the persistence schema. Omitted description/end date are represented by `null`; an open project has `closedAt: null`.
- Write bodies reject extra fields and client-supplied entity IDs. A supplied `factDate` must be a valid string date; reasons are non-empty and at most `1000` characters.
- A protected mutation, its audit entry, and its idempotency confirmation share the transaction created at composition. Failure leaves no partial project or history. Concurrent repeats of one actor/operation/key return one result.
- The audit trail owns authenticated authorship and before/after context; project responses do not add an undocumented `createdByUserId`. C-03 ownership remains with Felipe; this integration does not constitute independent review or institutional approval.
