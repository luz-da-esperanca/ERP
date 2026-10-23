# Git Flow and Prisma Migrations Contract (C-01 Item 6)

- **Status:** Review candidate — pending approval; decisions are proposals
- **Version:** 1.0-rc.1
- **Owner:** Alan (`@alanrcastro100`) — proposed per [Common Items Ownership](./ownership.md)
- **Reviewers:** Fabricio (`@Fabricio-Fontenele`), Gabriel (lead) (`@Gabriel-afk-9`), and Felipe (`@FelipeeMartinns`) for cross-team alignment
- **Source:** C-01 acceptance criterion 6
- **Related requirements:** OP-01, RNF-CON-01, RNF-MAN-02, RNF-MAN-03, AGENTS.md

## 1. Purpose

Define the shared version-control branching workflow (Git Flow) and the Prisma schema and migration convention across Team Fabricio and Team Gabriel so both teams can evolve the single monolith and PostgreSQL schema without branch drift, migration collisions, or destructive schema changes.

## 2. Git Flow Branching Model

All repository work follows Git Flow as mandated in [AGENTS.md](../../AGENTS.md):

| Branch pattern | Base branch | Merges into | Purpose and rules |
| --- | --- | --- | --- |
| `main` | — | — | Stable, production-ready releases only. Direct commits and force-pushes are forbidden. |
| `develop` | `main` | `release/*` | Default integration branch for completed features from both teams. Direct commits and force-pushes are forbidden. |
| `feature/<feature-name>` | `develop` | `develop` | All backlog (`PB-*`, `G-*`), common (`C-*`), and task (`TF-*`, `TG-*`) implementation work. Uses lowercase `kebab-case` names (e.g., `feature/c-01-common-contracts`, `feature/pb-03-family-registration`). |
| `release/<version>` | `develop` | `main` and `develop` | Release stabilization, final integration checks, and version tagging (`vX.Y.Z`). No new unrelated features. |
| `hotfix/<fix-name>` | `main` | `main` and `develop` | Urgent fixes for defects discovered in `main`; must be merged back into both `main` and `develop`. |

### 2.1 Branching and integration rules

1. **Pre-flight branch check:** Before starting any task, verify that `develop` exists and is up to date with `origin/develop` (`git fetch origin && git checkout develop && git pull --ff-only`).
2. **Small, cohesive branches:** Scope each `feature/<feature-name>` branch to a specific backlog card or task slice (`C-*`, `PB-*`, `G-*`, `TF-*`, `TG-*`).
3. **Pull request and review gate:** Every merge into `develop` or `main` requires a pull request reviewed by the designated peer or team lead (`Fabricio` or `Gabriel (lead)` as assigned in the sprint planning). Under the project rules, team leads review and record findings; they do not author the implementation they review.
4. **Conventional Commits:** Every commit message must use English imperative Conventional Commits (`type(scope): message`), where `type` is one of `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `build`, `ci`, `style`.
5. **No destructive history rewrites on shared branches:** Never force-push `main`, `develop`, or shared feature branches where multiple executors collaborate (`C-01`, `C-02`, `C-05`, `C-06`, `C-08`, `C-09`, `C-10`).

## 3. Prisma Schema and Migration Convention

The monolith uses a single canonical PostgreSQL database managed through Prisma (`AGENTS.md`).

### 3.1 Canonical layout

```text
prisma/
├── schema.prisma
└── migrations/
    ├── migration_lock.toml
    └── YYYYMMDDHHMMSS_<descriptive_snake_case>/
        └── migration.sql
```

- Keep a single `prisma/schema.prisma` and `prisma/migrations/` directory at the repository root (unless an ADR explicitly approves multi-file Prisma schema splitting in a later phase).
- Database table and column names in PostgreSQL use `snake_case` (via `@map` / `@@map` where needed), while Prisma model names use `PascalCase` and field names use `camelCase`.

### 3.2 Naming and authoring rules

1. **Migration folder format:** Prisma CLI standard timestamp prefix `YYYYMMDDHHMMSS_<descriptive_snake_case>` (e.g., `20261023120000_create_families_and_persons`).
2. **Descriptive verb-first names:** Use concise English `snake_case` describing the schema change (`create_...`, `add_...`, `alter_...`, `index_...`).
3. **Versioned migrations only:**
   - Generate migrations in local development with `npx prisma migrate dev --name <descriptive_snake_case>`.
   - Apply migrations in CI, staging, clean-clone verification (C-01 item 5), and production with `npx prisma migrate deploy`.
   - **Never use `prisma db push`** as a substitute for versioned migrations in shared branches, CI, or deployment scripts.
4. **Immutability of merged migrations:** Once a migration directory is merged into `develop`, its `migration.sql` is immutable. Any subsequent change, fix, or rollback must be delivered as a new forward migration.
5. **Database-level invariants:** Essential domain constraints required by `OP-01` and `VAL-01`..`VAL-11` must be enforced in the database schema and migrations (not only in application code), including:
   - UUIDv7 primary keys stored in native PostgreSQL `uuid` columns ([Common Identifiers](./common-identifiers.md));
   - Unique normalized 11-digit CPF constraint on persons (`VAL-02`, `RN-22`);
   - Unique family number constraint (`RF-CAD-01`, `AC-25`);
   - Unique login identifier constraint (`VAL-11`);
   - Unique composite external key `(source_system, record_type, external_id)` for imported records (`RF-MIG-04`, `OP-08`);
   - Unique scoped operation confirmation key `(operation_type, actor_id, operation_id)` for idempotency (`OP-02`);
   - Unique Bazar transfer reference (`RF-BAZ-03`);
   - Non-negative quantity/balance check constraints where applicable (`VAL-05`, `RNF-CON-04`).

### 3.3 Cross-team coordination to prevent migration conflicts

Because Team Fabricio (`CAD`, `FIC`, `ATV`, `FRQ`, `APT`) and Team Gabriel (`ATD`, `EST`, `ENT`, `BAZ`) share `prisma/schema.prisma`:

1. **Rebase/merge `origin/develop` before generating a migration:** Always pull the latest `origin/develop` right before running `prisma migrate dev` and opening a PR.
2. **Resolve timestamp ordering conflicts cleanly:** If `origin/develop` advances with another migration while a PR is open, update the feature branch against `origin/develop`, verify that migration order applies cleanly from an empty database (`prisma migrate reset` / clean database check), and regenerate the feature migration timestamp if schemas overlap.
3. **Data impact review:** Any migration that modifies or drops existing columns/constraints requires an explicit data-impact note in the PR description and review by the owner of the migrations contract (`Alan`).
4. **Pending institutional fields (`LAC`):** Do not enable or expose restricted sensitive columns (`RF-FIC-06` health/religion fields) before `LAC-05` and `LAC-08` are approved.

## 4. Decisions proposed for review

| ID | Decision | Status | Rationale |
| --- | --- | --- | --- |
| M1 | Git Flow with `main`, `develop`, `feature/*`, `release/*`, `hotfix/*` | Required (`AGENTS.md`) | Isolates ongoing sprint/cycle work from stable releases |
| M2 | Single root `prisma/schema.prisma` and `prisma/migrations/` | Proposed — pending approval | Matches single-database modular monolith and avoids multi-schema drift |
| M3 | Forward-only versioned migrations (`migrate dev` / `migrate deploy`); forbid `db push` in shared workflows | Proposed — pending approval | Reproducible clean-clone setup (C-01 item 5) and auditable schema history |
| M4 | Enforce core uniqueness and non-negative invariants in PostgreSQL constraints | Required (`OP-01`) | Protects integrity under concurrent requests |

## 5. Pending approvals

| Approver | Pending item | Evidence required |
| --- | --- | --- |
| Felipe (`@FelipeeMartinns`) | Cross-team alignment for C-01 item 5 shared environment setup | Written confirmation or review comment |
| Fabricio (`@Fabricio-Fontenele`) | Technical review of Git Flow and migration rules | Recorded review |
| Gabriel (lead) (`@Gabriel-afk-9`) | Technical review of Git Flow and migration rules | Recorded review |

## 6. Acceptance checklist for item 6

- [x] Git Flow branches (`main`, `develop`, `feature/*`, `release/*`, `hotfix/*`) and integration rules defined.
- [x] Prisma migration directory structure, naming convention, and execution commands defined.
- [x] Cross-team coordination and immutability rules documented for Felipe's item 5 environment setup.
- [ ] Cross-team alignment confirmed with Felipe.
- [ ] Reviewed and approved by Fabricio and Gabriel (lead).

## 7. References

- [AGENTS.md](../../AGENTS.md)
- [C-01 Issue](../team-docs/gabriel/issues/c-01.md)
- [Common Items Ownership](./ownership.md)
- [Common Identifiers](./common-identifiers.md)
- [Common Errors](./common-errors.md)
- [ADR-0001: Modular Monolith and Inward Dependency Boundaries](../adr/0001-modular-monolith-and-clean-architecture.md)

