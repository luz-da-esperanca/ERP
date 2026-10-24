# Business Modules

Create modules lazily for approved backlog work using the vocabulary in [GLOSSARY.md](../../GLOSSARY.md). Use descriptive kebab-case names such as `registration`, `activities`, or `social-stock`; do not create empty modules for the whole backlog.

- Keep pure business rules in a module's `domain/` and orchestration/dependency contracts in `application/` when that separation earns its cost.
- Put Prisma implementations in `infrastructure/` and Fastify adapters in `http/`. Neither is imported by domain or application code.
- Wire concrete dependencies in `src/server/main.ts`. Reuse its Prisma client and the same transaction for atomic cross-module workflows.
- Expose deliberate application contracts to other modules. Do not reach into their persistence adapters or database tables.
- Add the matching tests under `test/modules/<module-name>/`, following RED → GREEN → REFACTOR.
- Frontend features belong under `src/client/features/<module-name>/` when implemented. Keep presentation apart from API access and business decisions.

These are responsibility boundaries, not a requirement to create four layers, repository interfaces, or factories for a trivial feature. Authentication and audit remain assigned to C-02 and C-03; the bootstrap supplies neither a permissive substitute nor business endpoints.
