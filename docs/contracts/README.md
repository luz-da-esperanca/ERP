# Common Contracts

Technical documentation for the C-01 common contracts. All canonical documents are in English. Files with `.pt-BR.md` are local translations for personal review only and **must not be committed**.

## Index

| Contract | Canonical | Version | Status | Owner | Reviewers | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Identifiers (C-01 item 1) | [`common-identifiers.md`](./common-identifiers.md) | 1.0-rc.1 | Review candidate — pending approval; decisions are proposals | Felipe (@FelipeeMartinns) | Fabricio (@Fabricio-Fontenele), Gabriel (lead) (@Gabriel-afk-9), Alan (@alanrcastro100) | Item 4 owner matrix included. Pending cross-team approval. |
| Errors (C-01 item 2) | [`common-errors.md`](./common-errors.md) | 1.0-rc.1 | Review candidate — pending approval; decisions are proposals | Felipe (@FelipeeMartinns) | Fabricio (@Fabricio-Fontenele), Gabriel (lead) (@Gabriel-afk-9), Alan (@alanrcastro100) | Reuses identifiers contract; transport and API details in item 3. |

Local copies (not committed): [`common-identifiers.pt-BR.md`](./common-identifiers.pt-BR.md), [`common-errors.pt-BR.md`](./common-errors.pt-BR.md).

## Rules

- Decisions in these documents are proposals. No approval is implied until recorded by the reviewers and cross-team alignment with Alan.
- No public response may expose stack traces, credentials, or internal details (RNF-SEG-04).
- Errors and identifiers follow the rules in these contracts. Other modules must not create parallel schemes.
- Portuguese is used for product UI text; technical documentation is in English.
- Changes are versioned in this repository and require review.

## Next steps (Felipe)

1. Item 3 — Common API contracts (conventions + representative endpoints). Reuse the error envelope and identifier rules.
2. Item 4 — Formalize and confirm the owner matrix with reviewers.
3. Item 5 — Environment shared, after Alan's item 6 (Git Flow + migration convention). Requires clean-clone verification.

## Evidence

Approval evidence for Fabricio and Gabriel (lead) must be recorded before closing C-01. Alan must confirm cross-team alignment.
