---
status: proposed
---

# 0001. Modular Monolith and Inward Dependency Boundaries

We will build and deploy the ERP Social Luz da Esperança as a single TypeScript (`strict: true`) modular monolith backed by Fastify, React, PostgreSQL (via Prisma), and Vitest, organized around cohesive business modules (`CAD`, `FIC`, `ATV`, `FRQ`, `APT`, `ATD`, `EST`, `ENT`, `BAZ`, `REL`, `ACS`, `MIG`) with Clean Architecture inward dependencies.

## Context and Trade-offs

Two five-person development streams (Team Fabricio and Team Gabriel) must deliver tightly coupled social assistance workflows—such as atomic item deliveries that simultaneously validate family eligibility (`APT`), create a point-in-time attendance record (`ATD`), deduct stock lots (`EST`), and write an audit trail (`ACS`) (`RF-ENT-03`, `OP-01`)—while keeping operational and maintenance costs sustainable for the institution after academic handover (`RES-07`, `LAC-10`).

## Considered Options

- **Modular monolith with inward dependency boundaries (chosen):** One deployable backend and database with explicit module contracts and inward dependencies (presentation/transport and infrastructure depend on application contracts; application depends on domain; domain imports no framework or Prisma types).
- **Distributed microservices per functional front:** Rejected because cross-module atomic operations (`OP-01`) would require distributed transactions or eventual consistency, and operating multiple services/databases would violate the low-maintenance institutional constraint (`RES-07`).
- **Unstructured layered monolith sharing Prisma models everywhere:** Rejected because direct cross-module table access and framework leakage into domain rules make concurrent team work fragile and untestable.

## Consequences

- Cross-module interactions (such as `ENT` consuming official `APT` evaluations under `C-04` or `REL` aggregating history under `C-05`) occur through explicit application contracts rather than reaching into another module's internal persistence adapters.
- Database transactions spanning multiple modules (e.g., Delivery + Attendance + Stock Movement + Audit) execute atomically within a single PostgreSQL database (`OP-01`, `RNF-CON-01`).
- Pending ratification by Fabricio (`@Fabricio-Fontenele`) and Gabriel (lead) (`@Gabriel-afk-9`) under `C-01`.

