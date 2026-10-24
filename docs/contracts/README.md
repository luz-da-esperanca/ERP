# Sprint 1 Common Contracts (`C-01`)

This folder holds the shared Sprint 1 architectural and integration contracts agreed under **PB-00 / C-01** (`[S1][C-01] Acordar arquitetura, contratos, decisões e ambiente integrado`).

All tasks in Sprint 1 (`TF-01-01` through `TF-01-06`) must follow these agreements. If a change to any contract becomes necessary during implementation, update the corresponding document here via pull request and notify the team before merging incompatible behavior.

## Contents

| Document | Scope |
| --- | --- |
| [`architecture-and-layers.md`](architecture-and-layers.md) | Monolith module layout, Clean Architecture layer boundaries, and inward dependency rules |
| [`http-and-error-conventions.md`](http-and-error-conventions.md) | REST route conventions, RFC 9457 Problem Details error payload, pagination/filtering, optimistic concurrency, idempotency, and session/auth contract |
| [`identifiers-and-time.md`](identifiers-and-time.md) | UUIDv7 internal identifiers, human-readable operational references, UTC timestamps vs. `America/Sao_Paulo` business dates, and `factDate` vs. `recordedAt` |
| [`ownership.md`](ownership.md) | File and folder ownership matrix per Sprint 1 developer to minimize merge conflicts |
| [`development-environment.md`](development-environment.md) | Exact runtime versions, environment variables, local PostgreSQL + Prisma setup, and verification commands |
| [`access-and-session.md`](access-and-session.md) | Server-client authentication, session lifecycle, profile RBAC, and administrative user management contract (`C-02` / `TF-01-04` / `TF-01-05`) |
| [`institutes-and-projects.md`](institutes-and-projects.md) | Institutes listing and Projects creation, update, closure, and institute association contract (`PB-12` / `RF-ATV-01` / `RF-ATV-02` / `LAC-04` / `TF-01-04`) |

## Related References

- [GLOSSARY.md](../../GLOSSARY.md) — Canonical ubiquitous language and domain invariants
- [ADR-0001](../adr/0001-modular-monolith-and-clean-architecture.md) — Modular monolith and Clean Architecture boundaries
- [ADR-0002](../adr/0002-http-problem-details-and-idempotency.md) — HTTP Problem Details, optimistic concurrency, and idempotency
- [ADR-0003](../adr/0003-identifiers-and-time-semantics.md) — UUIDv7 identifiers and `factDate` vs `recordedAt`
- [ADR-0004](../adr/0004-pending-institutional-decisions-and-safe-defaults.md) — Safe technical defaults while `LAC-01..10` remain pending
