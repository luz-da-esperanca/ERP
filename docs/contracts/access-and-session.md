# Access, Authentication, Session, and Server-Side Authorization Contract (`C-02` / `TF-01-04` / `TF-01-05`)

- **Status:** Implementation candidate — independent approval pending
- **Version:** 1.0-rc.1
- **Owner:** Alan (`@alanrcastro100`, server-side auth, profiles, and user lifecycle) with Kauã (`@Kaua-cel`, client-side login, session handling, and protected navigation)
- **Reviewers:** Fabricio (`@Fabricio-Fontenele`) and Gabriel (lead) (`@Gabriel-afk-9`)
- **Source:** `C-02`, `TF-01-04`, `TF-01-05`
- **Related requirements:** `RF-ACS-01`, `RF-ACS-02`, `RF-ACS-03`, `RF-ACS-04`, `RF-ACS-05`, `RF-ACS-06`, `RNF-SEG-01`, `RNF-SEG-02`, `RNF-SEG-03`, `RNF-SEG-04`, `VAL-10`, `VAL-11`, `VAL-12`, `OP-01`, `OP-02`, `OP-03`, `OP-09`, `AC-09`, `AC-52`, `AC-53`, `LAC-08`, `LAC-10`
- **Dependencies:** [Common Identifiers](./common-identifiers.md), [Common Errors](./common-errors.md), [Common API Contracts](./common-api-contracts.md)

## 1. Purpose

Define the shared server-side authentication, session management, user lifecycle, profile assignment, and server-side authorization contract consumed by the React client (`TF-01-05`) and enforced across all backend modules (`CAD`, `FIC`, `ATV`, `FRQ`, `APT`, `ATD`, `EST`, `ENT`, `BAZ`, `REL`, `ACS`, `MIG`).

## 2. User Profiles (`ERS §2.3` / `RF-ACS-02` / `LAC-08`)

Every authenticated user (`Operator`) has one or more explicit profiles, as required by the current general backlog, assigned by an authorized administrator (`RF-ACS-02`). Creating an account grants **no** implicit social or operational privileges.

| Profile Code | Institutional Role (`ERS §2.3`) | Permitted Operational Scope in S1 |
| --- | --- | --- |
| `COORDINATOR` | Coordenação | Full operational governance; configures and manages institutes, projects, activities, and eligibility policies; views consolidated reports. |
| `SOCIAL_ASSISTANCE` | Assistência social | Registers families, persons, family links, social assessment records, and home visits. |
| `PERIODIC_ACTIVITY` | Responsável por atividade periódica | Reads periodic activities/projects, manages participants, and records meetings and roll call (`RF-ACS-03`, `AC-09`: sees only name, family, and attendance marks—never the social assessment record). |
| `POINT_IN_TIME_SERVICE` | Responsável por atendimento pontual | Registers point-in-time attendances and minimum registrations; sees only data necessary for the service. |
| `STOCK_DISTRIBUTION` | Estoque e distribuição | Manages item catalogs, donation origins, stock entries/triage, lots, and deliveries. |
| `BAZAR` | Responsável pelo Bazar | Records and reconciles Bazar transfers (`G-09`). |
| `ADMIN` | Administrador | Creates users, assigns/revokes profiles, and deactivates users (`RF-ACS-02`, `RF-ACS-06`). **Does not** grant access to social records, family registrations, or operational data unless combined with another explicit profile (`ERS §2.3`, `LAC-08`). |

> **Pending institutional validation (`LAC-08`):** The exact field-level access matrix for real personal data remains pending under `LAC-08`. Until `LAC-08` and `LAC-05` are approved, sensitive health/religion fields remain disabled everywhere ([ADR-0005](../adr/0005-sensitive-data-protection-and-server-side-authorization.md)) and only synthetic data may be used.

## 3. Credentials, Login Normalization, and Password Security

- **Login identifier (`VAL-11`, `VAL-12`):**
  - Trimmed of leading/trailing whitespace and compared case-insensitively (`normalizedLogin = loginIdentifier.trim().toLowerCase()`).
  - Length: `3..120` characters after trimming; empty or whitespace-only values are rejected with `422 VALIDATION_FAILED` (field codes such as `REQUIRED_FIELD`, `INVALID_FORMAT`, or `INVALID_LENGTH`).
  - Uniqueness is enforced on `normalizedLogin` both in the application and via a PostgreSQL unique constraint (`OP-01`, `AC-53`).
- **Password (`VAL-11`, `RNF-SEG-01`):**
  - Never truncated or whitespace-normalized silently.
  - Minimum length: `8` characters, maximum `128` characters (`VAL-12`).
  - Stored exclusively as a salted cryptographic password hash (`scrypt`, `N=16384`, `r=8`, `p=5`, random 16-byte salt, 64-byte key, explicit stored parameters, and constant-time comparison). Existing three-part hashes remain verifiable. See the proposed implementation note in [ADR-0005](../adr/0005-sensitive-data-protection-and-server-side-authorization.md). Plaintext passwords and password hashes are never returned in API responses, error payloads, or audit records. The session token is returned only by successful login, as specified below, and is excluded from audit records and errors.
- **Anti-enumeration (`RF-ACS-01`):**
  - Unknown login identifier, wrong password, and deactivated account during login all return the exact same public error: `401 INVALID_CREDENTIALS` (`Credenciais inválidas.`).
- **Repeated failed login protection (`RNF-SEG-02`, `LAC-10`):**
  - Enforced server-side per normalized login identifier. Counting and lock transitions are serialized in the same transaction; successful login clears failures, and an expired lock starts a new consecutive-failure cycle. The counting window is this consecutive-failure cycle; institutional security parameters remain pending before the pilot.
  - Configurable via environment (`AUTH_MAX_FAILED_ATTEMPTS`, default proposed `5`; `AUTH_LOCKOUT_DURATION_SECONDS`, default proposed `900` / 15 minutes). These numeric values are configurable proposals under `LAC-10`, not hardcoded institutional policy.
  - When locked, login returns `429 RATE_LIMITED` with `Retry-After` header in seconds.

## 4. Session Lifecycle and Transport (`RNF-SEG-03`, `RF-ACS-06`, `OP-09`)

- **Session token transport:**
  - On successful login, the server issues an opaque high-entropy session token (`256-bit` random token, stored hashed with SHA-256 on the server) via:
    1. An `HttpOnly; SameSite=Lax; Path=/` cookie (`erp_session`, always adding `Secure` when `NODE_ENV=production`; use `AUTH_COOKIE_SECURE=true` for other shared HTTPS environments); and
    2. The response body (`sessionToken`) so API clients and tests can also authenticate via `Authorization: Bearer <sessionToken>`.
- **Inactivity expiration (`RNF-SEG-03`, `LAC-10`):**
  - Controlled on the server (`expiresAt` updated on authenticated activity; configurable via `AUTH_SESSION_IDLE_TIMEOUT_SECONDS`, default proposed `1800` / 30 minutes).
- **Immediate revocation (`RF-ACS-06`, `AC-53`, `OP-09`):**
  - Every request re-verifies the session against current server state:
    - If the session is missing, expired, or logged out → `401 AUTH_REQUIRED`.
    - If the user was deactivated (`status = DEACTIVATED`) after the session started → the session is immediately rejected with `401 AUTH_REQUIRED` (`AC-53`).
    - If the user's profiles were modified after the session started → the updated profiles take effect immediately on the next request (`RF-ACS-02`, `AC-53`).

## 5. Endpoints

### 5.1 `POST /api/v1/auth/login`

Authenticates an active operator with individual credentials.

- **Authentication:** Public
- **Request body:**
  ```json
  {
    "loginIdentifier": "alan.castro",
    "password": "correct-horse-battery-staple"
  }
  ```
- **Response `200 OK`:** Sets `Set-Cookie: erp_session=<token>; HttpOnly; Path=/; SameSite=Lax` and returns:
  ```json
  {
    "sessionToken": "<opaque-token>",
    "expiresAt": "2026-10-23T15:30:00.000Z",
    "user": {
      "id": "0192f5b6-7c8a-7def-8123-456789abcdef",
      "loginIdentifier": "alan.castro",
      "displayName": "Alan Castro",
      "profiles": ["COORDINATOR"],
      "status": "ACTIVE",
      "version": 1
    }
  }
  ```
- **Errors:** `400 INVALID_REQUEST`, `422 VALIDATION_FAILED`, `401 INVALID_CREDENTIALS`, `429 RATE_LIMITED`.

### 5.2 `POST /api/v1/auth/logout`

Terminates the current authenticated session (`RNF-SEG-03`).

- **Authentication:** Required (any active authenticated user)
- **Response `204 No Content`:** Clears `erp_session` cookie and revokes the server session.
- **Errors:** `401 AUTH_REQUIRED`.

### 5.3 `GET /api/v1/auth/session`

Returns the current authenticated operator and active profiles for client session bootstrap and route protection (`TF-01-05`).

- **Authentication:** Required (any active authenticated user)
- **Response `200 OK`:**
  ```json
  {
    "expiresAt": "2026-10-23T15:30:00.000Z",
    "user": {
      "id": "0192f5b6-7c8a-7def-8123-456789abcdef",
      "loginIdentifier": "alan.castro",
      "displayName": "Alan Castro",
      "profiles": ["COORDINATOR"],
      "status": "ACTIVE",
      "version": 1
    }
  }
  ```
- **Errors:** `401 AUTH_REQUIRED`.

### 5.4 `POST /api/v1/users`

Creates a new user account with explicit profiles (`RF-ACS-02`, `VAL-11`). Recorded in the audit trail (`RF-ACS-04`) and protected by `Idempotency-Key` (`OP-02`).

- **Authentication & Authorization:** Requires `ADMIN` profile (`403 FORBIDDEN` otherwise).
- **Headers:** `Idempotency-Key: <UUIDv4|UUIDv7>` (required).
- **Request body:**
  ```json
  {
    "loginIdentifier": "kaua.silva",
    "displayName": "Kauã Silva",
    "password": "strong-initial-password",
    "profiles": ["PERIODIC_ACTIVITY"]
  }
  ```
- **Response `201 Created`:** Returns user representation (`id`, `loginIdentifier`, `displayName`, `profiles`, `status`, `version`, `createdAt`, `updatedAt`, `deactivatedAt`). Never includes password or hash.
- **Errors:** `401 AUTH_REQUIRED`, `403 FORBIDDEN`, `409 DUPLICATE_RESOURCE`, `409 IDEMPOTENCY_CONFLICT`, `422 VALIDATION_FAILED`.

### 5.5 `GET /api/v1/users`

Lists user accounts for administration.

- **Authentication & Authorization:** Requires `ADMIN` profile.
- **Query:** `page` (positive integer, default `1`), `pageSize` (`1..100`, default `20`), optional `status` (`ACTIVE` / `DEACTIVATED`), and `profile` (one known profile code). Unknown, repeated, or malformed parameters are rejected with `400 INVALID_REQUEST`.
- **Response `200 OK`:** `{ "items": [ ... ], "page": 1, "pageSize": 20, "totalItems": 0, "totalPages": 0 }`. Ordering is by display name, then ID; persistence applies the page bounds.

### 5.6 `PUT /api/v1/users/:id/profiles`

Replaces a user's assigned profiles with optimistic concurrency (`OP-03`), audit reason (`RF-ACS-04`, `VAL-10`), and `Idempotency-Key` (`OP-02`). Takes effect on the user's very next request (`RF-ACS-02`, `AC-53`).

- **Authentication & Authorization:** Requires `ADMIN` profile.
- **Headers:** `Idempotency-Key: <UUIDv4|UUIDv7>` (required).
- **Request body:**
  ```json
  {
    "profiles": ["PERIODIC_ACTIVITY", "COORDINATOR"],
    "reason": "Atribuição de coordenação de atividades na S1",
    "version": 1
  }
  ```
- **Response `200 OK`:** Updated user with incremented `version`.
- **Errors:** `401`, `403`, `404 RESOURCE_NOT_FOUND`, `409 STALE_VERSION`, `409 IDEMPOTENCY_CONFLICT`, `422 VALIDATION_FAILED`.

### 5.7 `POST /api/v1/users/:id/deactivate`

Deactivates a user account while preserving historical authorship on all previously recorded facts and audit entries, and immediately revokes all active sessions for that user (`RF-ACS-06`, `AC-53`).

- **Authentication & Authorization:** Requires `ADMIN` profile.
- **Headers:** `Idempotency-Key: <UUIDv4|UUIDv7>` (required).
- **Request body:**
  ```json
  {
    "reason": "Encerramento de atuação operacional",
    "version": 2
  }
  ```
- **Response `200 OK`:** Updated user with `status: "DEACTIVATED"` and incremented `version`.
- **Errors:** `401`, `403`, `404 RESOURCE_NOT_FOUND`, `409 STALE_VERSION`, `409 IDEMPOTENCY_CONFLICT`, `422 VALIDATION_FAILED`.


## 6. Provisioning, validation, and atomicity

- Provision the initial ADMIN with the controlled local command in [README.md](../../README.md#initial-administrator). It is unavailable once any user exists and grants no implicit operational profile. Bootstrap records its origin and the newly established operator identity in the audit trail.
- User creation requires explicit profiles. Empty profile lists are rejected under the current backlog; deactivation blocks access while retaining historical authorship. Changing that cardinality requires aligning the backlog, contract, and tests.
- Creation accepts passwords of `8..128` characters; login accepts a non-empty password of at most `128` characters without normalization. The bounds are technical input constraints, not approval of a pending institutional policy.
- JSON bodies allow only the fields documented for the operation. Client IDs and extra fields are rejected with `400 INVALID_REQUEST`; semantic type/length/date failures return `422 VALIDATION_FAILED`. A supplied `factDate` must be a valid string calendar date. Change reasons are trimmed, non-empty, and at most `1000` characters.
- Protected mutations, audit, and operation confirmations commit together. A failed audit or confirmation rolls back the mutation. Concurrent identical keys replay one stored result. Secret-bearing creation inputs are compared using a separate salted verifier; changing the password with the same key returns `409 IDEMPOTENCY_CONFLICT`. Pre-existing confirmations without a verifier cannot establish equality for a password-bearing replay and are rejected rather than accepted silently.
- Authorship is retained by the protected audit trail; it is not an undocumented `createdByUserId` field on these representations.
