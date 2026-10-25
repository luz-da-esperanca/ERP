# Business Modules

Create modules lazily for approved backlog work using the vocabulary in [GLOSSARY.md](../../GLOSSARY.md). Use descriptive kebab-case names such as `registration`, `activities`, or `social-stock`; do not create empty modules for the whole backlog.

- Keep pure business rules in a module's `domain/` and orchestration/dependency contracts in `application/` when that separation earns its cost.
- Put Prisma implementations in `infrastructure/` and Fastify adapters in `http/`. Neither is imported by domain or application code.
- Wire concrete dependencies through `src/server/main.ts` and `src/server/persistence.ts`. Write workflows receive transaction-bound repository, audit, and idempotency adapters from an inward transaction-runner contract. Reuse that transaction throughout the operation; adapters must not open nested transactions or commit independently.
- Expose deliberate application contracts to other modules. Do not reach into their persistence adapters or database tables.
- Add the matching tests under `test/modules/<module-name>/`, following RED → GREEN → REFACTOR.
- Frontend features belong under `src/client/features/<module-name>/` when implemented. Keep presentation apart from API access and business decisions.

These are responsibility boundaries, not a requirement to create four layers, repository interfaces, or factories for a trivial feature. Access, project management, and shared audit/idempotency adapters are implemented under their owning tasks. The in-memory adapters are isolated-test substitutes; real PostgreSQL tests establish persistence and concurrency guarantees. C-03 remains owned by Felipe.
