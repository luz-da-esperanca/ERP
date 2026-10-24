---
status: proposed
---

# 0006. Single npm Package and Executable Modular Monolith

The C-01 bootstrap uses one npm package, one lockfile, and one Node.js 24 runtime. Vite compiles React into `dist/client`; TypeScript compiles the Fastify composition and backend modules into `dist/server` and `dist/modules`. Fastify serves both API and compiled client in one deployable process. The single Prisma schema and migrations remain at the repository root, as proposed in the migration contract.

## Trade-offs

A workspace with separate frontend/backend packages would separate dependency manifests but add package boundaries, build ordering, and shared-package publication before any business module exists. One package gives both teams a runnable starting point with fewer moving parts. Its cost is a common lockfile and coordinated dependency changes; a later workspace split can be proposed when real package ownership requires it. Backend business boundaries remain explicit despite the shared manifest.

`src/modules/<module-name>` owns business rules, use cases, infrastructure adapters, and HTTP adapters as required by the feature. `src/server/main.ts` composes implementations. `src/client/features/<module-name>` holds feature UI when needed. No empty domain services, repositories, or entity tables are generated merely to illustrate the structure.

PostgreSQL 17 is the shared development baseline. The initial migration creates the schema without introducing domain tables or deciding pending institutional policy. Redis is deferred until a real cache contract exists. HTTP is permitted only for loopback development; TLS is required for shared environments, which remain outside bootstrap acceptance.

## Review status

Fabricio advanced the missing executable environment on 2026-10-23 at the user's direction. This implementation exception does not approve the contracts, resolve institutional gaps, transfer the remaining C-02/C-03 work, or authorize Fabricio to self-approve the code he authored. Independent technical review and the C-01 sign-off evidence remain pending.
