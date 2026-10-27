# Common Contracts

Technical documentation for the C-01 common contracts. All canonical documents are in English. Files with `.pt-BR.md` are local translations for personal review only and **must not be committed**.

## Index

| Contract / Artifact | Canonical | Version | Status | Owner | Reviewers | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Identifiers (C-01 item 1) | [`common-identifiers.md`](./common-identifiers.md) | 1.0-rc.1 | Review candidate — cross-team aligned by Alan; pending reviewer approval | Felipe (@FelipeeMartinns) | Fabricio (@Fabricio-Fontenele), Gabriel (lead) (@Gabriel-afk-9), Alan (@alanrcastro100) | Linked to [ADR-0002](../adr/0002-common-identifiers-and-idempotency-keys.md). |
| Errors (C-01 item 2) | [`common-errors.md`](./common-errors.md) | 1.0-rc.1 | Review candidate — cross-team aligned by Alan; pending reviewer approval | Felipe (@FelipeeMartinns) | Fabricio (@Fabricio-Fontenele), Gabriel (lead) (@Gabriel-afk-9), Alan (@alanrcastro100) | Linked to [ADR-0003](../adr/0003-problem-details-error-contract-and-boundary-translation.md). |
| API contracts (C-01 item 3) | [`common-api-contracts.md`](./common-api-contracts.md) | 1.0-rc.1 | Review candidate — cross-team aligned by Alan; pending reviewer approval | Felipe (@FelipeeMartinns) | Fabricio (@Fabricio-Fontenele), Gabriel (lead) (@Gabriel-afk-9), Alan (@alanrcastro100) | Reuses identifiers and error contracts. |
| Ownership matrix (C-01 item 4) | [`ownership.md`](./ownership.md) | 1.0-rc.1 | Review candidate — confirmed by Alan and Felipe; pending reviewer approval | Felipe (@FelipeeMartinns) & Alan (@alanrcastro100) | Fabricio (@Fabricio-Fontenele), Gabriel (lead) (@Gabriel-afk-9) | Single owner per common item. |
| Executable environment (C-01 item 5) | [`shared-environment.md`](./shared-environment.md), [`../../README.md`](../../README.md) | 0.1.0 | Implementation candidate; independent review pending | Felipe (@FelipeeMartinns); bootstrap advanced by Fabricio | Independent review required | Single package, Fastify + React, Prisma, operational endpoints, tests, and quality gates. |
| Git Flow & migrations (C-01 item 6) | [`git-flow-and-migrations.md`](./git-flow-and-migrations.md) | 1.0-rc.1 | Review candidate — pending Felipe confirmation and reviewer approval | Alan (@alanrcastro100) | Fabricio (@Fabricio-Fontenele), Gabriel (lead) (@Gabriel-afk-9), Felipe (@FelipeeMartinns) | Unblocks C-01 item 5 shared environment. |
| Domain glossary & ADRs (C-01 item 7) | [`../../GLOSSARY.md`](../../GLOSSARY.md), [`../adr/`](../adr/) | 1.0-rc.1 | Review candidate — pending reviewer ratification | Alan (@alanrcastro100); Fabricio authors bootstrap ADR-0006 | Independent review required for self-authored artifacts | ADRs `0001` to `0006` + root `GLOSSARY.md`. |
| Pending LAC decisions (C-01 item 8) | [`pending-institutional-decisions.md`](./pending-institutional-decisions.md) | 1.0-rc.1 | Review candidate — all LAC items remain `PENDING` | Alan (@alanrcastro100) | Fabricio (@Fabricio-Fontenele), Gabriel (lead) (@Gabriel-afk-9), Felipe (@FelipeeMartinns) | Covers `LAC-01`, `02`, `04`, `07`, `11` and `03`..`13`. |
| Review & S1 scope boundary (C-01 items 9–10) | [`c-01-review-and-approval-evidence.md`](./c-01-review-and-approval-evidence.md) | 1.0-rc.1 | In review — awaiting independent sign-off and integration | Alan (@alanrcastro100) & Felipe (@FelipeeMartinns) | Fabricio (@Fabricio-Fontenele), Gabriel (lead) (@Gabriel-afk-9), with independent review of Fabricio's bootstrap | Tracks executor alignment, reviewer sign-off, and S1 boundary. |

| Access and session (C-02) | [`access-and-session.md`](./access-and-session.md) | 1.1-rc.1 | Implementation candidate; review pending | Alan, with Kaua | Fabricio and Gabriel (lead) | Public authentication contract, explicit profiles, secure session lifecycle, and browser CSRF defense. |
| Institutes and projects (PB-12) | [`institutes-and-projects.md`](./institutes-and-projects.md) | 1.0-rc.1 | Implementation candidate; review pending | Alan | Fabricio and Kaua | Optional non-exclusive institute links, validity, history, and protected operations. |
| Stock origins (G-02 / RF-EST-02) | [`stock-origins.md`](./stock-origins.md) | 0.1.0 | Implementation candidate; review pending | Samuel (@Zidan-09) | Paulo (@PaulEvezely) | Donation-origin catalog without CRM or valuation; server-side authorization, audit, and idempotent creation. `LAC-08`, `LAC-09`, `LAC-11` remain pending. |
| Stock item catalog (TG-01-02 / G-01) | [`stock-item-catalog.md`](./stock-item-catalog.md) | 0.2.0 | Implementation candidate; review and UI integration pending | Erick | Felipe | Items, categories, explicit unit precision, size/numbering options, historical revisions, and exact quantities. |

Local `.pt-BR.md` translations are excluded from version control and are not canonical contract files.

## Rules

- Decisions in these documents are proposals. No reviewer approval is implied until recorded by Fabricio and Gabriel (lead).
- No public response may expose stack traces, credentials, or internal details (RNF-SEG-04).
- Errors and identifiers follow the rules in these contracts. Other modules must not create parallel schemes.
- Portuguese is used for product UI text; technical documentation is in English.
- Changes are versioned in this repository and require review.

## Remaining work for C-01

1. **Item 5 (Felipe, bootstrap advanced by Fabricio):** Review and integrate the executable candidate documented in [`shared-environment.md`](./shared-environment.md), including its recorded clean-clone verification. Advancing implementation does not transfer the remaining common work or imply approval.
2. **Item 9 (Fabricio & Gabriel lead):** Record technical review and approval evidence in [`c-01-review-and-approval-evidence.md`](./c-01-review-and-approval-evidence.md) and on the Pull Request / Issue #11.

## Evidence

Approval evidence for Fabricio and Gabriel (lead) must be recorded before closing C-01. Cross-team executor alignment is recorded in [`c-01-review-and-approval-evidence.md`](./c-01-review-and-approval-evidence.md).
