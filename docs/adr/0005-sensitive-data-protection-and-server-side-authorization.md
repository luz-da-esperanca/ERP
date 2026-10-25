---
status: proposed
---

# 0005. Server-Side Field Authorization and Blocked Sensitive Data Until Institutional Approval

All authentication, session validation, and operation/record/field-level authorization are enforced on the server across every endpoint, search, report, export, and import (`RF-ACS-03`, `RNF-SEG-04`, `OP-09`), and sensitive health, medication, religion, and evangelization fields (`RF-FIC-06`) remain disabled at the API, domain, and import boundaries until institutional decisions `LAC-05` and `LAC-08` are formally approved (`RES-01`, `RES-03`, `RNF-SEG-05`).

## Context and Trade-offs

The paper registration form (`Ficha de Cadastro de Famílias 2025`) contains sensitive personal data under LGPD Arts. 5(II), 11, and 14 (health, medications, spiritual/religious data, and data of children and adolescents). Meanwhile, operators have distinct responsibilities—for example, periodic-activity roll-call operators may only see name, family, and attendance marks (`AC-09`), and distribution operators may see eligibility, declared needs, and clothing/shoe sizes but never income or health data (`ERS §2.3`).

## Considered Options

- **Server-side policy enforcement + projection allowlists per profile + disabled sensitive fields until `LAC-05`/`LAC-08` approval (chosen):** Transport and application layers project only the fields allowed for the caller's active profile; hidden/extra fields in write or import payloads are rejected (`VAL-12`, `OP-09`); passwords use dedicated password hashing (`Argon2id` or `bcrypt`) (`RNF-SEG-01`); and audit logs record actor, timestamp, before/after state, and reason while redacting secrets and unauthorized sensitive data (`RF-ACS-04`).
- **UI-only field hiding with shared full-entity API responses:** Rejected because `RNF-SEG-04` and `AC-52` require the server itself to withhold restricted fields in direct API calls, searches, aggregations, exports, and error messages.
- **Enabling all paper-form health/religion fields immediately in S1:** Rejected because `RF-FIC-06`, `RES-01`, and `RES-06` forbid accepting or storing those fields before `LAC-05` and `LAC-08` are approved.

## Consequences

- Development and testing use synthetic data only until `LAC-08` is resolved.
- User deactivation (`RF-ACS-06`) immediately revokes active server sessions while preserving historical authorship references.
- When `LAC-05` and `LAC-08` are resolved, an update to this ADR will record the approved legal basis, retention schedule, access matrix, and storage protection controls (`RNF-SEG-05`).
- Pending ratification by Fabricio (`@Fabricio-Fontenele`) and Gabriel (lead) (`@Gabriel-afk-9`) under `C-01`.

## C-02 implementation proposal

The access implementation proposes Node.js built-in `scrypt` instead of adding an Argon2id/bcrypt dependency. New hashes encode `N=16384`, `r=8`, and `p=5`, with a random 16-byte salt and a 64-byte key; these parameters follow an [OWASP scrypt configuration](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#scrypt). Verification retains the earlier three-part encoding (`N=16384`, `r=8`, `p=1`) so the change does not invalidate existing credentials. Parameters are accepted from known encodings rather than arbitrary database-provided work factors. Dedicated salted verifiers also bind secret-bearing operation confirmations without recording plaintext passwords or including password values in ordinary digests.

This is a documented proposed departure from the algorithm alternatives above, subject to the same independent technical review. It does not approve any pending institutional access or session policy.
