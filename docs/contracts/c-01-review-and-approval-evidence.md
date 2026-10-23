# C-01 Review, Approval Evidence, and S1 Scope Boundary (C-01 Items 9 and 10)

- **Status:** In review — awaiting formal sign-off from Fabricio (`@Fabricio-Fontenele`) and Gabriel (lead) (`@Gabriel-afk-9`), and completion of Item 5 (shared environment) by Felipe (`@FelipeeMartinns`)
- **Version:** 1.0-rc.1
- **Executors:** Alan (`@alanrcastro100`, Team Fabricio) and Felipe (`@FelipeeMartinns`, Team Gabriel)
- **Reviewers:** Fabricio (`@Fabricio-Fontenele`) and Gabriel (lead) (`@Gabriel-afk-9`)
- **Source:** C-01 acceptance criteria 9 and 10 ([c-01.md](../team-docs/gabriel/issues/c-01.md))

## 1. Purpose

Provide a single auditable record of:

1. Coverage of each C-01 acceptance criterion across published repository artifacts;
2. Cross-team executor alignment between Alan (`@alanrcastro100`) and Felipe (`@FelipeeMartinns`);
3. Formal technical review and approval evidence from Fabricio (`@Fabricio-Fontenele`) and Gabriel (lead) (`@Gabriel-afk-9`) (Item 9);
4. The explicit S1 acceptance boundary and blocker tracking rule (Item 10).

> **Integrity rule:** C-01 must not be declared closed until Item 5 is verified from a clean clone and both reviewers (`Fabricio` and `Gabriel (lead)`) record their approval evidence below and on Issue #11 / the corresponding Pull Request.

## 2. C-01 Acceptance Criteria Traceability Matrix

| Item | C-01 Acceptance Criterion | Primary Owner | Artifact(s) in Repository | Current Status |
| --- | --- | --- | --- | --- |
| **1** | Define and publish common identifiers (format, generation, usage) before any module persists data; no module creates its own scheme. | Felipe (`@FelipeeMartinns`) | [`docs/contracts/common-identifiers.md`](./common-identifiers.md), [`ADR-0002`](../adr/0002-common-identifiers-and-idempotency-keys.md) | Published (`1.0-rc.1`); cross-team aligned by Alan; pending reviewer sign-off |
| **2** | Define common error format and translation of validation, authorization, conflict, and persistence failures without exposing stack traces, credentials, or internal details. | Felipe (`@FelipeeMartinns`) | [`docs/contracts/common-errors.md`](./common-errors.md), [`ADR-0003`](../adr/0003-problem-details-error-contract-and-boundary-translation.md) | Published (`1.0-rc.1`); cross-team aligned by Alan; pending reviewer sign-off |
| **3** | Define API/service contracts consumed by interfaces: inputs, outputs, error semantics/codes, and versioning. | Felipe (`@FelipeeMartinns`) | [`docs/contracts/common-api-contracts.md`](./common-api-contracts.md) | Published (`1.0-rc.1`); cross-team aligned by Alan; pending reviewer sign-off |
| **4** | Name a single owner per common item: identifiers, error format, API contracts, audit (`C-03`), access (`C-02`), environment, and migrations. | Felipe (`@FelipeeMartinns`) & Alan (`@alanrcastro100`) | [`docs/contracts/ownership.md`](./ownership.md) | Published (`1.0-rc.1`); confirmed by Alan and Felipe; pending reviewer sign-off |
| **5** | Materialize the shared environment with the required stack (manifest, strict TypeScript, Fastify app, React app, Prisma schema, versioned migrations) verifiable from a clean clone. | Felipe (`@FelipeeMartinns`) | Root manifest / `tsconfig.json` / `prisma/` / `src/` (to be delivered by Felipe) | **Pending execution by Felipe** (unblocked by Item 6 convention) |
| **6** | Define Git Flow branches (`main`, `develop`, `feature/*`, `release/*`, `hotfix/*`) and the Prisma migration convention. | Alan (`@alanrcastro100`) | [`docs/contracts/git-flow-and-migrations.md`](./git-flow-and-migrations.md) | Published (`1.0-rc.1`); pending Felipe confirmation and reviewer sign-off |
| **7** | Record architectural decisions in `docs/adr/` and common vocabulary in root `GLOSSARY.md`, ratified by both reviewers. | Alan (`@alanrcastro100`) | [`GLOSSARY.md`](../../GLOSSARY.md), [`docs/adr/0001`..`0005`](../adr/) | Published (`1.0-rc.1`); pending reviewer ratification |
| **8** | Record pending institutional decisions (`LAC-01`, `LAC-02`, `LAC-04`, `LAC-07`, `LAC-11`, plus `LAC-03`..`13`) as pending, with decision-maker and deadline; none silently resolved. | Alan (`@alanrcastro100`) | [`docs/contracts/pending-institutional-decisions.md`](./pending-institutional-decisions.md) | Published (`1.0-rc.1`); pending reviewer sign-off |
| **9** | Record approval evidence from Fabricio and Gabriel (lead) before declaring the contract closed. | Alan (`@alanrcastro100`) (tracking) / Fabricio & Gabriel (lead) (review) | Section 4 of this document + PR / Issue #11 review records | **Pending reviewer sign-off** |
| **10** | Limit S1 acceptance to the contract and minimum environment: does not conclude business functionality or institutional acceptance. | Alan (`@alanrcastro100`) & Felipe (`@FelipeeMartinns`) | Section 5 of this document | Documented and enforced |

*Note on CAD contracts (`C-01` / `TF-01-02`):* As specified in `Product-Backlog-ERP-Geral.md` and `c-01.md`, Gabriel from Team Fabricio (`@gaboliveira-alt`) provides the registration (`CAD`) module contracts under `TF-01-02`, building on the common contracts defined here.

## 3. Cross-Team Executor Alignment Record (Alan & Felipe)

Alan (`@alanrcastro100`, Team Fabricio executor for C-01) has reviewed and confirmed cross-team alignment with the proposals authored by Felipe (`@FelipeeMartinns`, Team Gabriel executor for C-01) in commits `948ae18`, `c15b41a`, and `dd54969`:

| Contract / Proposal Set | Executor Alignment Status | Alignment Notes |
| --- | --- | --- |
| **Identifiers (`D1`–`D6` in [`common-identifiers.md`](./common-identifiers.md))** | Confirmed by Alan (`@alanrcastro100`) | Aligned on UUIDv7 for server-generated internal entity IDs (`D1`), UUIDv4/UUIDv7 for client-generated operation IDs (`D2`), composite `(sourceSystem, recordType, externalId)` with exact original preservation (`D3`, `D4`), prohibition of CPF as identity/counting key (`D5`), and separation of human-readable catalog codes (`D6`). |
| **Error Contract (`E1`–`E8` in [`common-errors.md`](./common-errors.md))** | Confirmed by Alan (`@alanrcastro100`) | Aligned on RFC 9457 Problem Details (`application/problem+json`) (`E1`), `urn:erp:problem:*` URIs (`E2`), `400` malformed vs. `422` semantic validation (`E3`), `UPPER_SNAKE_CASE` codes (`E4`), omitting rejected values (`E5`), opaque server `traceId` (`E6`), persistence translation at infrastructure boundary (`E7`), and pt-BR messages with English codes (`E8`). |
| **API Conventions (`A1`–`A6` in [`common-api-contracts.md`](./common-api-contracts.md))** | Confirmed by Alan (`@alanrcastro100`) | Aligned on `/api/v1/` URI versioning (`A1`), JSON over HTTPS with UTC ISO 8601 instants and `YYYY-MM-DD` civil dates (`A2`), `Idempotency-Key` header for fact/movement confirmations (`A3`), optimistic concurrency (`409 STALE_VERSION`) (`A4`), cursor/offset pagination with filter/sort allowlists (`A5`), and reuse of common identifiers/errors (`A6`). |
| **Common Items Ownership ([`ownership.md`](./ownership.md))** | Confirmed by Alan (`@alanrcastro100`) & Felipe (`@FelipeeMartinns`) | Single owner per item agreed: Felipe owns Identifiers, Error Format, API Contracts, Audit (`C-03`), and Shared Environment (Item 5); Alan owns Access (`C-02`, with Kauã), Migrations & Git Flow (Item 6), ADRs & Glossary (Item 7), and LAC Register & Approval Tracking (Items 8–9). |
| **Git Flow, Migrations, ADRs, Glossary, LAC Register (Items 6–8)** | Authored by Alan (`@alanrcastro100`); pending Felipe confirmation | Published on `feature/c-01-common-contracts` to unblock Felipe's Item 5 shared environment implementation. |

## 4. Formal Reviewer Approval Log (C-01 Item 9)

Per `Sprint-Planning-ERP-Geral.md` (`TF-01-01` and `TG-01-01`), Fabricio (`@Fabricio-Fontenele`) and Gabriel (lead) (`@Gabriel-afk-9`) act exclusively as technical reviewers. Neither reviewer is recorded as having approved until their actual review is submitted on the Pull Request / Issue #11.

| Reviewer | Role / Task | Scope Reviewed | Status | PR / Issue #11 Review Link & Date |
| --- | --- | --- | --- | --- |
| **Fabricio** (`@Fabricio-Fontenele`) | Team Fabricio Lead (`TF-01-01`) | Items 1–4, 6–10 (`docs/contracts/*`, `GLOSSARY.md`, `docs/adr/0001`..`0005`) and Item 5 shared environment | **PENDING REVIEW** | _To be recorded upon PR review_ |
| **Gabriel (lead)** (`@Gabriel-afk-9`) | Team Gabriel Lead (`TG-01-01`) | Items 1–4, 6–10 (`docs/contracts/*`, `GLOSSARY.md`, `docs/adr/0001`..`0005`) and Item 5 shared environment | **PENDING REVIEW** | _To be recorded upon PR review_ |

## 5. S1 Scope Boundary and Blocker Rule (C-01 Item 10)

1. **Limited to foundational contracts and minimum environment:** S1 acceptance of `C-01` covers only the common technical contracts (`docs/contracts/`), architectural decisions (`docs/adr/`), domain glossary (`GLOSSARY.md`), pending institutional decision register (`pending-institutional-decisions.md`), and the runnable baseline shared environment (Item 5).
2. **No business feature completion or institutional sign-off implied:** Closing or approving `C-01` does **not** complete any domain feature card (`PB-03`..`PB-23`, `G-01`..`G-15`), does **not** resolve any pending institutional gap (`LAC-01`..`LAC-13`), and does **not** authorize production deployment or decommissioning of Bússola Social.
3. **Living contract during the project:** Per `c-01.md`, the minimum base is targeted for the end of S1 (`23/10/2026`), and the contracts continue to be reviewed and refined across subsequent sprints/cycles under change control.
4. **Explicit blocker tracking if Item 5 or reviews are incomplete by 23/10/2026:** If the shared environment (Item 5) or reviewer sign-off (Item 9) is not completed by the S1 milestone (`23/10/2026`), the remaining items must be recorded as an explicit blocker with owner (`Felipe` for Item 5; `Fabricio` and `Gabriel (lead)` for Item 9) and target resolution date, rather than reporting fictitious completion.

