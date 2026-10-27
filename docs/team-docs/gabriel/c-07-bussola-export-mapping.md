# C-07 — Bússola export mapping and cutover plan (stock-origin recorte)

| Field | Value |
| --- | --- |
| Backlog item | C-07 — "Mapear exportação do Bússola e planejar corte" ([Product Backlog](../Product-Backlog-ERP-Geral.md)) |
| Origin issue | [TG-01-04](./issues/tg-01-04.md) — origin registration and C-07 mapping for this recorte |
| Recorte covered here | Stock origins of the Social Stock (`RF-EST-02`, `RF-EST-03`, `RF-BAZ-04`) and the import evidence required for them |
| Executors | Ruan (Fabricio team) and Samuel (`@Zidan-09`) |
| Reviewers | Fabricio (`@Fabricio-Fontenele`) and Gabriel (lead) (`@Gabriel-afk-9`) |
| Deadline | `2026-10-30` (end of S2, `LAC-11` milestone) |
| Status | **BLOCKED — Bússola export sample unavailable** |
| Last updated | 2026-10-25 |

## 1. Status and evidence

**BLOCKED — Bússola export sample unavailable.**

A repository-wide search on 2026-10-25 found no export file, no export schema, no sample record, and no description of the Bússola Social export format. Existing mentions of Bússola are requirements, backlog items, and institutional decisions; none is an artifact that can be mapped.

Consequences recorded for `LAC-11`:

- No file structure, field list, encoding, delimiter, or identifier scheme is assumed.
- No migration, import, or reconciliation is claimed as completed.
- `C-08` (import of families, people, links, and histories) is **not started** by this document.
- Synthetic test imports are not evidence of a real migration and do not authorize decommissioning Bússola (`AC-12`, `AC-13`, `AC-55`).

## 2. Information that must be obtained from the source

| # | Item to obtain | Why it is required | Status |
| --- | --- | --- | --- |
| 1 | Real export sample (at least one file of each type the source can produce) | Defines the actual format; prevents inventing a schema | `PENDING SAMPLE` |
| 2 | Format and encoding (text/binary, charset, delimiter, nesting) | Determines the parser and the rejection rules | `PENDING SAMPLE` |
| 3 | Stable external identifiers per record type | Identity for re-execution and conflict detection (`RF-MIG-04`, `RF-MIG-05`) | `PENDING SAMPLE` |
| 4 | Required historical scope | Defines what must be imported versus consulted externally (`RF-MIG-02`) | `PENDING SAMPLE` |
| 5 | Cutover date and coexistence period | Operational planning; cannot be assumed | `PENDING SAMPLE` |
| 6 | Continuity/fallback plan while the previous system remains available | Institutional requirement (`LAC-11`) | `PENDING SAMPLE` |

## 3. Identity of imported records

When the sample exists, every imported record must be identified by the composite external key defined in [Common Identifiers](../../contracts/common-identifiers.md):

```text
(sourceSystem, recordType, externalId)
```

Rules already fixed while the sample is missing:

- The key must remain identical across re-executions of different batches (`RF-MIG-04`).
- An external number (for example a Bússola family number) never replaces the internal ERP identity without an explicit mapping.
- The same external key with divergent content is an explicit conflict, never a silent overwrite (`RF-MIG-05`, `OP-08`).
- Missing, invalid, or repeated CPF is a rejection, never a fictional value (`RF-MIG-03`, mandatory unique CPF).

## 4. Mapping table for this recorte

Rows stay empty until a real sample is available. An empty row means "not observed", not "not applicable".

| Bússola field | ERP target | Transformation | Evidence | Status |
| --- | --- | --- | --- | --- |
| _(pending sample)_ | `stock_origins.id` (UUIDv7 or fixed system UUID) | Deterministic mapping through the composite key | — | `PENDING SAMPLE` |
| _(pending sample)_ | `stock_origins.kind` | Only `INDIVIDUAL_DONOR`, `COMPANY_DONOR`, `CAMPAIGN`, `UNKNOWN` can be produced; `BAZAR_TRANSFER` is internal | [Stock Origins Contract](../../contracts/stock-origins.md) | `PENDING SAMPLE` |
| _(pending sample)_ | `stock_origins.name` | Trim, `1..150` characters; no uniqueness | [Stock Origins Contract](../../contracts/stock-origins.md) | `PENDING SAMPLE` |
| _(pending sample)_ | Receipt/movement history linked to an origin | Separate pre-cutover movements from the opening balance to avoid double counting (`RF-MIG-06`, `OP-08`) | — | `PENDING SAMPLE` |

## 5. Reconciliation and acceptance

Not executable until item 1 of section 2 is available. Planned controls, unchanged from the requirements:

- Counts by record type and period are compared; rejections and conflicts are listed with source, identifier, and reason (`RF-MIG-03`).
- Import is repeatable without duplicating people, links, facts, or movements (`RF-MIG-05`).
- Movements before the cutover date are separated from the opening balance (`RF-MIG-06`, `OP-08`).
- Totals and details agree under the same filters and permissions (`RF-REL-07`).

## 6. Blocker record

| Field | Value |
| --- | --- |
| Blocker | Bússola export sample and stable keys unavailable |
| Effect | C-07 mapping cannot be completed for this recorte; the integration step is replanned, not simulated |
| Owners | Ruan (Fabricio team) with Samuel (`@Zidan-09`) |
| Reviewers | Fabricio and Gabriel (lead) |
| Deadline | `2026-10-30` |
| Escalation | If the sample is still unavailable at the deadline, replan the integration and keep `LAC-11` `PENDING`; never declare migration completion |
| Next action | Obtain the sample from the Bússola operators with Ruan, attach it as evidence, and fill sections 2 to 5 |

## 7. Explicit exclusions

- This document does not implement `C-08` or any import routine.
- This document does not edit requirements, institutional decisions, or the issue.
- This document does not presume file names, field names, encodings, identifiers, or cutover dates.

## 8. References

- [TG-01-04 issue](./issues/tg-01-04.md)
- [Product Backlog — C-07](../Product-Backlog-ERP-Geral.md)
- [Sprint planning — Gabriel team](./Sprint-Planning-ERP-Gabriel.md)
- [Pending institutional decisions — LAC-11](../../contracts/pending-institutional-decisions.md)
- [Common Identifiers](../../contracts/common-identifiers.md)
- [Stock Origins Contract](../../contracts/stock-origins.md)
- [ERS — Migration requirements `RF-MIG-01`..`RF-MIG-06`](../../ERS%20%E2%80%94%20ERP%20Social%20Luz%20da%20Esperan%C3%A7a.md)
